// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IFlapPortal {
    enum TokenStatus { Invalid, Tradable, InDuel, Killed, DEX }

    struct TokenStateV7 {
        uint8 status;
        uint256 reserve;
        uint256 circulatingSupply;
        uint256 price;
        uint8 tokenVersion;
        uint256 r;
        uint256 h;
        uint256 k;
        uint256 dexSupplyThresh;
        address quoteTokenAddress;
        bool nativeToQuoteSwapEnabled;
        bytes32 extensionID;
        uint256 taxRate;
        address pool;
        uint256 progress;
        uint8 lpFeeProfile;
        uint8 dexId;
    }

    function buy(
        address token,
        address recipient,
        uint256 minAmount
    ) external payable returns (uint256 amount);

    function sell(
        address token,
        uint256 amount,
        uint256 minEth
    ) external returns (uint256 eth);

    function previewBuy(
        address token,
        uint256 eth
    ) external view returns (uint256 amount);

    function previewSell(
        address token,
        uint256 amount
    ) external view returns (uint256 eth);

    function getTokenV7(
        address token
    ) external view returns (TokenStateV7 memory state);

    function getFeeRate()
        external
        view
        returns (uint256 buyFeeRate, uint256 sellFeeRate);
}
