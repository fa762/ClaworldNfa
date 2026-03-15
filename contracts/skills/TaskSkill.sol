// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

interface ITaskRouter {
    function addCLW(uint256 nfaId, uint256 amount) external;
    function addXP(uint256 nfaId, uint32 amount) external;
}

interface ITaskWorldState {
    function rewardMultiplier() external view returns (uint256);
}

/**
 * @title TaskSkill
 * @dev Task completion handler. Called by oracle fulfillment or backend operator
 *      to distribute XP and CLW rewards based on task performance.
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
     * @param matchScore Match quality score in basis points (0-10000)
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

    function setOperator(address operator, bool authorized) external onlyOwner {
        operators[operator] = authorized;
        emit OperatorUpdated(operator, authorized);
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
