// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPersonalityEngine {
    function evolvePersonality(uint256 nfaId, uint8 dimension, int8 delta) external;
    function getJobClass(uint256 nfaId) external view returns (uint8 jobClass, string memory jobName);
}
