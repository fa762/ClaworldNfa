// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

interface IPEClawRouter {
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

    function getLobsterState(uint256 nfaId) external view returns (LobsterState memory);
    function setPersonalityByEngine(uint256 nfaId, uint8 dimension, uint8 newValue) external;
    function initialized(uint256 nfaId) external view returns (bool);
}

// Note: Learning tree updates handled by ClawRouter (only logic address can call NFA)

/**
 * @title PersonalityEngine
 * @dev Manages personality evolution and job class derivation for lobster NFAs.
 *      Extracted from ClawRouter to reduce contract complexity.
 *      Handles monthly caps, dimension clamping, and job class mapping.
 */
contract PersonalityEngine is OwnableUpgradeable, UUPSUpgradeable {

    IPEClawRouter public router;
    address public nfa; // DEPRECATED: kept for storage layout, no longer used directly

    // Authorized callers (skills or ClawRouter facade)
    mapping(address => bool) public authorizedCallers;

    // Personality evolution tracking (monthly cap ±5 per dimension)
    mapping(uint256 => mapping(uint8 => int8)) public personalityChangesThisMonth;
    mapping(uint256 => uint64) public personalityMonthStart;

    event PersonalityEvolved(uint256 indexed nfaId, uint8 dimension, uint8 oldValue, uint8 newValue);

    modifier onlyAuthorized() {
        require(authorizedCallers[msg.sender], "Not authorized");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _router, address _nfa) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();

        router = IPEClawRouter(_router);
        nfa = _nfa;
    }

    // ============================================
    // PERSONALITY EVOLUTION
    // ============================================

    /**
     * @dev Evolve a personality dimension by delta (-5 to +5 per month cap).
     * @param nfaId The lobster NFA ID
     * @param dimension 0=courage, 1=wisdom, 2=social, 3=create, 4=grit
     * @param delta Signed change amount (positive or negative)
     */
    function evolvePersonality(
        uint256 nfaId,
        uint8 dimension,
        int8 delta
    ) external onlyAuthorized {
        require(router.initialized(nfaId), "Lobster not initialized");
        require(dimension <= 4, "Invalid dimension");
        require(delta != 0, "Zero delta");

        // Reset monthly counter if new month
        _resetMonthlyCounterIfNeeded(nfaId);

        // Check monthly cap (±5 per dimension per month)
        int8 currentChange = personalityChangesThisMonth[nfaId][dimension];
        int8 newChange = currentChange + delta;
        require(newChange >= -5 && newChange <= 5, "Monthly cap exceeded");
        personalityChangesThisMonth[nfaId][dimension] = newChange;

        // Get current state and compute new value
        IPEClawRouter.LobsterState memory lob = router.getLobsterState(nfaId);
        uint8 oldValue = _getDimensionValue(lob, dimension);
        uint8 newValue = _clampPersonality(oldValue, delta);

        // Update via router
        router.setPersonalityByEngine(nfaId, dimension, newValue);

        emit PersonalityEvolved(nfaId, dimension, oldValue, newValue);

        // Note: Learning tree update is handled by ClawRouter facade
        // (only the logic address can call nfa.updateLearningTree)
    }

    // ============================================
    // JOB CLASS DERIVATION
    // ============================================

    /**
     * @dev Derive job class from top 2 personality dimensions.
     *      0=Explorer (courage+wisdom), 1=Diplomat (social+wisdom),
     *      2=Creator (create+social), 3=Guardian (grit+courage),
     *      4=Scholar (wisdom+create), 5=Pioneer (courage+create)
     */
    function getJobClass(uint256 nfaId) external view returns (uint8 jobClass, string memory jobName) {
        IPEClawRouter.LobsterState memory lob = router.getLobsterState(nfaId);

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
    // ADMIN
    // ============================================

    function setAuthorizedCaller(address caller, bool authorized) external onlyOwner {
        authorizedCallers[caller] = authorized;
    }

    function setRouter(address _router) external onlyOwner {
        router = IPEClawRouter(_router);
    }

    function setNFA(address _nfa) external onlyOwner {
        nfa = _nfa;
    }

    // ============================================
    // INTERNAL
    // ============================================

    function _getDimensionValue(IPEClawRouter.LobsterState memory lob, uint8 dim) internal pure returns (uint8) {
        if (dim == 0) return lob.courage;
        if (dim == 1) return lob.wisdom;
        if (dim == 2) return lob.social;
        if (dim == 3) return lob.create;
        return lob.grit;
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

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
