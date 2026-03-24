// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IPancakeRouterV2 {
    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint256[] memory amounts);
    function WETH() external pure returns (address);
}

interface IFlapPortalV2 {
    function buy(
        address token,
        address recipient,
        uint256 minAmount
    ) external payable returns (uint256 amount);
    function previewBuy(
        address token,
        uint256 eth
    ) external view returns (uint256 amount);
}

interface IClawNFA {
    function exists(uint256 tokenId) external view returns (bool);
    function ownerOf(uint256 tokenId) external view returns (address);
    function setAgentStatusByRouter(uint256 tokenId, bool active) external;
    function getAgentState(uint256 tokenId) external view returns (
        uint256 balance, bool active, address logicAddress, uint256 createdAt, address tokenOwner
    );
    function updateLearningTree(uint256 tokenId, bytes32 newRoot) external;
    function learningTreeRoot(uint256 tokenId) external view returns (bytes32);
}

interface IWorldStateReader {
    function dailyCostMultiplier() external view returns (uint256);
}

interface IPersonalityEngineInternal {
    function evolvePersonality(uint256 nfaId, uint8 dimension, int8 delta) external;
}

/**
 * @title ClawRouter
 * @dev Game core contract. Manages lobster state, CLW balances, daily upkeep,
 *      skill routing, and recharge/withdrawal mechanics.
 */
contract ClawRouter is
    ReentrancyGuardUpgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    // ============================================
    // STRUCTS
    // ============================================

    struct LobsterState {
        uint8 rarity;       // 0=Common, 1=Rare, 2=Epic, 3=Legendary, 4=Mythic
        uint8 shelter;      // 0-7
        // Personality (0-100 each)
        uint8 courage;
        uint8 wisdom;
        uint8 social;
        uint8 create;
        uint8 grit;
        // DNA Combat Genes (0-100 each)
        uint8 str;
        uint8 def;
        uint8 spd;
        uint8 vit;
        // Mutation slots
        bytes32 mutation1;
        bytes32 mutation2;
        // Dynamic
        uint16 level;
        uint32 xp;
        uint64 lastUpkeepTime;
    }

    struct WithdrawRequest {
        uint256 amount;
        uint64 requestTime;
    }

    // ============================================
    // CONSTANTS
    // ============================================

    uint256 public constant WITHDRAW_COOLDOWN = 6 hours;
    uint256 public constant DORMANCY_THRESHOLD = 72 hours;

    // Daily CLW cost by level bracket (index = level / 10, capped at 9)
    uint256[10] public DAILY_COSTS;

    // XP required per level (cumulative). Level up when xp >= threshold.
    uint256 public constant XP_PER_LEVEL = 100;

    // ============================================
    // STATE VARIABLES
    // ============================================

    IERC20 public clwToken;
    IClawNFA public nfa;
    address public treasury;

    // Lobster game state
    mapping(uint256 => LobsterState) public lobsters;
    mapping(uint256 => uint256) public clwBalances;
    mapping(uint256 => bool) public initialized;

    // Withdrawal cooldown
    mapping(uint256 => WithdrawRequest) public withdrawRequests;

    // Skill routing: authorized skill contract addresses
    mapping(address => bool) public authorizedSkills;

    // Minter role (GenesisVault)
    address public minter;

    // Track when lobster CLW hit zero (for dormancy timing)
    mapping(uint256 => uint64) public zeroBalanceTimestamp;

    // Personality evolution tracking (monthly cap ±5 per dimension)
    mapping(uint256 => mapping(uint8 => int8)) public personalityChangesThisMonth;
    mapping(uint256 => uint64) public personalityMonthStart;

    // DEPRECATED: DEX integration moved to DepositRouter. Slots preserved for UUPS compatibility.
    address public pancakeRouter;   // DEPRECATED
    address public flapPortal;      // DEPRECATED
    bool public graduated;          // DEPRECATED

    // WorldState reference for daily cost multiplier
    address public worldState;

    /// @dev Global nonce for gene boost entropy, incremented on each level-up boost
    uint256 public geneBoostNonce;

    /// @dev PersonalityEngine contract address (for facade delegation)
    address public personalityEngine;

    // ============================================
    // EVENTS
    // ============================================

    event CLWDeposited(uint256 indexed nfaId, address indexed depositor, uint256 amount);
    event CLWSpent(uint256 indexed nfaId, uint256 amount, address indexed skill);
    event CLWRewarded(uint256 indexed nfaId, uint256 amount, address indexed skill);
    event WithdrawRequested(uint256 indexed nfaId, uint256 amount);
    event WithdrawClaimed(uint256 indexed nfaId, uint256 amount);
    event LobsterLevelUp(uint256 indexed nfaId, uint16 newLevel);
    event UpkeepProcessed(uint256 indexed nfaId, uint256 cost);
    event LobsterDormant(uint256 indexed nfaId);
    event LobsterRevived(uint256 indexed nfaId);
    event DnaMutated(uint256 indexed nfaId, uint8 gene, uint8 oldValue, uint8 newValue, bytes32 mutationData);
    event SkillAuthorized(address skill, bool authorized);
    event LobsterInitialized(uint256 indexed nfaId, uint8 rarity, uint8 shelter);
    event PersonalityEvolved(uint256 indexed nfaId, uint8 dimension, uint8 oldValue, uint8 newValue);
    event BuyAndDeposit(uint256 indexed nfaId, uint256 bnbSpent, uint256 clwReceived);
    event FlapBuyAndDeposit(uint256 indexed nfaId, uint256 bnbSpent, uint256 clwReceived);

    // ============================================
    // MODIFIERS
    // ============================================

    modifier onlyNFAOwner(uint256 nfaId) {
        require(nfa.ownerOf(nfaId) == msg.sender, "Not NFA owner");
        _;
    }

    modifier onlySkill() {
        require(authorizedSkills[msg.sender], "Not authorized skill");
        _;
    }

    modifier onlyMinter() {
        require(msg.sender == minter, "Not minter");
        _;
    }

    modifier lobsterExists(uint256 nfaId) {
        require(initialized[nfaId], "Lobster not initialized");
        _;
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _clwToken,
        address _nfa,
        address _treasury
    ) public initializer {
        __ReentrancyGuard_init();
        __Ownable_init();
        __UUPSUpgradeable_init();

        clwToken = IERC20(_clwToken);
        nfa = IClawNFA(_nfa);
        treasury = _treasury;

        // Daily costs: [lv1-10, lv11-20, lv21-30, lv31-40, lv41-50, lv51-60, lv61-70, lv71-80, lv81-90, lv91-100]
        DAILY_COSTS = [
            uint256(10 ether), 25 ether, 25 ether, 50 ether, 50 ether,
            50 ether, 100 ether, 100 ether, 200 ether, 200 ether
        ];
    }

    // ============================================
    // LOBSTER INITIALIZATION (called by GenesisVault)
    // ============================================

    function initializeLobster(uint256 nfaId, LobsterState calldata state) external onlyMinter {
        require(nfa.exists(nfaId), "NFA does not exist");
        require(!initialized[nfaId], "Already initialized");

        lobsters[nfaId] = state;
        lobsters[nfaId].lastUpkeepTime = uint64(block.timestamp);
        initialized[nfaId] = true;

        emit LobsterInitialized(nfaId, state.rarity, state.shelter);
    }

    // ============================================
    // CLW DEPOSIT (open — anyone can deposit to any lobster)
    // ============================================

    function depositCLW(uint256 nfaId, uint256 amount) external lobsterExists(nfaId) {
        require(amount > 0, "Zero amount");
        clwToken.safeTransferFrom(msg.sender, address(this), amount);
        clwBalances[nfaId] += amount;

        // Auto-revive if dormant and balance sufficient
        _checkRevival(nfaId);

        emit CLWDeposited(nfaId, msg.sender, amount);
    }

    // ============================================
    // CLW WITHDRAWAL (owner only, 6h cooldown)
    // ============================================

    function requestWithdrawCLW(uint256 nfaId, uint256 amount)
        external onlyNFAOwner(nfaId) lobsterExists(nfaId)
    {
        require(amount > 0, "Zero amount");
        require(clwBalances[nfaId] >= amount, "Insufficient CLW balance");
        require(withdrawRequests[nfaId].amount == 0, "Pending withdrawal exists");

        // Lock the amount
        clwBalances[nfaId] -= amount;
        withdrawRequests[nfaId] = WithdrawRequest({
            amount: amount,
            requestTime: uint64(block.timestamp)
        });

        emit WithdrawRequested(nfaId, amount);
    }

    function claimWithdrawCLW(uint256 nfaId)
        external onlyNFAOwner(nfaId) nonReentrant
    {
        WithdrawRequest memory req = withdrawRequests[nfaId];
        require(req.amount > 0, "No pending withdrawal");
        require(block.timestamp >= req.requestTime + WITHDRAW_COOLDOWN, "Cooldown not met");

        delete withdrawRequests[nfaId];

        // Transfer real CLW from contract to owner
        clwToken.safeTransfer(msg.sender, req.amount);

        emit WithdrawClaimed(nfaId, req.amount);
    }

    function cancelWithdraw(uint256 nfaId)
        external onlyNFAOwner(nfaId)
    {
        WithdrawRequest memory req = withdrawRequests[nfaId];
        require(req.amount > 0, "No pending withdrawal");

        // Return CLW to lobster balance
        clwBalances[nfaId] += req.amount;
        delete withdrawRequests[nfaId];
    }

    // ============================================
    // DAILY UPKEEP
    // ============================================

    /**
     * @dev Process daily CLW consumption. Anyone can call.
     *      Calculates days elapsed since last upkeep and deducts CLW.
     */
    function processUpkeep(uint256 nfaId) external lobsterExists(nfaId) {
        LobsterState storage lob = lobsters[nfaId];
        uint256 elapsed = block.timestamp - lob.lastUpkeepTime;

        if (elapsed < 1 days) return;

        uint256 daysElapsed = elapsed / 1 days;
        uint256 dailyCost = _getDailyCost(lob.level, lob.grit);
        uint256 totalCost = dailyCost * daysElapsed;

        if (clwBalances[nfaId] >= totalCost) {
            clwBalances[nfaId] -= totalCost;
            lob.lastUpkeepTime += uint64(daysElapsed * 1 days);

            // Track zero balance for dormancy
            if (clwBalances[nfaId] == 0) {
                zeroBalanceTimestamp[nfaId] = uint64(block.timestamp);
            }
        } else {
            // Consume what's available
            clwBalances[nfaId] = 0;
            lob.lastUpkeepTime = uint64(block.timestamp);

            if (zeroBalanceTimestamp[nfaId] == 0) {
                zeroBalanceTimestamp[nfaId] = uint64(block.timestamp);
            }
        }

        emit UpkeepProcessed(nfaId, totalCost);

        // Check dormancy: 72h with zero balance
        _checkDormancy(nfaId);
    }

    function _getDailyCost(uint16 level, uint8 grit) internal view returns (uint256) {
        uint256 bracket = level == 0 ? 0 : (uint256(level) - 1) / 10;
        if (bracket > 9) bracket = 9;
        uint256 baseCost = DAILY_COSTS[bracket];
        // Grit reduces cost: actual = base × (200 - grit) / 200
        uint256 cost = baseCost * (200 - uint256(grit)) / 200;
        // Apply WorldState daily cost multiplier if set
        if (worldState != address(0)) {
            uint256 mul = IWorldStateReader(worldState).dailyCostMultiplier();
            cost = cost * mul / 10000;
        }
        return cost;
    }

    function _checkDormancy(uint256 nfaId) internal {
        if (clwBalances[nfaId] > 0) return;

        uint64 zeroSince = zeroBalanceTimestamp[nfaId];
        if (zeroSince == 0) return;

        (, bool active,,,) = nfa.getAgentState(nfaId);
        if (!active) return; // Already dormant

        if (block.timestamp >= zeroSince + DORMANCY_THRESHOLD) {
            nfa.setAgentStatusByRouter(nfaId, false);
            emit LobsterDormant(nfaId);
        }
    }

    function _checkRevival(uint256 nfaId) internal {
        if (clwBalances[nfaId] == 0) return;

        (, bool active,,,) = nfa.getAgentState(nfaId);
        if (active) return; // Not dormant

        // Revive
        nfa.setAgentStatusByRouter(nfaId, true);
        zeroBalanceTimestamp[nfaId] = 0;
        emit LobsterRevived(nfaId);
    }

    // ============================================
    // SKILL CALLBACKS (only authorized skills)
    // ============================================

    function addCLW(uint256 nfaId, uint256 amount) external onlySkill lobsterExists(nfaId) {
        clwBalances[nfaId] += amount;
        _checkRevival(nfaId);
        emit CLWRewarded(nfaId, amount, msg.sender);
    }

    function spendCLW(uint256 nfaId, uint256 amount) external onlySkill lobsterExists(nfaId) {
        require(clwBalances[nfaId] >= amount, "Insufficient CLW");
        clwBalances[nfaId] -= amount;

        if (clwBalances[nfaId] == 0 && zeroBalanceTimestamp[nfaId] == 0) {
            zeroBalanceTimestamp[nfaId] = uint64(block.timestamp);
        }

        emit CLWSpent(nfaId, amount, msg.sender);
    }

    function addXP(uint256 nfaId, uint32 amount) external onlySkill lobsterExists(nfaId) {
        LobsterState storage lob = lobsters[nfaId];
        lob.xp += amount;

        // Level up check
        while (lob.xp >= XP_PER_LEVEL * (uint32(lob.level) + 1) && lob.level < 100) {
            lob.level++;
            emit LobsterLevelUp(nfaId, lob.level);

            // Every 10 levels: random gene +2
            if (lob.level % 10 == 0) {
                _levelUpGeneBoost(nfaId, lob);
            }
        }
    }

    function _levelUpGeneBoost(uint256 nfaId, LobsterState storage lob) internal {
        // Enhanced entropy: mix lobster's own unique state + nonce + gasleft()
        uint256 rand = uint256(keccak256(abi.encodePacked(
            block.prevrandao, block.timestamp, nfaId,
            lob.courage, lob.wisdom, lob.social, lob.create, lob.grit,
            lob.mutation1, lob.mutation2,
            lob.xp, gasleft(), ++geneBoostNonce
        ))) % 4;
        uint8 oldVal;
        if (rand == 0) { oldVal = lob.str; lob.str = _min100(lob.str + 2); }
        else if (rand == 1) { oldVal = lob.def; lob.def = _min100(lob.def + 2); }
        else if (rand == 2) { oldVal = lob.spd; lob.spd = _min100(lob.spd + 2); }
        else { oldVal = lob.vit; lob.vit = _min100(lob.vit + 2); }
    }

    function mutateDNA(
        uint256 nfaId,
        uint8 gene,    // 0=str, 1=def, 2=spd, 3=vit
        uint8 newValue,
        bytes32 mutationData
    ) external onlySkill lobsterExists(nfaId) {
        LobsterState storage lob = lobsters[nfaId];
        uint8 oldValue;

        if (gene == 0) { oldValue = lob.str; lob.str = newValue; }
        else if (gene == 1) { oldValue = lob.def; lob.def = newValue; }
        else if (gene == 2) { oldValue = lob.spd; lob.spd = newValue; }
        else if (gene == 3) { oldValue = lob.vit; lob.vit = newValue; }
        else { revert("Invalid gene"); }

        // Store mutation in slot
        if (lob.mutation1 == bytes32(0)) {
            lob.mutation1 = mutationData;
        } else if (lob.mutation2 == bytes32(0)) {
            lob.mutation2 = mutationData;
        }
        // If both slots full, overwrite slot1 (oldest)
        else {
            lob.mutation1 = lob.mutation2;
            lob.mutation2 = mutationData;
        }

        emit DnaMutated(nfaId, gene, oldValue, newValue, mutationData);

        // Update learning tree to record DNA mutation
        _updateLearningTree(nfaId, keccak256(abi.encodePacked("dna", gene, oldValue, newValue, mutationData)));
    }

    // ============================================
    // PERSONALITY EVOLUTION (facade → PersonalityEngine)
    // ============================================

    /**
     * @dev Facade: delegates to PersonalityEngine if set, otherwise runs inline.
     *      Maintains backward compatibility with existing skill contracts (TaskSkill, etc.).
     */
    function evolvePersonality(
        uint256 nfaId,
        uint8 dimension,
        int8 delta
    ) external onlySkill lobsterExists(nfaId) {
        if (personalityEngine != address(0)) {
            // Read old value before delegation
            LobsterState memory lobBefore = lobsters[nfaId];
            uint8 oldValue = _getPersonalityDimension(lobBefore, dimension);

            // Delegate to PersonalityEngine (updates state via setPersonalityByEngine)
            IPersonalityEngineInternal(personalityEngine).evolvePersonality(nfaId, dimension, delta);

            // Read new value after delegation
            uint8 newValue = _getPersonalityDimension(lobsters[nfaId], dimension);

            // Update learning tree (only router has permission)
            _updateLearningTree(nfaId, keccak256(abi.encodePacked("personality", dimension, oldValue, newValue)));
        } else {
            // Inline fallback (pre-migration)
            _evolvePersonalityInline(nfaId, dimension, delta);
        }
    }

    /**
     * @dev Called by PersonalityEngine to write personality values directly.
     *      Only PersonalityEngine can call this.
     */
    function setPersonalityByEngine(uint256 nfaId, uint8 dimension, uint8 newValue) external {
        require(msg.sender == personalityEngine, "Not PersonalityEngine");
        require(initialized[nfaId], "Lobster not initialized");
        require(dimension <= 4, "Invalid dimension");

        LobsterState storage lob = lobsters[nfaId];
        if (dimension == 0) lob.courage = newValue;
        else if (dimension == 1) lob.wisdom = newValue;
        else if (dimension == 2) lob.social = newValue;
        else if (dimension == 3) lob.create = newValue;
        else lob.grit = newValue;
    }

    /**
     * @dev Inline personality evolution (used before PersonalityEngine migration).
     */
    function _evolvePersonalityInline(uint256 nfaId, uint8 dimension, int8 delta) internal {
        require(dimension <= 4, "Invalid dimension");
        require(delta != 0, "Zero delta");

        _resetMonthlyCounterIfNeeded(nfaId);

        int8 currentChange = personalityChangesThisMonth[nfaId][dimension];
        int8 newChange = currentChange + delta;
        require(newChange >= -5 && newChange <= 5, "Monthly cap exceeded");
        personalityChangesThisMonth[nfaId][dimension] = newChange;

        LobsterState storage lob = lobsters[nfaId];
        uint8 oldValue;
        uint8 newValue;

        if (dimension == 0) {
            oldValue = lob.courage;
            newValue = _clampPersonality(lob.courage, delta);
            lob.courage = newValue;
        } else if (dimension == 1) {
            oldValue = lob.wisdom;
            newValue = _clampPersonality(lob.wisdom, delta);
            lob.wisdom = newValue;
        } else if (dimension == 2) {
            oldValue = lob.social;
            newValue = _clampPersonality(lob.social, delta);
            lob.social = newValue;
        } else if (dimension == 3) {
            oldValue = lob.create;
            newValue = _clampPersonality(lob.create, delta);
            lob.create = newValue;
        } else {
            oldValue = lob.grit;
            newValue = _clampPersonality(lob.grit, delta);
            lob.grit = newValue;
        }

        emit PersonalityEvolved(nfaId, dimension, oldValue, newValue);
        _updateLearningTree(nfaId, keccak256(abi.encodePacked("personality", dimension, oldValue, newValue)));
    }

    function _clampPersonality(uint8 current, int8 delta) internal pure returns (uint8) {
        int16 result = int16(int8(int256(uint256(current)))) + int16(delta);
        if (result < 0) return 0;
        if (result > 100) return 100;
        return uint8(uint16(result));
    }

    function _resetMonthlyCounterIfNeeded(uint256 nfaId) internal {
        uint64 monthStart = personalityMonthStart[nfaId];
        if (monthStart == 0 || block.timestamp >= monthStart + 30 days) {
            personalityMonthStart[nfaId] = uint64(block.timestamp);
            for (uint8 i = 0; i < 5; i++) {
                personalityChangesThisMonth[nfaId][i] = 0;
            }
        }
    }

    // ============================================
    // JOB CLASS DERIVATION (also available via PersonalityEngine)
    // ============================================

    /**
     * @dev Derive job class from top 2 personality dimensions.
     */
    function getJobClass(uint256 nfaId) external view returns (uint8 jobClass, string memory jobName) {
        LobsterState memory lob = lobsters[nfaId];

        uint8[5] memory dims = [lob.courage, lob.wisdom, lob.social, lob.create, lob.grit];
        uint8 top1Idx = 0;
        uint8 top2Idx = 1;

        if (dims[top2Idx] > dims[top1Idx]) {
            (top1Idx, top2Idx) = (top2Idx, top1Idx);
        }

        for (uint8 i = 2; i < 5; i++) {
            if (dims[i] > dims[top1Idx]) {
                top2Idx = top1Idx;
                top1Idx = i;
            } else if (dims[i] > dims[top2Idx]) {
                top2Idx = i;
            }
        }

        uint8 lo = top1Idx < top2Idx ? top1Idx : top2Idx;
        uint8 hi = top1Idx < top2Idx ? top2Idx : top1Idx;

        if (lo == 0 && hi == 1) return (0, "Explorer");
        if (lo == 1 && hi == 2) return (1, "Diplomat");
        if (lo == 2 && hi == 3) return (2, "Creator");
        if (lo == 0 && hi == 4) return (3, "Guardian");
        if (lo == 1 && hi == 3) return (4, "Scholar");
        if (lo == 0 && hi == 3) return (5, "Pioneer");
        if (top1Idx == 0) return (0, "Explorer");
        if (top1Idx == 1) return (4, "Scholar");
        if (top1Idx == 2) return (1, "Diplomat");
        if (top1Idx == 3) return (2, "Creator");
        return (3, "Guardian");
    }

    // ============================================
    // BUY AND DEPOSIT — DEPRECATED: Use DepositRouter instead
    // Kept for backward compatibility during migration period.
    // ============================================

    /// @dev DEPRECATED: Use DepositRouter.buyAndDeposit() instead.
    function buyAndDeposit(uint256 nfaId) external payable lobsterExists(nfaId) nonReentrant {
        revert("DEPRECATED: Use DepositRouter");
    }

    /// @dev DEPRECATED: Use DepositRouter.flapBuyAndDeposit() instead.
    function flapBuyAndDeposit(uint256 nfaId) external payable lobsterExists(nfaId) nonReentrant {
        revert("DEPRECATED: Use DepositRouter");
    }

    /// @dev DEPRECATED: Use DepositRouter.previewFlapBuy() instead.
    function previewFlapBuy(uint256 bnbAmount) external view returns (uint256) {
        revert("DEPRECATED: Use DepositRouter");
    }

    // ============================================
    // ADMIN
    // ============================================

    function setMinter(address _minter) external onlyOwner {
        minter = _minter;
    }

    function authorizeSkill(address skill, bool authorized) external onlyOwner {
        authorizedSkills[skill] = authorized;
        emit SkillAuthorized(skill, authorized);
    }

    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
    }

    function setWorldState(address _worldState) external onlyOwner {
        worldState = _worldState;
    }

    function setPersonalityEngine(address _engine) external onlyOwner {
        personalityEngine = _engine;
    }

    /// @dev DEPRECATED: Configure via DepositRouter instead.
    function setPancakeRouter(address _router) external onlyOwner {
        pancakeRouter = _router;
    }

    /// @dev DEPRECATED: Configure via DepositRouter instead.
    function setFlapPortal(address _portal) external onlyOwner {
        flapPortal = _portal;
    }

    /// @dev DEPRECATED: Configure via DepositRouter instead.
    function setGraduated(bool _graduated) external onlyOwner {
        graduated = _graduated;
    }

    /**
     * @dev Rescue ERC20 tokens accidentally sent to this contract.
     *      Cannot rescue CLW (those belong to lobsters).
     */
    function rescueERC20(address token, uint256 amount) external onlyOwner {
        require(token != address(clwToken), "Cannot rescue CLW");
        IERC20(token).safeTransfer(owner(), amount);
    }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================

    function getDailyCost(uint256 nfaId) external view returns (uint256) {
        LobsterState memory lob = lobsters[nfaId];
        return _getDailyCost(lob.level, lob.grit);
    }

    function getLobsterState(uint256 nfaId) external view returns (LobsterState memory) {
        return lobsters[nfaId];
    }

    function isActive(uint256 nfaId) external view returns (bool) {
        (, bool active,,,) = nfa.getAgentState(nfaId);
        return active;
    }

    // ============================================
    // INTERNAL HELPERS
    // ============================================

    function _min100(uint8 val) internal pure returns (uint8) {
        return val > 100 ? 100 : val;
    }

    function _getPersonalityDimension(LobsterState memory lob, uint8 dim) internal pure returns (uint8) {
        if (dim == 0) return lob.courage;
        if (dim == 1) return lob.wisdom;
        if (dim == 2) return lob.social;
        if (dim == 3) return lob.create;
        return lob.grit;
    }

    /**
     * @dev Update the NFA learning tree with a new leaf hash.
     *      Computes new root = keccak256(oldRoot, leafHash) for incremental Merkle.
     */
    function _updateLearningTree(uint256 nfaId, bytes32 leafHash) internal {
        bytes32 oldRoot = nfa.learningTreeRoot(nfaId);
        bytes32 newRoot = keccak256(abi.encodePacked(oldRoot, leafHash, block.timestamp));
        nfa.updateLearningTree(nfaId, newRoot);
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
