// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title WorldState
 * @dev Global game rule engine. Stores world parameters that
 *      influence rewards, costs, PK stakes, and mutation rates.
 */
contract WorldState is OwnableUpgradeable, UUPSUpgradeable {

    // All values in basis points (10000 = 1.0x)
    uint256 public rewardMultiplier;
    uint256 public pkStakeLimit;
    uint256 public mutationBonus;
    uint256 public dailyCostMultiplier;
    bytes32 public activeEvents;

    event WorldStateUpdated(
        uint256 rewardMultiplier,
        uint256 pkStakeLimit,
        uint256 mutationBonus,
        uint256 dailyCostMultiplier,
        bytes32 activeEvents
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();

        rewardMultiplier = 10000;     // 1.0x
        pkStakeLimit = 1000 ether;    // 1000 CLW max stake
        mutationBonus = 10000;        // 1.0x
        dailyCostMultiplier = 10000;  // 1.0x
        activeEvents = bytes32(0);
    }

    function updateWorldState(
        uint256 _rewardMul,
        uint256 _pkLimit,
        uint256 _mutBonus,
        uint256 _costMul,
        bytes32 _events
    ) external onlyOwner {
        rewardMultiplier = _rewardMul;
        pkStakeLimit = _pkLimit;
        mutationBonus = _mutBonus;
        dailyCostMultiplier = _costMul;
        activeEvents = _events;

        emit WorldStateUpdated(_rewardMul, _pkLimit, _mutBonus, _costMul, _events);
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
