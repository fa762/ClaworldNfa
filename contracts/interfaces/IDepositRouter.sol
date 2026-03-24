// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IDepositRouter {
    function buyAndDeposit(uint256 nfaId) external payable;
    function flapBuyAndDeposit(uint256 nfaId) external payable;
    function previewFlapBuy(uint256 bnbAmount) external view returns (uint256);
}
