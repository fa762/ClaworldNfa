export const ClawOracleActionHubABI = [
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "requestId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "nfaId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "uint8",
        "name": "actionKind",
        "type": "uint8"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "protocolId",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "spendAssetId",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "requester",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "payloadHash",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "spendAmount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint8",
        "name": "numChoices",
        "type": "uint8"
      }
    ],
    "name": "AutonomousActionRequested",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "nfaId",
        "type": "uint256"
      },
      {
        "internalType": "uint8",
        "name": "actionKind",
        "type": "uint8"
      },
      {
        "internalType": "bytes32",
        "name": "spendAssetId",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "spendAmount",
        "type": "uint256"
      },
      {
        "internalType": "bytes",
        "name": "payload",
        "type": "bytes"
      },
      {
        "internalType": "string",
        "name": "prompt",
        "type": "string"
      },
      {
        "internalType": "uint8",
        "name": "numChoices",
        "type": "uint8"
      }
    ],
    "name": "requestAutonomousAction",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "requestId",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;
