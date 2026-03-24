// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

interface IGenesisNFA {
    struct AgentMetadata {
        string persona;
        string experience;
        string voiceHash;
        string animationURI;
        string vaultURI;
        bytes32 vaultHash;
    }

    function mintTo(
        address to,
        address logicAddress,
        string memory metadataURI,
        AgentMetadata memory extendedMetadata
    ) external returns (uint256);
}

interface IGenesisRouter {
    struct LobsterState {
        uint8 rarity;
        uint8 shelter;
        uint8 courage;
        uint8 wisdom;
        uint8 social;
        uint8 create;
        uint8 grit;
        uint8 str;
        uint8 def;
        uint8 spd;
        uint8 vit;
        bytes32 mutation1;
        bytes32 mutation2;
        uint16 level;
        uint32 xp;
        uint64 lastUpkeepTime;
    }

    function initializeLobster(uint256 nfaId, LobsterState calldata state) external;
    function addCLW(uint256 nfaId, uint256 amount) external;
}

/**
 * @title GenesisVault
 * @dev Genesis mint contract for 888 founding lobsters.
 *      Uses commit-reveal to prevent front-running.
 *      Rarity-based pricing, random attribute generation.
 */
contract GenesisVault is
    OwnableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable
{
    // ============================================
    // CONSTANTS
    // ============================================

    uint256 public constant TOTAL_GENESIS = 888;
    uint256 public constant REVEAL_DELAY = 1 minutes;
    uint256 public constant REVEAL_WINDOW = 24 hours;

    // Rarity pricing (BNB)
    uint256 public constant PRICE_COMMON    = 0.08 ether;
    uint256 public constant PRICE_RARE      = 0.38 ether;
    uint256 public constant PRICE_EPIC      = 0.88 ether;
    uint256 public constant PRICE_LEGENDARY = 1.88 ether;
    uint256 public constant PRICE_MYTHIC    = 3.88 ether;

    // Rarity caps (max count per rarity)
    uint16 public constant CAP_MYTHIC    = 1;
    uint16 public constant CAP_LEGENDARY = 4;
    uint16 public constant CAP_EPIC      = 6;
    uint16 public constant CAP_RARE      = 17;
    uint16 public constant CAP_COMMON    = 860;

    // CLW airdrop amounts per rarity
    uint256 public constant AIRDROP_COMMON    = 1000 ether;
    uint256 public constant AIRDROP_RARE      = 3000 ether;
    uint256 public constant AIRDROP_EPIC      = 6000 ether;
    uint256 public constant AIRDROP_LEGENDARY = 12000 ether;
    uint256 public constant AIRDROP_MYTHIC    = 30000 ether;

    // DNA total sum ranges by rarity [min, max]
    uint16[2][5] public DNA_RANGES; // Initialized in initialize()

    // Shelter weights (8 shelters: indices 0-7)
    uint8[8] public SHELTER_WEIGHTS;

    // ============================================
    // STATE VARIABLES
    // ============================================

    IGenesisNFA public nfa;
    IGenesisRouter public router;

    uint256 public mintedCount;
    uint16[5] public rarityMinted; // [Common, Rare, Epic, Legendary, Mythic]

    bool public mintingActive;

    // Pull-over-push: pending refunds for failed BNB transfers
    mapping(address => uint256) public pendingRefunds;

    struct Commitment {
        bytes32 hash;
        uint256 value;      // BNB sent with commit
        uint64 timestamp;
        bool revealed;
    }
    mapping(address => Commitment) public commitments;

    // ============================================
    // EVENTS
    // ============================================

    event CommitMade(address indexed user, uint256 value);
    event GenesisRevealed(address indexed user, uint256 indexed nfaId, uint8 rarity, uint8 shelter);
    event CommitRefunded(address indexed user, uint256 amount);
    event RefundPending(address indexed user, uint256 amount);
    event RefundClaimed(address indexed user, uint256 amount);

    // ============================================
    // INITIALIZATION
    // ============================================

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _nfa,
        address _router
    ) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        nfa = IGenesisNFA(_nfa);
        router = IGenesisRouter(_router);

        // DNA sum ranges: [min, max] for each rarity
        DNA_RANGES[0] = [80, 140];     // Common
        DNA_RANGES[1] = [140, 200];    // Rare
        DNA_RANGES[2] = [200, 260];    // Epic
        DNA_RANGES[3] = [260, 320];    // Legendary
        DNA_RANGES[4] = [320, 400];    // Mythic

        // Shelter weights: [Coral, Deep, Kelp, Trench, Reef, Volcanic, Wasteland, Void]
        SHELTER_WEIGHTS = [15, 12, 10, 20, 12, 8, 18, 5];
    }

    // ============================================
    // COMMIT-REVEAL
    // ============================================

    /**
     * @dev Phase 1: Commit a hash of (rarity, salt, msg.sender) with BNB.
     */
    function commit(bytes32 hash) external payable nonReentrant {
        require(mintingActive, "Minting not active");
        require(mintedCount < TOTAL_GENESIS, "Genesis sold out");
        require(commitments[msg.sender].hash == bytes32(0), "Already committed");
        require(msg.value > 0, "Must send BNB");

        commitments[msg.sender] = Commitment({
            hash: hash,
            value: msg.value,
            timestamp: uint64(block.timestamp),
            revealed: false
        });

        emit CommitMade(msg.sender, msg.value);
    }

    /**
     * @dev Phase 2: Reveal rarity + salt. Mints to msg.sender.
     */
    function reveal(uint8 rarity, bytes32 salt) external nonReentrant {
        _reveal(rarity, salt, msg.sender);
    }

    /**
     * @dev Phase 2 (variant): Reveal and mint to a specified recipient address.
     *      Allows minting directly to a game wallet / chat wallet.
     */
    function revealTo(uint8 rarity, bytes32 salt, address recipient) external nonReentrant {
        require(recipient != address(0), "Invalid recipient");
        _reveal(rarity, salt, recipient);
    }

    /**
     * @dev Internal reveal logic shared by reveal() and revealTo().
     */
    function _reveal(uint8 rarity, bytes32 salt, address recipient) internal {
        Commitment storage c = commitments[msg.sender];
        require(c.hash != bytes32(0), "No commitment");
        require(!c.revealed, "Already revealed");
        require(block.timestamp >= c.timestamp + REVEAL_DELAY, "Too early");
        require(block.timestamp <= c.timestamp + REVEAL_WINDOW, "Reveal expired");

        // Verify hash (always based on msg.sender who committed)
        bytes32 expectedHash = keccak256(abi.encodePacked(rarity, salt, msg.sender));
        require(c.hash == expectedHash, "Invalid reveal");

        // Verify price
        uint256 price = _getPrice(rarity);
        require(c.value >= price, "Insufficient BNB");

        // Check rarity cap
        require(_checkRarityCap(rarity), "Rarity sold out");
        require(mintedCount < TOTAL_GENESIS, "Genesis sold out");

        c.revealed = true;
        mintedCount++;
        rarityMinted[rarity]++;

        // Refund excess
        uint256 excess = c.value - price;

        // Generate random attributes
        bytes32 seed = keccak256(abi.encodePacked(
            blockhash(block.number - 1), salt, msg.sender, mintedCount
        ));

        (uint8 shelter, uint8[5] memory personality, uint8[4] memory dna) = _generateAttributes(seed, rarity);

        // Mint NFA to recipient (can be msg.sender or a game wallet)
        IGenesisNFA.AgentMetadata memory meta = IGenesisNFA.AgentMetadata({
            persona: "",
            experience: "",
            voiceHash: "",
            animationURI: "",
            vaultURI: "",
            vaultHash: bytes32(0)
        });

        uint256 nfaId = nfa.mintTo(recipient, address(router), "", meta);

        // Initialize lobster in router
        IGenesisRouter.LobsterState memory lobState = IGenesisRouter.LobsterState({
            rarity: rarity,
            shelter: shelter,
            courage: personality[0],
            wisdom: personality[1],
            social: personality[2],
            create: personality[3],
            grit: personality[4],
            str: dna[0],
            def: dna[1],
            spd: dna[2],
            vit: dna[3],
            mutation1: bytes32(0),
            mutation2: bytes32(0),
            level: 1,
            xp: 0,
            lastUpkeepTime: 0  // router sets this
        });

        router.initializeLobster(nfaId, lobState);

        // CLW airdrop
        uint256 airdrop = _getAirdrop(rarity);
        if (airdrop > 0) {
            router.addCLW(nfaId, airdrop);
        }

        emit GenesisRevealed(msg.sender, nfaId, rarity, shelter);

        // Refund excess BNB to the original committer (pull-over-push fallback)
        if (excess > 0) {
            (bool ok, ) = payable(msg.sender).call{value: excess}("");
            if (!ok) {
                pendingRefunds[msg.sender] += excess;
                emit RefundPending(msg.sender, excess);
            }
        }
    }

    /**
     * @dev Allow users to get refund if they don't reveal within window.
     */
    function refundExpired() external nonReentrant {
        Commitment storage c = commitments[msg.sender];
        require(c.hash != bytes32(0), "No commitment");
        require(!c.revealed, "Already revealed");
        require(block.timestamp > c.timestamp + REVEAL_WINDOW, "Window still open");

        uint256 amount = c.value;
        delete commitments[msg.sender];

        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "Refund failed");

        emit CommitRefunded(msg.sender, amount);
    }

    // ============================================
    // ATTRIBUTE GENERATION
    // ============================================

    function _generateAttributes(bytes32 seed, uint8 rarity)
        internal view returns (uint8 shelter, uint8[5] memory personality, uint8[4] memory dna)
    {
        // Shelter: weighted random
        shelter = _weightedRandom(seed, SHELTER_WEIGHTS);

        // Personality: 5 dimensions, each [20, 80]
        for (uint256 i = 0; i < 5; i++) {
            bytes32 pSeed = keccak256(abi.encodePacked(seed, "personality", i));
            personality[i] = 20 + uint8(uint256(pSeed) % 61); // [20, 80]
        }

        // DNA: 4 genes, total sum within range for rarity
        uint16 minSum = DNA_RANGES[rarity][0];
        uint16 maxSum = DNA_RANGES[rarity][1];

        bytes32 dSeed = keccak256(abi.encodePacked(seed, "dna"));
        uint16 totalTarget = minSum + uint16(uint256(dSeed) % (maxSum - minSum + 1));

        // Distribute total among 4 genes
        dna = _distributeDNA(keccak256(abi.encodePacked(dSeed, "dist")), totalTarget);
    }

    function _distributeDNA(bytes32 seed, uint16 total) internal pure returns (uint8[4] memory dna) {
        // Random partitioning: generate 3 random breakpoints in [0, total]
        uint16[3] memory breaks;
        for (uint256 i = 0; i < 3; i++) {
            bytes32 bSeed = keccak256(abi.encodePacked(seed, i));
            breaks[i] = uint16(uint256(bSeed) % (total + 1));
        }

        // Sort breaks
        if (breaks[0] > breaks[1]) { (breaks[0], breaks[1]) = (breaks[1], breaks[0]); }
        if (breaks[1] > breaks[2]) { (breaks[1], breaks[2]) = (breaks[2], breaks[1]); }
        if (breaks[0] > breaks[1]) { (breaks[0], breaks[1]) = (breaks[1], breaks[0]); }

        // Segments
        uint16[4] memory segments;
        segments[0] = breaks[0];
        segments[1] = breaks[1] - breaks[0];
        segments[2] = breaks[2] - breaks[1];
        segments[3] = total - breaks[2];

        // Cap each at 100
        for (uint256 i = 0; i < 4; i++) {
            dna[i] = segments[i] > 100 ? 100 : uint8(segments[i]);
        }
    }

    function _weightedRandom(bytes32 seed, uint8[8] memory weights)
        internal pure returns (uint8)
    {
        uint256 totalWeight = 0;
        for (uint256 i = 0; i < 8; i++) {
            totalWeight += weights[i];
        }

        uint256 rand = uint256(keccak256(abi.encodePacked(seed, "shelter"))) % totalWeight;
        uint256 cumulative = 0;
        for (uint8 i = 0; i < 8; i++) {
            cumulative += weights[i];
            if (rand < cumulative) {
                return i;
            }
        }
        return 7; // fallback
    }

    // ============================================
    // PRICE / CAP HELPERS
    // ============================================

    function _getPrice(uint8 rarity) internal pure returns (uint256) {
        if (rarity == 0) return PRICE_COMMON;
        if (rarity == 1) return PRICE_RARE;
        if (rarity == 2) return PRICE_EPIC;
        if (rarity == 3) return PRICE_LEGENDARY;
        if (rarity == 4) return PRICE_MYTHIC;
        revert("Invalid rarity");
    }

    function _getAirdrop(uint8 rarity) internal pure returns (uint256) {
        if (rarity == 0) return AIRDROP_COMMON;
        if (rarity == 1) return AIRDROP_RARE;
        if (rarity == 2) return AIRDROP_EPIC;
        if (rarity == 3) return AIRDROP_LEGENDARY;
        if (rarity == 4) return AIRDROP_MYTHIC;
        return 0;
    }

    function _checkRarityCap(uint8 rarity) internal view returns (bool) {
        if (rarity == 0) return rarityMinted[0] < CAP_COMMON;
        if (rarity == 1) return rarityMinted[1] < CAP_RARE;
        if (rarity == 2) return rarityMinted[2] < CAP_EPIC;
        if (rarity == 3) return rarityMinted[3] < CAP_LEGENDARY;
        if (rarity == 4) return rarityMinted[4] < CAP_MYTHIC;
        return false;
    }

    // ============================================
    // ADMIN
    // ============================================

    /**
     * @dev Owner-only free mint, skips commit-reveal and payment.
     */
    function ownerMint(uint8 rarity, address recipient) external onlyOwner nonReentrant {
        require(rarity <= 4, "Invalid rarity");
        require(recipient != address(0), "Invalid recipient");
        require(_checkRarityCap(rarity), "Rarity sold out");
        require(mintedCount < TOTAL_GENESIS, "Genesis sold out");

        mintedCount++;
        rarityMinted[rarity]++;

        bytes32 seed = keccak256(abi.encodePacked(
            blockhash(block.number - 1), msg.sender, recipient, mintedCount
        ));

        (uint8 shelter, uint8[5] memory personality, uint8[4] memory dna) = _generateAttributes(seed, rarity);

        IGenesisNFA.AgentMetadata memory meta = IGenesisNFA.AgentMetadata({
            persona: "",
            experience: "",
            voiceHash: "",
            animationURI: "",
            vaultURI: "",
            vaultHash: bytes32(0)
        });

        uint256 nfaId = nfa.mintTo(recipient, address(router), "", meta);

        IGenesisRouter.LobsterState memory lobState = IGenesisRouter.LobsterState({
            rarity: rarity,
            shelter: shelter,
            courage: personality[0],
            wisdom: personality[1],
            social: personality[2],
            create: personality[3],
            grit: personality[4],
            str: dna[0],
            def: dna[1],
            spd: dna[2],
            vit: dna[3],
            mutation1: bytes32(0),
            mutation2: bytes32(0),
            level: 1,
            xp: 0,
            lastUpkeepTime: 0
        });

        router.initializeLobster(nfaId, lobState);

        uint256 airdrop = _getAirdrop(rarity);
        if (airdrop > 0) {
            router.addCLW(nfaId, airdrop);
        }

        emit GenesisRevealed(msg.sender, nfaId, rarity, shelter);
    }

    function setMintingActive(bool active) external onlyOwner {
        mintingActive = active;
    }

    function withdraw() external onlyOwner {
        (bool ok, ) = payable(owner()).call{value: address(this).balance}("");
        require(ok, "Withdraw failed");
    }

    // ============================================
    // VIEW
    // ============================================

    function getRarityMinted() external view returns (uint16[5] memory) {
        return rarityMinted;
    }

    function getCommitHash(uint8 rarity, bytes32 salt, address user) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(rarity, salt, user));
    }

    function getPrice(uint8 rarity) external pure returns (uint256) {
        return _getPrice(rarity);
    }

    /**
     * @dev Claim any pending BNB refunds (from failed excess refund transfers).
     */
    function claimRefund() external nonReentrant {
        uint256 amount = pendingRefunds[msg.sender];
        require(amount > 0, "No pending refund");
        pendingRefunds[msg.sender] = 0;
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "Refund transfer failed");
        emit RefundClaimed(msg.sender, amount);
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    /**
     * @dev Reserved storage gap for future upgrades.
     */
    uint256[40] private __gap;
}
