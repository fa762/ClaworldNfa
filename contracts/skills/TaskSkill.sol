// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

interface ITaskRouter {
    function addCLW(uint256 nfaId, uint256 amount) external;
    function addXP(uint256 nfaId, uint32 amount) external;
    function evolvePersonality(uint256 nfaId, uint8 dimension, int8 delta) external;
    function lobsters(uint256 nfaId) external view returns (
        uint8 rarity, uint8 shelter,
        uint8 courage, uint8 wisdom, uint8 social, uint8 create, uint8 grit,
        uint8 str, uint8 def, uint8 spd, uint8 vit,
        bytes32 mutation1, bytes32 mutation2,
        uint16 level, uint32 xp, uint64 lastUpkeepTime
    );
}

interface ITaskWorldState {
    function rewardMultiplier() external view returns (uint256);
}

interface ITaskNFA {
    function ownerOf(uint256 tokenId) external view returns (address);
}

/**
 * @title TaskSkill
 * @dev Task completion handler. Called by oracle fulfillment or backend operator
 *      to distribute XP and CLW rewards based on task performance.
 *      Also triggers personality evolution based on task type matching.
 *
 *      Task types map to personality dimensions:
 *      0=courage (combat/exploration tasks), 1=wisdom (research/analysis),
 *      2=social (diplomacy/trading), 3=create (building/crafting), 4=grit (endurance/grinding)
 */
contract TaskSkill is OwnableUpgradeable, UUPSUpgradeable {

    ITaskRouter public router;
    ITaskWorldState public worldState;

    // Authorized operators (oracle callback or backend)
    mapping(address => bool) public operators;

    // --- New fields (appended after original storage layout) ---
    ITaskNFA public nfa;
    // Per-NFA daily task cooldown (tokenId => last completion timestamp)
    mapping(uint256 => uint256) public lastTaskTime;

    // ─── NFA Stats (履历) ───
    mapping(uint256 => uint32) public taskCount;         // total tasks completed
    mapping(uint256 => uint256) public totalClwEarned;    // total CLW earned from tasks
    mapping(uint256 => uint32) public taskTypeCount0;     // courage tasks
    mapping(uint256 => uint32) public taskTypeCount1;     // wisdom tasks
    mapping(uint256 => uint32) public taskTypeCount2;     // social tasks
    mapping(uint256 => uint32) public taskTypeCount3;     // create tasks
    mapping(uint256 => uint32) public taskTypeCount4;     // grit tasks

    // Anti-spam: diminishing returns for consecutive same-type tasks (added after stats)
    mapping(uint256 => uint8) public lastTaskType;      // nfaId => last task type
    mapping(uint256 => uint8) public sameTypeStreak;    // nfaId => consecutive same-type count

    event TaskStatsUpdated(uint256 indexed nfaId, uint32 totalTasks, uint256 totalEarned);

    event TaskCompleted(
        uint256 indexed nfaId,
        uint32 xpReward,
        uint256 clwReward,
        uint256 actualClw,
        uint16 matchScore
    );
    event TaskPersonalityDrift(uint256 indexed nfaId, uint8 taskType, int8 delta);
    event OperatorUpdated(address operator, bool authorized);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _router, address _worldState) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();

        router = ITaskRouter(_router);
        worldState = ITaskWorldState(_worldState);
    }

    /**
     * @dev Complete a task and distribute rewards.
     * @param nfaId    Lobster NFA ID
     * @param xpReward Base XP reward
     * @param clwReward Base CLW reward (18 decimals)
     * @param matchScore Match quality score in basis points (0-20000)
     */
    function completeTask(
        uint256 nfaId,
        uint32 xpReward,
        uint256 clwReward,
        uint16 matchScore
    ) external {
        require(operators[msg.sender], "Not authorized operator");
        require(matchScore <= 20000, "Score too high"); // Allow up to 2x
        require(clwReward <= 10000 * 1e18, "CLW cap exceeded");
        require(xpReward <= 500, "XP cap exceeded");

        // Calculate actual CLW reward:
        // actualCLW = clwReward × matchScore/10000 × worldState.rewardMultiplier/10000
        uint256 worldMul = worldState.rewardMultiplier();
        uint256 actualClw = (clwReward * uint256(matchScore) * worldMul) / (10000 * 10000);

        if (actualClw > 0) {
            router.addCLW(nfaId, actualClw);
        }

        if (xpReward > 0) {
            router.addXP(nfaId, xpReward);
        }

        _trackTaskStats(nfaId, 0, actualClw); // default to courage for untyped tasks
        emit TaskCompleted(nfaId, xpReward, clwReward, actualClw, matchScore);
    }

    /**
     * @dev Complete a typed task — distributes rewards AND triggers personality evolution.
     * @param nfaId       Lobster NFA ID
     * @param taskType    Task type matching personality dimension (0-4)
     * @param xpReward    Base XP reward
     * @param clwReward   Base CLW reward (18 decimals)
     * @param matchScore  Match quality score in basis points (0-20000)
     */
    function completeTypedTask(
        uint256 nfaId,
        uint8 taskType,
        uint32 xpReward,
        uint256 clwReward,
        uint16 matchScore
    ) external {
        require(operators[msg.sender], "Not authorized operator");
        require(matchScore <= 20000, "Score too high");
        require(taskType <= 4, "Invalid task type");

        // Calculate rewards (same formula)
        uint256 worldMul = worldState.rewardMultiplier();
        uint256 actualClw = (clwReward * uint256(matchScore) * worldMul) / (10000 * 10000);

        if (actualClw > 0) {
            router.addCLW(nfaId, actualClw);
        }

        if (xpReward > 0) {
            router.addXP(nfaId, xpReward);
        }

        // Personality drift: +1 to matching dimension when matchScore >= 1.0x (10000)
        // This allows gradual specialization through consistent task completion
        if (matchScore >= 10000) {
            router.evolvePersonality(nfaId, taskType, int8(1));
            emit TaskPersonalityDrift(nfaId, taskType, int8(1));
        }

        _trackTaskStats(nfaId, taskType, actualClw);
        emit TaskCompleted(nfaId, xpReward, clwReward, actualClw, matchScore);
    }

    /**
     * @dev Owner-callable task completion — NFA owner submits directly, no operator needed.
     *      matchScore is calculated ON-CHAIN from personality, not player-supplied.
     *      Capped rewards: max 50 XP, max 100 CLW base per task, 1 task per 4 hours.
     */
    function ownerCompleteTypedTask(
        uint256 nfaId,
        uint8 taskType,
        uint32 xpReward,
        uint256 clwReward,
        uint16 /* matchScore — IGNORED, calculated on-chain */
    ) external {
        require(nfa.ownerOf(nfaId) == msg.sender, "Not NFA owner");
        require(taskType <= 4, "Invalid task type");
        require(xpReward <= 50, "XP cap exceeded");
        require(clwReward <= 100 * 1e18, "CLW cap exceeded");
        require(block.timestamp >= lastTaskTime[nfaId] + 4 hours, "Cooldown active");

        // Calculate matchScore from on-chain personality — player can't fake it
        uint16 matchScore;
        {
            (,,uint8 courage, uint8 wisdom, uint8 social, uint8 create, uint8 grit,,,,,,,,,) = router.lobsters(nfaId);
            uint8 pVal;
            if (taskType == 0) pVal = courage;
            else if (taskType == 1) pVal = wisdom;
            else if (taskType == 2) pVal = social;
            else if (taskType == 3) pVal = create;
            else pVal = grit;
            matchScore = uint16(pVal) * 200; // 0-20000
        }

        lastTaskTime[nfaId] = block.timestamp;

        // Track consecutive same-type streak → diminishing returns
        if (sameTypeStreak[nfaId] > 0 && lastTaskType[nfaId] == taskType) {
            sameTypeStreak[nfaId]++;
        } else {
            sameTypeStreak[nfaId] = 1;
        }
        lastTaskType[nfaId] = taskType;

        // Streak decay: 1=100%, 2=80%, 3=60%, 4+=50%
        uint256 streakMul = 10000;
        if (sameTypeStreak[nfaId] == 2) streakMul = 8000;
        else if (sameTypeStreak[nfaId] == 3) streakMul = 6000;
        else if (sameTypeStreak[nfaId] >= 4) streakMul = 5000;

        uint256 worldMul = worldState.rewardMultiplier();
        uint256 actualClw = (clwReward * uint256(matchScore) * worldMul * streakMul) / (10000 * 10000 * 10000);

        if (actualClw > 0) {
            router.addCLW(nfaId, actualClw);
        }
        if (xpReward > 0) {
            router.addXP(nfaId, xpReward);
        }
        if (matchScore >= 10000) {
            router.evolvePersonality(nfaId, taskType, int8(1));
            emit TaskPersonalityDrift(nfaId, taskType, int8(1));
        }

        _trackTaskStats(nfaId, taskType, actualClw);
        emit TaskCompleted(nfaId, xpReward, clwReward, actualClw, matchScore);
    }

    /**
     * @dev Set NFA contract address (for owner verification). Only callable once or by owner.
     */
    function setNFA(address _nfa) external onlyOwner {
        nfa = ITaskNFA(_nfa);
    }

    function setOperator(address operator, bool authorized) external onlyOwner {
        operators[operator] = authorized;
        emit OperatorUpdated(operator, authorized);
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    // ─── Stats tracking ───

    function _trackTaskStats(uint256 nfaId, uint8 taskType, uint256 clwEarned) internal {
        taskCount[nfaId]++;
        totalClwEarned[nfaId] += clwEarned;
        if (taskType == 0) taskTypeCount0[nfaId]++;
        else if (taskType == 1) taskTypeCount1[nfaId]++;
        else if (taskType == 2) taskTypeCount2[nfaId]++;
        else if (taskType == 3) taskTypeCount3[nfaId]++;
        else if (taskType == 4) taskTypeCount4[nfaId]++;
    }

    /**
     * @dev View NFA task stats (履历)
     */
    function getTaskStats(uint256 nfaId) external view returns (
        uint32 total, uint256 clwEarned,
        uint32 courage, uint32 wisdom, uint32 social, uint32 create, uint32 grit
    ) {
        return (
            taskCount[nfaId], totalClwEarned[nfaId],
            taskTypeCount0[nfaId], taskTypeCount1[nfaId],
            taskTypeCount2[nfaId], taskTypeCount3[nfaId], taskTypeCount4[nfaId]
        );
    }

    /**
     * @dev Reserved storage gap for future upgrades.
     */
    uint256[31] private __gap;
}
