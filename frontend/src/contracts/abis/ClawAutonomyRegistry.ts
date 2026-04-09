export const ClawAutonomyRegistryABI = [
  {
    "inputs": [
      { "internalType": "uint256", "name": "nfaId", "type": "uint256" },
      { "internalType": "uint8", "name": "actionKind", "type": "uint8" }
    ],
    "name": "getPolicy",
    "outputs": [
      { "internalType": "bool", "name": "enabled", "type": "bool" },
      { "internalType": "uint8", "name": "riskMode", "type": "uint8" },
      { "internalType": "uint32", "name": "dailyLimit", "type": "uint32" },
      { "internalType": "uint32", "name": "actionsUsed", "type": "uint32" },
      { "internalType": "uint64", "name": "windowStart", "type": "uint64" },
      { "internalType": "uint256", "name": "maxClwPerAction", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "nfaId", "type": "uint256" },
      { "internalType": "uint8", "name": "actionKind", "type": "uint8" },
      { "internalType": "bool", "name": "enabled", "type": "bool" },
      { "internalType": "uint8", "name": "riskMode", "type": "uint8" },
      { "internalType": "uint32", "name": "dailyLimit", "type": "uint32" },
      { "internalType": "uint256", "name": "maxClwPerAction", "type": "uint256" }
    ],
    "name": "setPolicy",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "nfaId", "type": "uint256" },
      { "internalType": "uint8", "name": "actionKind", "type": "uint8" }
    ],
    "name": "getRiskState",
    "outputs": [
      { "internalType": "bool", "name": "emergencyPaused", "type": "bool" },
      { "internalType": "uint32", "name": "maxFailureStreak", "type": "uint32" },
      { "internalType": "uint32", "name": "failureStreak", "type": "uint32" },
      { "internalType": "uint32", "name": "totalActions", "type": "uint32" },
      { "internalType": "uint32", "name": "totalFailures", "type": "uint32" },
      { "internalType": "uint64", "name": "lastActionAt", "type": "uint64" },
      { "internalType": "uint256", "name": "minClwReserve", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "nfaId", "type": "uint256" },
      { "internalType": "bytes32", "name": "protocolId", "type": "bytes32" }
    ],
    "name": "isProtocolApproved",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "nfaId", "type": "uint256" },
      { "internalType": "uint8", "name": "actionKind", "type": "uint8" },
      { "internalType": "address", "name": "adapter", "type": "address" }
    ],
    "name": "isAdapterApproved",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "nfaId", "type": "uint256" },
      { "internalType": "uint8", "name": "actionKind", "type": "uint8" },
      { "internalType": "address", "name": "operator", "type": "address" }
    ],
    "name": "isOperatorApproved",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "nfaId", "type": "uint256" },
      { "internalType": "uint8", "name": "actionKind", "type": "uint8" },
      { "internalType": "address", "name": "operator", "type": "address" }
    ],
    "name": "getOperatorRoleMask",
    "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "nfaId", "type": "uint256" },
      { "internalType": "bytes32", "name": "protocolId", "type": "bytes32" },
      { "internalType": "bool", "name": "approved", "type": "bool" }
    ],
    "name": "setApprovedProtocol",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "nfaId", "type": "uint256" },
      { "internalType": "uint8", "name": "actionKind", "type": "uint8" },
      { "internalType": "address", "name": "adapter", "type": "address" },
      { "internalType": "bool", "name": "approved", "type": "bool" }
    ],
    "name": "setApprovedAdapter",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "nfaId", "type": "uint256" },
      { "internalType": "uint8", "name": "actionKind", "type": "uint8" },
      { "internalType": "address", "name": "operator", "type": "address" },
      { "internalType": "bool", "name": "approved", "type": "bool" }
    ],
    "name": "setApprovedOperator",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "nfaId", "type": "uint256" },
      { "internalType": "uint8", "name": "actionKind", "type": "uint8" },
      { "internalType": "address", "name": "operator", "type": "address" },
      { "internalType": "uint8", "name": "roleMask", "type": "uint8" }
    ],
    "name": "setOperatorRoleMask",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "nfaId", "type": "uint256" },
      { "internalType": "uint8", "name": "actionKind", "type": "uint8" },
      { "internalType": "uint32", "name": "maxFailureStreak", "type": "uint32" },
      { "internalType": "uint256", "name": "minClwReserve", "type": "uint256" }
    ],
    "name": "setRiskControls",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "nfaId", "type": "uint256" },
      { "internalType": "uint8", "name": "actionKind", "type": "uint8" },
      { "internalType": "bool", "name": "paused", "type": "bool" }
    ],
    "name": "setEmergencyPause",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;
