import "dotenv/config";

import { ethers } from "hardhat";
import { revealBattleRoyaleIfReady } from "../openclaw/battleRoyaleRevealWatcher";

const PROXY = process.env.BATTLE_ROYALE_PROXY || "0x2B2182326Fd659156B2B119034A72D1C2cC9758D";
const MAINNET_PROXY = "0x2B2182326Fd659156B2B119034A72D1C2cC9758D";
const POLL_MS = Number(process.env.BATTLE_ROYALE_POLL_MS || "5000");

type Mode = "serve" | "once" | "check-env";

function parseMode(args: string[]): Mode {
  const envMode = process.env.BATTLE_ROYALE_WATCH_MODE;
  if (envMode === "check-env" || envMode === "once" || envMode === "serve") {
    return envMode;
  }
  if (args.includes("--check-env")) return "check-env";
  if (args.includes("--once")) return "once";
  return "serve";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertSupportedNetwork(chainId: number) {
  if (chainId === 31337 && PROXY.toLowerCase() === MAINNET_PROXY.toLowerCase()) {
    throw new Error("Refusing to use the mainnet BattleRoyale proxy on the local Hardhat network. Run with --network bscMainnet or override BATTLE_ROYALE_PROXY.");
  }
}

async function revealOnce() {
  const [signer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  if (!ethers.utils.isAddress(PROXY)) {
    throw new Error(`Invalid BATTLE_ROYALE_PROXY: ${PROXY}`);
  }
  if (!Number.isInteger(POLL_MS) || POLL_MS <= 0) {
    throw new Error(`Invalid BATTLE_ROYALE_POLL_MS: ${POLL_MS}`);
  }

  assertSupportedNetwork(Number(network.chainId));
  const result = await revealBattleRoyaleIfReady({
    proxy: PROXY,
    provider: ethers.provider,
    signer,
  });

  console.log(
    JSON.stringify(
      {
        mode: "scan",
        network: {
          name: network.name,
          chainId: Number(network.chainId),
        },
        ...result.scan,
      },
      null,
      2
    )
  );

  if (result.kind === "no-open-match") {
    console.log("No open match found.");
    return;
  }

  console.log(
    JSON.stringify(
      {
        mode: "match",
        ...result.match,
      },
      null,
      2
    )
  );

  if (result.kind === "not-pending") {
    console.log("Latest open match is not pending reveal.");
    return;
  }

  if (result.kind === "too-early") {
    console.log(`Reveal not ready yet. ${result.blocksRemaining} block(s) remaining.`);
    return;
  }

  if (result.kind === "revealed") {
    console.log(`${result.fallbackEntropyUsed ? "fallback reveal" : "reveal"} tx: ${result.txHash}`);
  }
}

async function main() {
  const mode = parseMode(process.argv.slice(2));

  if (mode === "check-env") {
    const network = await ethers.provider.getNetwork();
    const chainId = Number(network.chainId);
    const localMainnetProxyMismatch = chainId === 31337 && PROXY.toLowerCase() === MAINNET_PROXY.toLowerCase();

    console.log(JSON.stringify({
      network: {
        name: network.name,
        chainId,
      },
      proxy: PROXY,
      pollMs: POLL_MS,
      proxyValid: ethers.utils.isAddress(PROXY),
      pollMsValid: Number.isInteger(POLL_MS) && POLL_MS > 0,
      supportedNetwork: !localMainnetProxyMismatch,
    }, null, 2));
    return;
  }

  await revealOnce();

  if (mode === "once") {
    return;
  }

  console.log(`Watching BattleRoyale every ${POLL_MS}ms`);
  while (true) {
    await sleep(POLL_MS);
    try {
      await revealOnce();
    } catch (error) {
      console.error(error);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
