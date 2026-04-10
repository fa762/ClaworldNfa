// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IClawActionAdapter
 * @dev Generic adapter interface for autonomous NFA actions.
 *      Oracle chooses what to do; an adapter handles how to execute it.
 */
interface IClawActionAdapter {
    struct ActionExecutionResult {
        bytes32 executionRef;
        bytes32 spendAssetId;
        uint256 actualSpend;
        uint256 clwCredit;
        uint32 xpCredit;
    }

    function executeAutonomousAction(
        uint256 requestId,
        uint256 nfaId,
        uint8 actionKind,
        uint8 choice,
        bytes32 spendAssetId,
        uint256 spendAmount,
        bytes calldata payload,
        string calldata reasoningCid
    ) external returns (ActionExecutionResult memory result);
}
