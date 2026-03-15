// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./MockCLW.sol";

/**
 * @title MockPancakeRouter
 * @dev Simulates PancakeSwap V2 Router for local Hardhat tests.
 *      Swaps BNB for CLW at a fixed rate using MockCLW's mint().
 */
contract MockPancakeRouter {
    address public immutable WETH_ADDRESS;
    MockCLW public clwToken;
    uint256 public rate; // CLW per BNB (in wei, e.g. 1000e18 = 1000 CLW per 1 BNB)

    constructor(address _weth, address _clw, uint256 _rate) {
        WETH_ADDRESS = _weth;
        clwToken = MockCLW(_clw);
        rate = _rate;
    }

    function WETH() external view returns (address) {
        return WETH_ADDRESS;
    }

    function swapExactETHForTokens(
        uint256 /* amountOutMin */,
        address[] calldata path,
        address to,
        uint256 /* deadline */
    ) external payable returns (uint256[] memory amounts) {
        require(path.length >= 2, "Invalid path");
        require(msg.value > 0, "Zero BNB");

        uint256 clwAmount = msg.value * rate / 1e18;
        clwToken.mint(to, clwAmount);

        amounts = new uint256[](path.length);
        amounts[0] = msg.value;
        amounts[path.length - 1] = clwAmount;
    }

    function getAmountsOut(
        uint256 amountIn,
        address[] calldata path
    ) external view returns (uint256[] memory amounts) {
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        amounts[path.length - 1] = amountIn * rate / 1e18;
    }

    function setRate(uint256 _rate) external {
        rate = _rate;
    }
}
