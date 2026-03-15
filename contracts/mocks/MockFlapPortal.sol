// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./MockCLW.sol";

/**
 * @title MockFlapPortal
 * @dev Simulates Flap bonding curve portal for local Hardhat tests.
 *      Mints CLW at a fixed rate when BNB is received.
 */
contract MockFlapPortal {
    MockCLW public clwToken;
    uint256 public rate; // CLW per BNB (in wei)

    constructor(address _clw, uint256 _rate) {
        clwToken = MockCLW(_clw);
        rate = _rate;
    }

    function buy(
        address /* token */,
        address recipient,
        uint256 /* minAmount */
    ) external payable returns (uint256 amount) {
        require(msg.value > 0, "Zero BNB");
        amount = msg.value * rate / 1e18;
        clwToken.mint(recipient, amount);
    }

    function previewBuy(
        address /* token */,
        uint256 eth
    ) external view returns (uint256 amount) {
        return eth * rate / 1e18;
    }

    function sell(
        address /* token */,
        uint256 /* amount */,
        uint256 /* minEth */
    ) external pure returns (uint256) {
        revert("Not implemented in mock");
    }

    function previewSell(
        address /* token */,
        uint256 /* amount */
    ) external pure returns (uint256) {
        return 0;
    }

    function setRate(uint256 _rate) external {
        rate = _rate;
    }
}
