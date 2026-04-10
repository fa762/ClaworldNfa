// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockAutonomyRouter {
    struct MockLobster {
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

    mapping(uint256 => uint256) public clwBalances;
    mapping(uint256 => uint32) public xpBalances;
    mapping(uint256 => uint256) public dailyCosts;
    mapping(uint256 => MockLobster) private _lobsters;

    function setClwBalance(uint256 nfaId, uint256 amount) external {
        clwBalances[nfaId] = amount;
    }

    function setDailyCost(uint256 nfaId, uint256 amount) external {
        dailyCosts[nfaId] = amount;
    }

    function setLobsterProfile(
        uint256 nfaId,
        uint8 courage,
        uint8 wisdom,
        uint8 social,
        uint8 create,
        uint8 grit
    ) external {
        _lobsters[nfaId].courage = courage;
        _lobsters[nfaId].wisdom = wisdom;
        _lobsters[nfaId].social = social;
        _lobsters[nfaId].create = create;
        _lobsters[nfaId].grit = grit;
    }

    function setLobsterCombat(
        uint256 nfaId,
        uint8 str,
        uint8 def,
        uint8 spd,
        uint8 vit
    ) external {
        _lobsters[nfaId].str = str;
        _lobsters[nfaId].def = def;
        _lobsters[nfaId].spd = spd;
        _lobsters[nfaId].vit = vit;
    }

    function setLobsterMeta(
        uint256 nfaId,
        uint8 rarity,
        uint8 shelter,
        uint16 level
    ) external {
        _lobsters[nfaId].rarity = rarity;
        _lobsters[nfaId].shelter = shelter;
        _lobsters[nfaId].level = level;
    }

    function addCLW(uint256 nfaId, uint256 amount) external {
        clwBalances[nfaId] += amount;
    }

    function spendCLW(uint256 nfaId, uint256 amount) external {
        require(clwBalances[nfaId] >= amount, "Insufficient CLW");
        clwBalances[nfaId] -= amount;
    }

    function addXP(uint256 nfaId, uint32 amount) external {
        xpBalances[nfaId] += amount;
        _lobsters[nfaId].xp += amount;
    }

    function mutateDNA(uint256, uint8, uint8, bytes32) external {
        // No-op for autonomy tests that don't need full mutation persistence.
    }

    function evolvePersonality(uint256 nfaId, uint8 dimension, int8 delta) external {
        uint8 current = _getPersonality(nfaId, dimension);
        int256 updated = int256(uint256(current)) + int256(delta);
        if (updated < 0) {
            updated = 0;
        } else if (updated > 100) {
            updated = 100;
        }

        _setPersonality(nfaId, dimension, uint8(uint256(updated)));
    }

    function lobsters(uint256 nfaId) external view returns (
        uint8 rarity,
        uint8 shelter,
        uint8 courage,
        uint8 wisdom,
        uint8 social,
        uint8 create,
        uint8 grit,
        uint8 str,
        uint8 def,
        uint8 spd,
        uint8 vit,
        bytes32 mutation1,
        bytes32 mutation2,
        uint16 level,
        uint32 xp,
        uint64 lastUpkeepTime
    ) {
        MockLobster storage lobster = _lobsters[nfaId];
        return (
            lobster.rarity,
            lobster.shelter,
            lobster.courage,
            lobster.wisdom,
            lobster.social,
            lobster.create,
            lobster.grit,
            lobster.str,
            lobster.def,
            lobster.spd,
            lobster.vit,
            lobster.mutation1,
            lobster.mutation2,
            lobster.level,
            lobster.xp,
            lobster.lastUpkeepTime
        );
    }

    function autonomyBalanceOf(uint256 nfaId) external view returns (uint256) {
        return clwBalances[nfaId];
    }

    function getDailyCost(uint256 nfaId) external view returns (uint256) {
        return dailyCosts[nfaId];
    }

    function _getPersonality(uint256 nfaId, uint8 dimension) private view returns (uint8) {
        MockLobster storage lobster = _lobsters[nfaId];
        if (dimension == 0) return lobster.courage;
        if (dimension == 1) return lobster.wisdom;
        if (dimension == 2) return lobster.social;
        if (dimension == 3) return lobster.create;
        if (dimension == 4) return lobster.grit;
        revert("Bad dimension");
    }

    function _setPersonality(uint256 nfaId, uint8 dimension, uint8 value) private {
        if (dimension == 0) _lobsters[nfaId].courage = value;
        else if (dimension == 1) _lobsters[nfaId].wisdom = value;
        else if (dimension == 2) _lobsters[nfaId].social = value;
        else if (dimension == 3) _lobsters[nfaId].create = value;
        else if (dimension == 4) _lobsters[nfaId].grit = value;
        else revert("Bad dimension");
    }
}
