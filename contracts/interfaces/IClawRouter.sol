// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IClawRouter {
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

    function initializeLobster(uint256 nfaId, LobsterState calldata state) external;
    function addCLW(uint256 nfaId, uint256 amount) external;
    function spendCLW(uint256 nfaId, uint256 amount) external;
    function payoutCLW(address to, uint256 amount) external;
    function addXP(uint256 nfaId, uint32 amount) external;
    function mutateDNA(uint256 nfaId, uint8 gene, uint8 newValue, bytes32 mutationData) external;
    function lobsters(uint256 nfaId) external view returns (
        uint8 rarity, uint8 shelter,
        uint8 courage, uint8 wisdom, uint8 social, uint8 create, uint8 grit,
        uint8 str, uint8 def, uint8 spd, uint8 vit,
        bytes32 mutation1, bytes32 mutation2,
        uint16 level, uint32 xp, uint64 lastUpkeepTime
    );
    function clwBalances(uint256 nfaId) external view returns (uint256);
}
