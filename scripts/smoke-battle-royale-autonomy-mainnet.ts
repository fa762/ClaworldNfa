import fs from "fs";
import path from "path";
import { ethers } from "hardhat";

const ACTION_BATTLE_ROYALE = 3;
const MODE_ENTER_OPTIONS = 0;
const MODE_CLAIM_EXISTING = 3;
const ROLE_FULL = 7;
const PARTICIPANT_SALT = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes("clawworld.battle-royale.autonomy.participant")
);

type OutputShape = {
  ids: {
    ASSET_CLAWORLD: string;
    PROTOCOL_BATTLE_ROYALE: string;
  };
  base: {
    nfa: string;
    battleRoyale: string;
  };
  autonomy: {
    registry: string;
    delegationRegistry: string;
    actionHub: string;
    finalizationHub: string;
    battleRoyaleAdapter: string;
  };
  operator: string;
};

function loadJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitTx(txPromise: Promise<any>, label: string) {
  const tx = await txPromise;
  await tx.wait();
  console.log(`${label}: ${tx.hash}`);
}

async function waitTxIfNeeded(needed: boolean, txFactory: () => Promise<any>, label: string) {
  if (!needed) {
    console.log(`${label}: already configured`);
    return;
  }
  await waitTx(txFactory(), label);
}

async function waitForCompletion(
  actionHub: any,
  finalizationHub: any,
  requestId: number,
  waitMs: number,
  pollMs: number
) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < waitMs) {
    const receipt = await actionHub.getActionReceipt(requestId);
    const finalized = await finalizationHub.isFinalized(requestId);
    console.log({
      requestId,
      status: Number(receipt.status),
      choice: Number(receipt.resolvedChoice),
      spend: receipt.actualSpend.toString(),
      reward: receipt.clwCredit.toString(),
      finalized,
      lastError: receipt.lastError,
    });
    if (finalized || Number(receipt.status) === 4) {
      return receipt;
    }
    if ([5, 6, 7].includes(Number(receipt.status))) {
      throw new Error(`request ${requestId} ended with status ${Number(receipt.status)}: ${receipt.lastError}`);
    }
    await sleep(pollMs);
  }
  throw new Error(`Timed out waiting for request ${requestId}`);
}

function clampRiskMode(value: number) {
  if (value <= 0) return 0;
  if (value >= 2) return 2;
  return 1;
}

function buildStakeOptions(minStake: bigint, maxSpend: bigint, riskMode: number): bigint[] {
  const capped = maxSpend > minStake ? maxSpend : minStake;
  if (riskMode === 0) {
    return [minStake];
  }
  if (riskMode === 2) {
    const medium = minStake + (capped - minStake) / 2n;
    return [...new Set([medium.toString(), capped.toString()])].map((v) => BigInt(v));
  }
  const mid = minStake + (capped - minStake) / 3n;
  return [...new Set([minStake.toString(), mid.toString()])].map((v) => BigInt(v));
}

function chooseRoomOrder(
  playerCounts: number[],
  roomTotals: bigint[],
  riskMode: number
): number[] {
  const rooms = playerCounts.map((count, index) => ({
    roomId: index + 1,
    playerCount: count,
    total: roomTotals[index],
  }));

  if (riskMode === 0) {
    return rooms
      .sort((a, b) => a.playerCount - b.playerCount || Number(a.total - b.total))
      .map((room) => room.roomId);
  }
  if (riskMode === 2) {
    return rooms
      .sort((a, b) => Number(b.total - a.total) || a.playerCount - b.playerCount)
      .map((room) => room.roomId);
  }
  return rooms
    .sort((a, b) => a.playerCount - b.playerCount || Number(b.total - a.total))
    .map((room) => room.roomId);
}

function autonomyParticipantForNfa(nfaId: number): string {
  const digest = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(["bytes32", "uint256"], [PARTICIPANT_SALT, nfaId])
  );
  return ethers.utils.getAddress(`0x${digest.slice(-40)}`);
}

function sameBigNumberish(actual: any, expected: any) {
  return BigInt(actual.toString()) === BigInt(expected.toString());
}

async function resolveParticipantContext(
  battleRoyale: any,
  matchId: number,
  nfaId: number,
  owner: string
) {
  const autonomyParticipant = autonomyParticipantForNfa(nfaId);
  const [autoInfo, autoClaimable, autoEffectiveNfa] = await Promise.all([
    battleRoyale.getPlayerInfo(matchId, autonomyParticipant),
    battleRoyale.getClaimable(matchId, autonomyParticipant),
    battleRoyale.getEffectivePlayerNfa(matchId, autonomyParticipant),
  ]);

  const autoRoomId = Number(autoInfo.roomId ?? autoInfo[0] ?? 0);
  const autoStake = BigInt((autoInfo.stake ?? autoInfo[1] ?? 0).toString());
  const autoClaimableBig = BigInt(autoClaimable.toString());
  const autoEffective = Number(autoEffectiveNfa.toString());

  if (autoRoomId > 0 || autoStake > 0n || autoClaimableBig > 0n || autoEffective === nfaId) {
    return {
      participant: autonomyParticipant,
      roomId: autoRoomId,
      stake: autoStake,
      claimable: autoClaimableBig,
      effectiveNfa: autoEffective,
      isLegacyOwnerParticipant: false,
    };
  }

  const [ownerInfo, ownerClaimable, ownerEffectiveNfa] = await Promise.all([
    battleRoyale.getPlayerInfo(matchId, owner),
    battleRoyale.getClaimable(matchId, owner),
    battleRoyale.getEffectivePlayerNfa(matchId, owner),
  ]);

  const ownerRoomId = Number(ownerInfo.roomId ?? ownerInfo[0] ?? 0);
  const ownerStake = BigInt((ownerInfo.stake ?? ownerInfo[1] ?? 0).toString());
  const ownerClaimableBig = BigInt(ownerClaimable.toString());
  const ownerEffective = Number(ownerEffectiveNfa.toString());

  if (
    ownerEffective === nfaId ||
    ((ownerRoomId > 0 || ownerStake > 0n || ownerClaimableBig > 0n) && ownerEffective === 0)
  ) {
    return {
      participant: owner,
      roomId: ownerRoomId,
      stake: ownerStake,
      claimable: ownerClaimableBig,
      effectiveNfa: ownerEffective,
      isLegacyOwnerParticipant: true,
    };
  }

  return {
    participant: autonomyParticipant,
    roomId: 0,
    stake: 0n,
    claimable: 0n,
    effectiveNfa: 0,
    isLegacyOwnerParticipant: false,
  };
}

async function main() {
  const outputPath = path.join(__dirname, "output", "autonomy-mainnet.json");
  const output = loadJson<OutputShape>(outputPath);
  const [deployer] = await ethers.getSigners();

  const nfaId = Number(process.env.NFA_ID || "3");
  const waitMs = Number(process.env.WAIT_MS || "180000");
  const pollMs = Number(process.env.POLL_MS || "5000");
  const leaseDays = Number(process.env.LEASE_DAYS || "30");
  const dailyLimit = Number(process.env.DAILY_LIMIT || "2");
  const riskMode = clampRiskMode(Number(process.env.RISK_MODE || "1"));
  const roomCandidateCount = Math.max(1, Math.min(10, Number(process.env.ROOM_CANDIDATE_COUNT || "10")));
  const maxSpend = ethers.utils.parseEther(process.env.MAX_SPEND_CLAWORLD || "300");
  const dailyBudget = ethers.utils.parseEther(process.env.DAILY_BUDGET_CLAWORLD || "600");
  const minReserve = ethers.utils.parseEther(process.env.MIN_RESERVE_CLAWORLD || "200");
  const checkOnly = process.env.CHECK_ONLY === "true";

  const registry = await ethers.getContractAt("ClawAutonomyRegistry", output.autonomy.registry, deployer);
  const delegationRegistry = await ethers.getContractAt(
    "ClawAutonomyDelegationRegistry",
    output.autonomy.delegationRegistry,
    deployer
  );
  const actionHub = await ethers.getContractAt("ClawOracleActionHub", output.autonomy.actionHub, deployer);
  const finalizationHub = await ethers.getContractAt(
    "ClawAutonomyFinalizationHub",
    output.autonomy.finalizationHub,
    deployer
  );
  const battleRoyale = await ethers.getContractAt("BattleRoyale", output.base.battleRoyale, deployer);
  const nfa = await ethers.getContractAt("ClawNFA", output.base.nfa, deployer);

  const owner = await nfa.ownerOf(nfaId);
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(`NFA #${nfaId} owner ${owner} != signer ${deployer.address}`);
  }

  const latestOpenMatch = Number((await battleRoyale.latestOpenMatch()).toString());
  const latestMatch = latestOpenMatch > 0 ? await battleRoyale.getMatchInfo(latestOpenMatch) : null;
  const matchStatus = latestMatch ? Number(latestMatch.status ?? latestMatch[0] ?? 0) : -1;
  const matchTotalPlayers = latestMatch ? Number(latestMatch.totalPlayers ?? latestMatch[1] ?? 0) : 0;
  const matchConfig = latestOpenMatch > 0 ? await battleRoyale.getMatchConfig(latestOpenMatch) : null;

  console.log(
    JSON.stringify(
      {
        signer: deployer.address,
        nfaId,
        owner,
        latestOpenMatch,
        matchStatus,
        matchTotalPlayers,
        riskMode,
        roomCandidateCount,
        checkOnly,
      },
      null,
      2
    )
  );

  if (checkOnly) {
    console.log("[battle-royale-smoke] CHECK_ONLY enabled. No transactions will be sent.");
  } else {
    const [
      protocolApproved,
      adapterApproved,
      operatorRoleMask,
      lease,
      riskState,
      policy,
      assetBudget,
    ] = await Promise.all([
      registry.isProtocolApproved(nfaId, output.ids.PROTOCOL_BATTLE_ROYALE),
      registry.isAdapterApproved(nfaId, ACTION_BATTLE_ROYALE, output.autonomy.battleRoyaleAdapter),
      registry.getOperatorRoleMask(nfaId, ACTION_BATTLE_ROYALE, output.operator),
      delegationRegistry.getDelegationLease(nfaId, ACTION_BATTLE_ROYALE, output.operator),
      registry.getRiskState(nfaId, ACTION_BATTLE_ROYALE),
      registry.getPolicy(nfaId, ACTION_BATTLE_ROYALE),
      registry.getAssetBudget(nfaId, ACTION_BATTLE_ROYALE, output.ids.ASSET_CLAWORLD),
    ]);
    const now = BigInt(Math.floor(Date.now() / 1000));
    const leaseRoleMask = Number(lease.roleMask ?? lease[1] ?? 0);
    const leaseExpiresAt = BigInt((lease.expiresAt ?? lease[3] ?? 0).toString());
    const leaseEnabled = Boolean(lease.enabled ?? lease[0]);
    const leaseActive = leaseEnabled && (leaseRoleMask & ROLE_FULL) === ROLE_FULL && (leaseExpiresAt === 0n || leaseExpiresAt > now);

    await waitTxIfNeeded(
      !protocolApproved,
      () => registry.setApprovedProtocol(nfaId, output.ids.PROTOCOL_BATTLE_ROYALE, true),
      "setApprovedProtocol"
    );
    await waitTxIfNeeded(
      !adapterApproved,
      () => registry.setApprovedAdapter(nfaId, ACTION_BATTLE_ROYALE, output.autonomy.battleRoyaleAdapter, true),
      "setApprovedAdapter"
    );
    await waitTxIfNeeded(
      Number(operatorRoleMask) !== ROLE_FULL,
      () => registry.setOperatorRoleMask(nfaId, ACTION_BATTLE_ROYALE, output.operator, ROLE_FULL),
      "setOperatorRoleMask"
    );
    await waitTxIfNeeded(
      !leaseActive,
      () => delegationRegistry.setDelegationLease(
        nfaId,
        ACTION_BATTLE_ROYALE,
        output.operator,
        ROLE_FULL,
        BigInt(Math.floor(Date.now() / 1000) + leaseDays * 86400)
      ),
      "setDelegationLease"
    );
    await waitTxIfNeeded(
      Number(riskState.maxFailureStreak ?? riskState[1]) !== 3 || !sameBigNumberish(riskState.minClwReserve ?? riskState[6], minReserve),
      () => registry.setRiskControls(nfaId, ACTION_BATTLE_ROYALE, 3, minReserve),
      "setRiskControls"
    );
    await waitTxIfNeeded(
      !Boolean(policy.enabled ?? policy[0]) ||
        Number(policy.riskMode ?? policy[1]) !== riskMode ||
        Number(policy.dailyLimit ?? policy[2]) !== dailyLimit ||
        !sameBigNumberish(policy.maxClwPerAction ?? policy[5], maxSpend),
      () => registry.setPolicy(nfaId, ACTION_BATTLE_ROYALE, true, riskMode, dailyLimit, maxSpend),
      "setPolicy"
    );
    await waitTxIfNeeded(
      !Boolean(assetBudget.enabled ?? assetBudget[0]) ||
        !sameBigNumberish(assetBudget.maxPerAction ?? assetBudget[4], maxSpend) ||
        !sameBigNumberish(assetBudget.minReserve ?? assetBudget[5], 0) ||
        !sameBigNumberish(assetBudget.dailyAmountLimit ?? assetBudget[6], dailyBudget),
      () => registry.setAssetBudget(
        nfaId,
        ACTION_BATTLE_ROYALE,
        output.ids.ASSET_CLAWORLD,
        true,
        maxSpend,
        0,
        dailyBudget
      ),
      "setAssetBudget"
    );
  }

  if (latestOpenMatch <= 0 || !matchConfig) {
    console.log("[battle-royale-smoke] No open Battle Royale match. Policy is configured; wait for the next arena.");
    return;
  }

  const participantContext = await resolveParticipantContext(battleRoyale, latestOpenMatch, nfaId, owner);
  const currentRoom = participantContext.roomId;
  const claimable = ethers.BigNumber.from(participantContext.claimable.toString());

  if (matchStatus === 2 && claimable.gt(0)) {
    const claimPayload = ethers.utils.defaultAbiCoder.encode(
      ["uint8", "bytes"],
      [MODE_CLAIM_EXISTING, ethers.utils.defaultAbiCoder.encode(["uint256"], [latestOpenMatch])]
    );
    const prompt = `Claim the settled Battle Royale reward for NFA #${nfaId} in match #${latestOpenMatch} if it is available now.`;
    if (checkOnly) {
      console.log("[battle-royale-smoke] Would request CLAIM autonomy action.");
      return;
    }

    const requestId = Number(
      (
        await actionHub.callStatic.requestAutonomousAction(
          nfaId,
          ACTION_BATTLE_ROYALE,
          output.ids.ASSET_CLAWORLD,
          0,
          claimPayload,
          prompt,
          2
        )
      ).toString()
    );

    await waitTx(
      actionHub.requestAutonomousAction(
        nfaId,
        ACTION_BATTLE_ROYALE,
        output.ids.ASSET_CLAWORLD,
        0,
        claimPayload,
        prompt,
        2
      ),
      "requestAutonomousAction(claim)"
    );
    await waitForCompletion(actionHub, finalizationHub, requestId, waitMs, pollMs);
    return;
  }

  if (matchStatus !== 0) {
    console.log("[battle-royale-smoke] Latest open match is not OPEN. Watcher will handle reveal maintenance when needed.");
    return;
  }

  if (currentRoom > 0) {
    console.log(
      `[battle-royale-smoke] Participant ${participantContext.participant}${participantContext.isLegacyOwnerParticipant ? " (legacy owner participant)" : ""} already entered room ${currentRoom} in match #${latestOpenMatch}.`
    );
    return;
  }

  const [snapshot, policy] = await Promise.all([
    battleRoyale.getMatchSnapshot(latestOpenMatch),
    registry.getPolicy(nfaId, ACTION_BATTLE_ROYALE),
  ]);

  const minStake = BigInt((matchConfig.minStake ?? matchConfig[0]).toString());
  const effectiveMaxSpend = BigInt((policy.maxClwPerAction ?? policy[5]).toString());
  const roomIds = chooseRoomOrder(
    (snapshot.playerCounts ?? snapshot[0]).map((v: any) => Number(v)),
    (snapshot.roomTotals ?? snapshot[1]).map((v: any) => BigInt(v.toString())),
    riskMode
  ).slice(0, roomCandidateCount);
  const stakeOptions = buildStakeOptions(minStake, effectiveMaxSpend, riskMode);
  const stakeWei = BigInt(stakeOptions[stakeOptions.length - 1]);
  const stakeArray = roomIds.map(() => stakeWei);

  const payload = ethers.utils.defaultAbiCoder.encode(
    ["uint8", "bytes"],
    [
      MODE_ENTER_OPTIONS,
      ethers.utils.defaultAbiCoder.encode(["uint256", "uint8[]", "uint256[]"], [latestOpenMatch, roomIds, stakeArray]),
    ]
  );
  const candidateSummary = roomIds
    .map((roomId, index) => `room ${roomId}, stake ${ethers.utils.formatEther(stakeArray[index].toString())} Claworld`)
    .join(" || ");
  const prompt = [
    `Choose the best Battle Royale room and stake option for NFA #${nfaId}.`,
    `Risk posture is ${riskMode}.`,
    `Current live match is #${latestOpenMatch}.`,
    `Candidates: ${candidateSummary}.`,
    `Prefer bounded risk and stronger prize positioning.`,
  ].join(" ");

  if (checkOnly) {
    console.log(
      JSON.stringify(
        {
          action: "enter",
          latestOpenMatch,
          roomIds,
          stakeArray: stakeArray.map((v) => ethers.utils.formatEther(v.toString())),
          prompt,
        },
        null,
        2
      )
    );
    return;
  }

  const requestId = Number(
    (
      await actionHub.callStatic.requestAutonomousAction(
        nfaId,
        ACTION_BATTLE_ROYALE,
        output.ids.ASSET_CLAWORLD,
        stakeWei,
        payload,
        prompt,
        roomIds.length
      )
    ).toString()
  );

  await waitTx(
    actionHub.requestAutonomousAction(
      nfaId,
      ACTION_BATTLE_ROYALE,
      output.ids.ASSET_CLAWORLD,
      stakeWei,
      payload,
      prompt,
      roomIds.length
    ),
    "requestAutonomousAction(enter)"
  );

  const receipt = await waitForCompletion(actionHub, finalizationHub, requestId, waitMs, pollMs);
  console.log(
    JSON.stringify(
      {
        requestId,
        status: Number(receipt.status),
        choice: Number(receipt.resolvedChoice),
        spend: ethers.utils.formatEther(receipt.actualSpend.toString()),
        reward: ethers.utils.formatEther(receipt.clwCredit.toString()),
        reasoningCid: receipt.reasoningCid,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
