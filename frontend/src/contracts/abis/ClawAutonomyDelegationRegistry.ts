export const ClawAutonomyDelegationRegistryABI = [
  {
    "inputs": [
      { "internalType": "uint256", "name": "nfaId", "type": "uint256" },
      { "internalType": "uint8", "name": "actionKind", "type": "uint8" },
      { "internalType": "address", "name": "operator", "type": "address" }
    ],
    "name": "getDelegationLease",
    "outputs": [
      { "internalType": "bool", "name": "enabled", "type": "bool" },
      { "internalType": "uint8", "name": "roleMask", "type": "uint8" },
      { "internalType": "uint64", "name": "issuedAt", "type": "uint64" },
      { "internalType": "uint64", "name": "expiresAt", "type": "uint64" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "nfaId", "type": "uint256" },
      { "internalType": "uint8", "name": "actionKind", "type": "uint8" },
      { "internalType": "address", "name": "operator", "type": "address" },
      { "internalType": "uint8", "name": "roleMask", "type": "uint8" }
    ],
    "name": "hasActiveLease",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "nfaId", "type": "uint256" },
      { "internalType": "uint8", "name": "actionKind", "type": "uint8" },
      { "internalType": "address", "name": "operator", "type": "address" },
      { "internalType": "uint8", "name": "roleMask", "type": "uint8" },
      { "internalType": "uint64", "name": "expiresAt", "type": "uint64" }
    ],
    "name": "setDelegationLease",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "nfaId", "type": "uint256" },
      { "internalType": "uint8", "name": "actionKind", "type": "uint8" },
      { "internalType": "address", "name": "operator", "type": "address" }
    ],
    "name": "revokeDelegationLease",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;
