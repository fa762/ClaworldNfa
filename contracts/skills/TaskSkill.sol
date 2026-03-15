// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

interface ITaskRouter {
    function addCLW(uint256 nfaId, uint256 amount) external;
    function addXP(uint256 nfaId, uint32 amount) external;
    function evolvePersonality(uint256 nfaId, uint8 dimension, int8 delta) external;
}

interface ITaskWorldState {
    function rewardMultiplier() external view returns (uint256);
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

        // Calculate actual CLW reward:
        // actualCLW = clwReward × matchScore/10000 × worldState.rewardMultiplier/10000
        uint256 worldMul = worldState.rewardMultiplier();
        uint256 actualClw = clwReward * uint256(matchScore) / 10000 * worldMul / 10000;

        if (actualClw > 0) {
            router.addCLW(nfaId, actualClw);
        }

        if (xpReward > 0) {
            router.addXP(nfaId, xpReward);
        }

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
        uint256 actualClw = clwReward * uint256(matchScore) / 10000 * worldMul / 10000;

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

        emit TaskCompleted(nfaId, xpReward, clwReward, actualClw, matchScore);
    }

    function setOperator(address operator, bool authorized) external onlyOwner {
        operators[operator] = authorized;
        emit OperatorUpdated(operator, authorized);
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
