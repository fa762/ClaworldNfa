/**
 * Upgrade GenesisVault using native fetch (bypasses ethers HTTP issues).
 *
 * Steps:
 *   1. Compile contract: npx hardhat compile
 *   2. Run: npx ts-node scripts/upgrade-vault-fetch.ts
 */
import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const RPC_URL = process.env.BSC_TESTNET_RPC || "https://bsc-testnet-rpc.publicnode.com";
const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const PROXY_ADDRESS = process.env.GENESIS_VAULT_ADDRESS || "0x6d176022759339da787fD3E2f1314019C3fb7867";

if (!PRIVATE_KEY) {
  throw new Error("Set PRIVATE_KEY in .env");
}

// Custom provider using native fetch
class FetchJsonRpcProvider extends ethers.providers.JsonRpcProvider {
  async send(method: string, params: Array<any>): Promise<any> {
    const payload = {
      jsonrpc: "2.0",
      id: this._nextId++,
      method,
      params,
    };

    const response = await fetch(this.connection.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json() as any;
    if (result.error) {
      const error = new Error(result.error.message);
      (error as any).code = result.error.code;
      (error as any).data = result.error.data;
      throw error;
    }
    return result.result;
  }
}

async function main() {
  const provider = new FetchJsonRpcProvider(RPC_URL, { chainId: 97, name: "bsc-testnet" });
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log("Upgrading with account:", wallet.address);
  console.log("Proxy address:", PROXY_ADDRESS);

  // Read compiled artifact
  const artifactPath = path.join(
    __dirname,
    "../artifacts/contracts/skills/GenesisVault.sol/GenesisVault.json"
  );
  if (!fs.existsSync(artifactPath)) {
    throw new Error("Artifact not found. Run 'npx hardhat compile' first.");
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));

  // Deploy new implementation
  console.log("Deploying new implementation...");
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const implContract = await factory.deploy();
  console.log("Waiting for deployment tx:", implContract.deployTransaction.hash);
  await implContract.deployed();
  console.log("New implementation deployed at:", implContract.address);

  // Call upgradeToAndCall on the proxy
  console.log("Upgrading proxy to new implementation...");
  const proxy = new ethers.Contract(
    PROXY_ADDRESS,
    ["function upgradeToAndCall(address newImplementation, bytes memory data) external"],
    wallet
  );
  const tx = await proxy.upgradeToAndCall(implContract.address, "0x");
  console.log("Upgrade tx:", tx.hash);
  await tx.wait();

  console.log("GenesisVault upgraded successfully!");
  console.log("New implementation:", implContract.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
