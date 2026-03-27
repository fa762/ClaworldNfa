export const ClawOracleABI = [
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "previousAdmin",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "newAdmin",
        "type": "address"
      }
    ],
    "name": "AdminChanged",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "beacon",
        "type": "address"
      }
    ],
    "name": "BeaconUpgraded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "fulfiller",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "bool",
        "name": "authorized",
        "type": "bool"
      }
    ],
    "name": "FulfillerUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint8",
        "name": "version",
        "type": "uint8"
      }
    ],
    "name": "Initialized",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "previousOwner",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "OwnershipTransferred",
    "type": "event"
  },
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
        "indexed": false,
        "internalType": "uint8",
        "name": "choice",
        "type": "uint8"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "reasoningCid",
        "type": "string"
      }
    ],
    "name": "ReasoningFulfilled",
    "type": "event"
  },
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
        "indexed": false,
        "internalType": "address",
        "name": "consumer",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "prompt",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "uint8",
        "name": "numOfChoices",
        "type": "uint8"
      }
    ],
    "name": "ReasoningRequested",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "implementation",
        "type": "address"
      }
    ],
    "name": "Upgraded",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "REQUEST_TIMEOUT",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "requestId",
        "type": "uint256"
      }
    ],
    "name": "expireRequest",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "requestId",
        "type": "uint256"
      },
      {
        "internalType": "uint8",
        "name": "choice",
        "type": "uint8"
      },
      {
        "internalType": "string",
        "name": "reasoningCid",
        "type": "string"
      }
    ],
    "name": "fulfillReasoning",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "fulfillers",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "requestId",
        "type": "uint256"
      }
    ],
    "name": "getRequest",
    "outputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "nfaId",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "consumer",
            "type": "address"
          },
          {
            "internalType": "string",
            "name": "prompt",
            "type": "string"
          },
          {
            "internalType": "uint8",
            "name": "numOfChoices",
            "type": "uint8"
          },
          {
            "internalType": "uint8",
            "name": "choice",
            "type": "uint8"
          },
          {
            "internalType": "string",
            "name": "reasoningCid",
            "type": "string"
          },
          {
            "internalType": "enum ClawOracle.RequestStatus",
            "name": "status",
            "type": "uint8"
          },
          {
            "internalType": "uint64",
            "name": "timestamp",
            "type": "uint64"
          }
        ],
        "internalType": "struct ClawOracle.OracleRequest",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "initialize",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "proxiableUUID",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "nfaId",
        "type": "uint256"
      },
      {
        "internalType": "string",
        "name": "prompt",
        "type": "string"
      },
      {
        "internalType": "uint8",
        "name": "numOfChoices",
        "type": "uint8"
      }
    ],
    "name": "reason",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "renounceOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "requests",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "nfaId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "consumer",
        "type": "address"
      },
      {
        "internalType": "string",
        "name": "prompt",
        "type": "string"
      },
      {
        "internalType": "uint8",
        "name": "numOfChoices",
        "type": "uint8"
      },
      {
        "internalType": "uint8",
        "name": "choice",
        "type": "uint8"
      },
      {
        "internalType": "string",
        "name": "reasoningCid",
        "type": "string"
      },
      {
        "internalType": "enum ClawOracle.RequestStatus",
        "name": "status",
        "type": "uint8"
      },
      {
        "internalType": "uint64",
        "name": "timestamp",
        "type": "uint64"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "fulfiller",
        "type": "address"
      },
      {
        "internalType": "bool",
        "name": "authorized",
        "type": "bool"
      }
    ],
    "name": "setFulfiller",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "transferOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "newImplementation",
        "type": "address"
      }
    ],
    "name": "upgradeTo",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "newImplementation",
        "type": "address"
      },
      {
        "internalType": "bytes",
        "name": "data",
        "type": "bytes"
      }
    ],
    "name": "upgradeToAndCall",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  }
] as const;
