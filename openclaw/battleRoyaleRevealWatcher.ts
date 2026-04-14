import { Contract, type Signer, type providers } from "ethers";
import {
  buildAutonomyTxOverrides,
  type AutonomyTxPolicy,
} from "./autonomyTxPolicy";

const BATTLE_ROYALE_REVEAL_ABI = [
  "function owner() view returns (address)",
  "function latestOpenMatch() view returns (uint256)",
  "function matchCount() view returns (uint256)",
  "function getMatchInfo(uint256 matchId) view returns (uint8 status, uint8 totalPlayers, uint256 revealBlock, uint8 losingRoom, uint256 total, uint256 roundId)",
  "function reveal(uint256 matchId)",
  "function emergencyReveal(uint256 matchId)",
];

export const BATTLE_ROYALE_STATUS = {
  OPEN: 0,
  PENDING_REVEAL: 1,
  SETTLED: 2,
} as const;

export const BATTLE_ROYALE_BLOCKHASH_SAFE = 256;

export type BattleRoyaleRevealScan = {
  proxy: string;
  owner: string;
  signer: string;
  signerIsOwner: boolean;
  latestOpenMatch: number;
  matchCount: number;
  candidateMatchId: number;
  currentBlock: number;
};

export type BattleRoyaleRevealMatch = {
  matchId: number;
  status: number;
  totalPlayers: number;
  revealBlock: number;
  losingRoom: number;
  roundId: string;
  blocksPastReveal: number;
};

export type BattleRoyaleRevealResult =
  | { kind: "no-open-match"; scan: BattleRoyaleRevealScan }
  | { kind: "not-pending"; scan: BattleRoyaleRevealScan; match: BattleRoyaleRevealMatch }
  | { kind: "too-early"; scan: BattleRoyaleRevealScan; match: BattleRoyaleRevealMatch; blocksRemaining: number }
  | { kind: "revealed"; scan: BattleRoyaleRevealScan; match: BattleRoyaleRevealMatch; txHash: string; fallbackEntropyUsed: boolean };

export type BattleRoyaleRevealWatcherConfig = {
  proxy: string;
  provider: providers.Provider;
  signer: Signer;
  txPolicy?: AutonomyTxPolicy;
  logger?: {
    info?: (...args: unknown[]) => void;
    warn?: (...args: unknown[]) => void;
  };
};

export async function revealBattleRoyaleIfReady(
  config: BattleRoyaleRevealWatcherConfig
): Promise<BattleRoyaleRevealResult> {
  const { proxy, provider, signer, txPolicy, logger } = config;
  const battleRoyale = new Contract(proxy, BATTLE_ROYALE_REVEAL_ABI, signer);

  const [currentBlock, owner, latestOpenMatchBn, matchCountBn, signerAddress] = await Promise.all([
    provider.getBlockNumber(),
    battleRoyale.owner() as Promise<string>,
    battleRoyale.latestOpenMatch(),
    battleRoyale.matchCount(),
    signer.getAddress(),
  ]);

  const latestOpenMatch = Number(latestOpenMatchBn.toString());
  const matchCount = Number(matchCountBn.toString());
  const candidateMatchId = latestOpenMatch > 0 ? latestOpenMatch : matchCount;
  const scan: BattleRoyaleRevealScan = {
    proxy,
    owner,
    signer: signerAddress,
    signerIsOwner: signerAddress.toLowerCase() === owner.toLowerCase(),
    latestOpenMatch,
    matchCount,
    candidateMatchId,
    currentBlock,
  };

  if (candidateMatchId <= 0) {
    return { kind: "no-open-match", scan };
  }

  const matchInfo = await battleRoyale.getMatchInfo(candidateMatchId);
  const revealBlock = Number(matchInfo.revealBlock ?? matchInfo[2] ?? 0);
  const match: BattleRoyaleRevealMatch = {
    matchId: candidateMatchId,
    status: Number(matchInfo.status ?? matchInfo[0] ?? 0),
    totalPlayers: Number(matchInfo.totalPlayers ?? matchInfo[1] ?? 0),
    revealBlock,
    losingRoom: Number(matchInfo.losingRoom ?? matchInfo[3] ?? 0),
    roundId: String(matchInfo.roundId ?? matchInfo[5] ?? "0"),
    blocksPastReveal: currentBlock - revealBlock,
  };

  if (match.status !== BATTLE_ROYALE_STATUS.PENDING_REVEAL) {
    return { kind: "not-pending", scan, match };
  }

  if (currentBlock < revealBlock) {
    return {
      kind: "too-early",
      scan,
      match,
      blocksRemaining: revealBlock - currentBlock,
    };
  }

  const overrides = await buildAutonomyTxOverrides(
    battleRoyale,
    "reveal",
    [match.matchId],
    txPolicy ?? { gasLimitBufferBps: 10750, gasLimitExtra: 8000 }
  );
  const tx =
    Object.keys(overrides).length > 0
      ? await battleRoyale.reveal(match.matchId, overrides)
      : await battleRoyale.reveal(match.matchId);
  await tx.wait();
  const fallbackEntropyUsed = match.blocksPastReveal > BATTLE_ROYALE_BLOCKHASH_SAFE;
  logger?.info?.(
    `[battle-royale-reveal] ${fallbackEntropyUsed ? "fallback reveal" : "reveal"} #${match.matchId}: ${tx.hash}`
  );
  return { kind: "revealed", scan, match, txHash: tx.hash, fallbackEntropyUsed };
}
