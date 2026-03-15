// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

interface IPancakePair {
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function token0() external view returns (address);
}

/**
 * @title WorldState
 * @dev Global game rule engine. Stores world parameters that
 *      influence rewards, costs, PK stakes, and mutation rates.
 *      Supports automatic updates from on-chain price data.
 */
contract WorldState is OwnableUpgradeable, UUPSUpgradeable {

    // All values in basis points (10000 = 1.0x)
    uint256 public rewardMultiplier;
    uint256 public pkStakeLimit;
    uint256 public mutationBonus;
    uint256 public dailyCostMultiplier;
    bytes32 public activeEvents;

    // Price-based auto-update configuration
    address public pancakePair;    // CLW/WBNB pair
    address public clwToken;

    // Price thresholds (in wei per CLW, 18 decimals)
    uint256 public priceThresholdHigh;  // Above this → prosperity mode
    uint256 public priceThresholdLow;   // Below this → austerity mode

    // World event flags (bit positions in activeEvents)
    bytes32 public constant EVENT_BUBBLE = bytes32(uint256(1));       // 泡沫事件
    bytes32 public constant EVENT_WINTER = bytes32(uint256(2));       // 经济寒冬
    bytes32 public constant EVENT_GOLDEN_AGE = bytes32(uint256(4));   // 黄金时代

    // Authorized keepers who can call autoUpdate
    mapping(address => bool) public keepers;

    uint64 public lastAutoUpdate;

    event WorldStateUpdated(
        uint256 rewardMultiplier,
        uint256 pkStakeLimit,
        uint256 mutationBonus,
        uint256 dailyCostMultiplier,
        bytes32 activeEvents
    );
    event AutoUpdateTriggered(uint256 clwPrice, address keeper);
    event KeeperUpdated(address keeper, bool authorized);

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

        // Default thresholds
        priceThresholdHigh = 0.001 ether;  // 0.001 BNB per CLW
        priceThresholdLow = 0.0001 ether;  // 0.0001 BNB per CLW
    }

    // ============================================
    // MANUAL UPDATE (owner only)
    // ============================================

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

    // ============================================
    // AUTOMATIC UPDATE (from on-chain price data)
    // ============================================

    /**
     * @dev Auto-update world state based on CLW/BNB price from PancakeSwap.
     *      Callable by keepers or owner. Rate-limited to once per hour.
     */
    function autoUpdate() external {
        require(
            keepers[msg.sender] || msg.sender == owner(),
            "Not authorized"
        );
        require(
            block.timestamp >= lastAutoUpdate + 1 hours,
            "Too frequent"
        );
        require(pancakePair != address(0), "Pair not set");

        lastAutoUpdate = uint64(block.timestamp);

        uint256 price = _getCLWPrice();

        if (price >= priceThresholdHigh) {
            // Prosperity / bubble mode: reduce rewards, increase costs
            rewardMultiplier = 8000;      // 0.8x rewards
            dailyCostMultiplier = 12000;  // 1.2x costs
            mutationBonus = 15000;        // 1.5x mutation rate
            activeEvents = EVENT_BUBBLE;
        } else if (price <= priceThresholdLow) {
            // Austerity / winter mode: increase rewards, reduce costs
            rewardMultiplier = 15000;     // 1.5x rewards
            dailyCostMultiplier = 8000;   // 0.8x costs
            mutationBonus = 8000;         // 0.8x mutation rate
            pkStakeLimit = 500 ether;     // Lower stake limit
            activeEvents = EVENT_WINTER;
        } else {
            // Normal mode
            rewardMultiplier = 10000;
            dailyCostMultiplier = 10000;
            mutationBonus = 10000;
            pkStakeLimit = 1000 ether;
            activeEvents = bytes32(0);
        }

        emit AutoUpdateTriggered(price, msg.sender);
        emit WorldStateUpdated(rewardMultiplier, pkStakeLimit, mutationBonus, dailyCostMultiplier, activeEvents);
    }

    /**
     * @dev Get CLW price in BNB from PancakeSwap pair reserves.
     *      Returns price with 18 decimal precision.
     */
    function _getCLWPrice() internal view returns (uint256) {
        (uint112 reserve0, uint112 reserve1, ) = IPancakePair(pancakePair).getReserves();
        address token0 = IPancakePair(pancakePair).token0();

        if (token0 == clwToken) {
            // reserve0 = CLW, reserve1 = WBNB
            // price = WBNB / CLW
            return reserve0 > 0 ? uint256(reserve1) * 1e18 / uint256(reserve0) : 0;
        } else {
            // reserve0 = WBNB, reserve1 = CLW
            return reserve1 > 0 ? uint256(reserve0) * 1e18 / uint256(reserve1) : 0;
        }
    }

    /**
     * @dev Public view to get current CLW price.
     */
    function getCLWPrice() external view returns (uint256) {
        if (pancakePair == address(0)) return 0;
        return _getCLWPrice();
    }

    // ============================================
    // ADMIN
    // ============================================

    function setPancakePair(address _pair) external onlyOwner {
        pancakePair = _pair;
    }

    function setCLWToken(address _token) external onlyOwner {
        clwToken = _token;
    }

    function setThresholds(uint256 _high, uint256 _low) external onlyOwner {
        require(_high > _low, "High must exceed low");
        priceThresholdHigh = _high;
        priceThresholdLow = _low;
    }

    function setKeeper(address keeper, bool authorized) external onlyOwner {
        keepers[keeper] = authorized;
        emit KeeperUpdated(keeper, authorized);
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
