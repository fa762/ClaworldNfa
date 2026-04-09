export const ClawOracleActionHubViewABI = [
  {
    "inputs": [
      { "internalType": "uint256", "name": "nfaId", "type": "uint256" },
      { "internalType": "bytes32", "name": "protocolId", "type": "bytes32" },
      { "internalType": "uint256", "name": "cursor", "type": "uint256" },
      { "internalType": "uint256", "name": "limit", "type": "uint256" }
    ],
    "name": "getActionReceiptsByProtocol",
    "outputs": [
      {
        "components": [
          { "internalType": "uint256", "name": "requestId", "type": "uint256" },
          { "internalType": "uint256", "name": "nfaId", "type": "uint256" },
          { "internalType": "uint8", "name": "actionKind", "type": "uint8" },
          { "internalType": "bytes32", "name": "protocolId", "type": "bytes32" },
          { "internalType": "bytes32", "name": "spendAssetId", "type": "bytes32" },
          { "internalType": "uint8", "name": "status", "type": "uint8" },
          { "internalType": "address", "name": "requester", "type": "address" },
          { "internalType": "address", "name": "lastExecutor", "type": "address" },
          { "internalType": "uint8", "name": "resolvedChoice", "type": "uint8" },
          { "internalType": "bytes32", "name": "payloadHash", "type": "bytes32" },
          { "internalType": "bytes32", "name": "capabilityHash", "type": "bytes32" },
          { "internalType": "bytes32", "name": "executionRef", "type": "bytes32" },
          { "internalType": "bytes32", "name": "resultHash", "type": "bytes32" },
          { "internalType": "bytes32", "name": "receiptHash", "type": "bytes32" },
          { "internalType": "uint256", "name": "requestedSpend", "type": "uint256" },
          { "internalType": "uint256", "name": "actualSpend", "type": "uint256" },
          { "internalType": "uint256", "name": "clwCredit", "type": "uint256" },
          { "internalType": "uint32", "name": "xpCredit", "type": "uint32" },
          { "internalType": "uint64", "name": "createdAt", "type": "uint64" },
          { "internalType": "uint64", "name": "executedAt", "type": "uint64" },
          { "internalType": "uint32", "name": "retryCount", "type": "uint32" },
          { "internalType": "string", "name": "reasoningCid", "type": "string" },
          { "internalType": "string", "name": "lastError", "type": "string" }
        ],
        "internalType": "struct IClawOracleActionHubView.ActionReceipt[]",
        "name": "receipts",
        "type": "tuple[]"
      },
      { "internalType": "uint256", "name": "nextCursor", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "nfaId", "type": "uint256" }],
    "name": "getNfaLedger",
    "outputs": [
      { "internalType": "uint32", "name": "executedCount", "type": "uint32" },
      { "internalType": "uint32", "name": "failedCount", "type": "uint32" },
      { "internalType": "uint32", "name": "cancelledCount", "type": "uint32" },
      { "internalType": "uint32", "name": "expiredCount", "type": "uint32" },
      { "internalType": "uint256", "name": "totalActualSpend", "type": "uint256" },
      { "internalType": "uint256", "name": "totalClwCredit", "type": "uint256" },
      { "internalType": "uint32", "name": "totalXpCredit", "type": "uint32" },
      { "internalType": "uint64", "name": "lastUpdatedAt", "type": "uint64" },
      { "internalType": "bytes32", "name": "lastExecutionRef", "type": "bytes32" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;
