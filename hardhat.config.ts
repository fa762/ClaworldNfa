import { HardhatUserConfig, extendEnvironment } from "hardhat/config";
import "@nomiclabs/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
import "@openzeppelin/hardhat-upgrades";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "hardhat-contract-sizer";
import "solidity-coverage";
import * as dotenv from "dotenv";

dotenv.config();

// Use BSC testnet RPC URL from env or default
const bscTestnetUrl = process.env.BSC_TESTNET_RPC || "https://bsc-testnet-rpc.publicnode.com";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.26",
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    bscTestnet: {
      url: bscTestnetUrl,
      chainId: 97,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    bscMainnet: {
      url: "https://bsc-dataseed1.bnbchain.org",
      chainId: 56,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: false,
  },
};

export default config;
