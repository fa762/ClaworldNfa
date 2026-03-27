import { HardhatUserConfig } from "hardhat/config";
import "@nomiclabs/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
import "@openzeppelin/hardhat-upgrades";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "hardhat-contract-sizer";
import "solidity-coverage";
import * as dotenv from "dotenv";

dotenv.config();

// Proxy support for BSC testnet/mainnet deployments
// Set HTTP_PROXY=http://127.0.0.1:59527 in .env to enable
let proxyAgent: any = undefined;
if (process.env.HTTP_PROXY) {
  const { HttpsProxyAgent } = require("https-proxy-agent");
  const http = require("http");
  const https = require("https");
  proxyAgent = new HttpsProxyAgent(process.env.HTTP_PROXY);
  http.globalAgent = proxyAgent;
  https.globalAgent = proxyAgent;
}


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
      url: process.env.BSC_TESTNET_RPC || "https://bsc-testnet.bnbchain.org",
      chainId: 97,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      timeout: 120000,
      httpHeaders: {},
      ...(proxyAgent ? { httpAgent: proxyAgent, httpsAgent: proxyAgent } : {}),
    },
    bscMainnet: {
      url: process.env.BSC_MAINNET_RPC || "https://bsc-dataseed1.bnbchain.org",
      chainId: 56,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      timeout: 120000,
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
import { subtask } from "hardhat/config";
import { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } from "hardhat/builtin-tasks/task-names";
import path from "path";

subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, async (args: any) => {
  const compilerPath = path.join(
    process.env.USERPROFILE || "",
    ".cache", "hardhat-nodejs", "compilers-v2", "wasm",
    "soljson-v0.8.26+commit.8a97fa7a.js"
  );
  return {
    version: args.solcVersion,
    longVersion: "0.8.26+commit.8a97fa7a",
    compilerPath,
    isSolcJs: true,
  };
});

export default config;
