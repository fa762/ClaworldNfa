// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IClawNFA {
    function exists(uint256 tokenId) external view returns (bool);
    function ownerOf(uint256 tokenId) external view returns (address);
    function setAgentStatusByRouter(uint256 tokenId, bool active) external;
    function getAgentState(uint256 tokenId) external view returns (
        uint256 balance, bool active, address logicAddress, uint256 createdAt, address tokenOwner
    );
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

    // ============================================
    // EVENTS
    // ============================================

    event CLWDeposited(uint256 indexed nfaId, address indexed depositor, uint256 amount);
    event CLWSpent(uint256 indexed nfaId, uint256 amount, address skill);
    event CLWRewarded(uint256 indexed nfaId, uint256 amount, address skill);
    event WithdrawRequested(uint256 indexed nfaId, uint256 amount);
    event WithdrawClaimed(uint256 indexed nfaId, uint256 amount);
    event LobsterLevelUp(uint256 indexed nfaId, uint16 newLevel);
    event UpkeepProcessed(uint256 indexed nfaId, uint256 cost);
    event LobsterDormant(uint256 indexed nfaId);
    event LobsterRevived(uint256 indexed nfaId);
    event DnaMutated(uint256 indexed nfaId, uint8 gene, uint8 oldValue, uint8 newValue, bytes32 mutationData);
    event SkillAuthorized(address skill, bool authorized);
    event LobsterInitialized(uint256 indexed nfaId, uint8 rarity, uint8 shelter);

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
        return baseCost * (200 - uint256(grit)) / 200;
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
        // Pseudo-random gene selection based on block data
        uint256 rand = uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, nfaId))) % 4;
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

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
