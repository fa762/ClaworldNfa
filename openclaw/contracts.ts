/**
 * Claw World OpenClaw Adapter — Contract Interaction Layer
 *
 * Wraps ethers.js calls to game contracts.
 * Used by OpenClaw bots on TG, Feishu, etc.
 */

import { ethers } from 'ethers';
import type { LobsterState, PKMatch } from './types';

// Minimal ABIs — only the functions we need
const ROUTER_ABI = [
  'function getLobsterState(uint256 nfaId) view returns (tuple(uint8 rarity, uint8 shelter, uint8 courage, uint8 wisdom, uint8 social, uint8 create, uint8 grit, uint8 str, uint8 def, uint8 spd, uint8 vit, bytes32 mutation1, bytes32 mutation2, uint16 level, uint32 xp, uint64 lastUpkeepTime))',
  'function clwBalances(uint256 nfaId) view returns (uint256)',
  'function getJobClass(uint256 nfaId) view returns (uint8 jobClass, string jobName)',
  'function isActive(uint256 nfaId) view returns (bool)',
  'function getDailyCost(uint256 nfaId) view returns (uint256)',
  'function depositCLW(uint256 nfaId, uint256 amount)',
  'function requestWithdrawCLW(uint256 nfaId, uint256 amount)',
  'function claimWithdrawCLW(uint256 nfaId)',
  'function processUpkeep(uint256 nfaId)',
  'function initialized(uint256 nfaId) view returns (bool)',
];

const NFA_ABI = [
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function getTotalSupply() view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function setApprovalForAll(address operator, bool approved)',
  'function isApprovedForAll(address owner, address operator) view returns (bool)',
  'function updateLearningTreeByOwner(uint256 tokenId, bytes32 newRoot)',
  'function getLearningTree(uint256 tokenId) view returns (bytes32 root, uint256 version, uint256 lastUpdate)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
];

const PK_ABI = [
  'function createMatch(uint256 nfaId, uint256 stake) returns (uint256)',
  'function joinMatch(uint256 matchId, uint256 nfaId)',
  'function commitStrategy(uint256 matchId, bytes32 commitHash)',
  'function revealStrategy(uint256 matchId, uint8 strategy, bytes32 salt)',
  'function settle(uint256 matchId)',
  'function cancelMatch(uint256 matchId)',
  'function cancelJoinedMatch(uint256 matchId)',
  'function getMatchCount() view returns (uint256)',
  'function getMatch(uint256 matchId) view returns (tuple(uint256 nfaA, uint256 nfaB, bytes32 commitA, bytes32 commitB, uint8 strategyA, uint8 strategyB, uint256 stake, uint8 phase, uint64 phaseTimestamp, bool revealedA, bool revealedB, bytes32 saltA, bytes32 saltB))',
  'function participantAOf(uint256 matchId) view returns (address)',
  'function participantBOf(uint256 matchId) view returns (address)',
  'function getStrategyHash(uint8 strategy, bytes32 salt, address sender) pure returns (bytes32)',
];

const WORLD_STATE_ABI = [
  'function rewardMultiplier() view returns (uint256)',
  'function pkStakeLimit() view returns (uint256)',
  'function mutationBonus() view returns (uint256)',
  'function dailyCostMultiplier() view returns (uint256)',
  'function activeEvents() view returns (bytes32)',
  'function getCLWPrice() view returns (uint256)',
  'function pendingState() view returns (uint256, uint256, uint256, uint256, bytes32, uint64, bool)',
];

const DEPOSIT_ROUTER_ABI = [
  'function buyAndDeposit(uint256 nfaId) payable',
  'function flapBuyAndDeposit(uint256 nfaId) payable',
  'function previewFlapBuy(uint256 bnbAmount) view returns (uint256)',
];

const CLW_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

const TASK_SKILL_ABI = [
  'function completeTask(uint256 nfaId, uint32 xpReward, uint256 clwReward, uint16 matchScore)',
  'function completeTypedTask(uint256 nfaId, uint8 taskType, uint32 xpReward, uint256 clwReward, uint16 matchScore)',
  'function lastTaskTime(uint256 nfaId) view returns (uint256)',
  'function getTaskStats(uint256 nfaId) view returns (uint32 total, uint256 clwEarned, uint32 courage, uint32 wisdom, uint32 social, uint32 create, uint32 grit)',
  'function previewTypedTaskOutcome(uint256 nfaId, uint8 taskType, uint32 xpReward, uint256 clwReward) view returns (uint16 matchScore, uint256 actualClw, uint256 streakMul, uint256 worldMul, bool cooldownReady, bool personalityDrift)',
  'function operators(address) view returns (bool)',
  'event TaskCompleted(uint256 indexed nfaId, uint32 xpReward, uint256 clwReward, uint256 actualClw, uint16 matchScore)',
  'event TaskPersonalityDrift(uint256 indexed nfaId, uint8 taskType, int8 delta)',
];

const MARKET_SKILL_ABI = [
  'function listFixedPrice(uint256 nfaId, uint256 price)',
  'function listAuction(uint256 nfaId, uint256 startPrice)',
  'function listSwap(uint256 nfaId, uint256 targetNfaId)',
  'function buyFixedPrice(uint256 listingId) payable',
  'function bid(uint256 listingId) payable',
  'function settleAuction(uint256 listingId)',
  'function acceptSwap(uint256 listingId)',
  'function cancelListing(uint256 listingId)',
  'function listings(uint256) view returns (uint256 nfaId, address seller, uint8 listingType, uint256 price, uint256 highestBid, address highestBidder, uint64 endTime, uint256 swapTargetId, bool active)',
  'function listingCount() view returns (uint256)',
  'event Listed(uint256 indexed listingId, uint256 indexed nfaId, address seller, uint8 listingType, uint256 price)',
  'event Purchased(uint256 indexed listingId, address buyer, uint256 price)',
  'event AuctionSettled(uint256 indexed listingId, address winner, uint256 finalBid)',
  'event ListingCancelled(uint256 indexed listingId)',
];

const BATTLE_ROYALE_ABI = [
  'function matchCount() view returns (uint256)',
  'function latestOpenMatch() view returns (uint256)',
  'function getMatchInfo(uint256 matchId) view returns (uint8 status, uint8 totalPlayers, uint256 revealBlock, uint8 losingRoom, uint256 total, uint256 roundId)',
  'function getMatchConfig(uint256 matchId) view returns (uint256 minStake, uint8 triggerCount, uint256 treasuryBps, uint8 revealDelay)',
  'function getMatchSnapshot(uint256 matchId) view returns (uint256[10] playerCounts, uint256[10] roomTotals)',
  'function getPlayerInfo(uint256 matchId, address player) view returns (uint8 roomId, uint256 stake)',
  'function getClaimable(uint256 matchId, address player) view returns (uint256)',
  'function getEffectivePlayerNfa(uint256 matchId, address player) view returns (uint256)',
  'function roomChangeCount(uint256 matchId, address player) view returns (uint256)',
  'function enterRoom(uint256 matchId, uint8 roomId, uint256 amount)',
  'function addStake(uint256 matchId, uint256 amount)',
  'function changeRoom(uint256 matchId, uint8 newRoomId)',
  'function selectPlayerNfa(uint256 matchId, uint256 nfaId)',
  'function claim(uint256 matchId) returns (uint256)',
];

const ORACLE_ABI = [
  'function reason(uint256 nfaId, string prompt, uint8 numOfChoices) returns (uint256)',
  'function fulfillReasoning(uint256 requestId, uint8 choice, string reasoningCid)',
  'function requests(uint256) view returns (uint256 nfaId, address consumer, string prompt, uint8 numOfChoices, uint8 choice, string reasoningCid, uint8 status, uint64 timestamp)',
  'event ReasoningRequested(uint256 indexed requestId, uint256 indexed nfaId, string prompt, uint8 numOfChoices)',
  'event ReasoningFulfilled(uint256 indexed requestId, uint8 choice, string reasoningCid)',
];

const BATTLE_ROYALE_AUTONOMY_PARTICIPANT_SALT = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes('clawworld.battle-royale.autonomy.participant')
);

export interface ContractAddresses {
  router: string;
  nfa: string;
  pkSkill: string;
  taskSkill: string;
  marketSkill: string;
  oracle: string;
  worldState: string;
  depositRouter: string;
  clwToken: string;
  battleRoyale?: string;
}

export class GameContractClient {
  private router: ethers.Contract;
  private nfa: ethers.Contract;
  private pk: ethers.Contract;
  private task: ethers.Contract;
  private market: ethers.Contract;
  private battleRoyale?: ethers.Contract;
  private oracle: ethers.Contract;
  private worldState: ethers.Contract;
  private depositRouter: ethers.Contract;
  private clw: ethers.Contract;
  private nfaWriter: ethers.Contract;
  private signer: ethers.Signer;
  private operatorSigner?: ethers.Signer; // for task completion + oracle fulfillment
  readonly addresses: ContractAddresses;

  constructor(
    provider: ethers.providers.Provider,
    signer: ethers.Signer,
    addresses: ContractAddresses,
    operatorSigner?: ethers.Signer
  ) {
    this.signer = signer;
    this.addresses = addresses;
    this.operatorSigner = operatorSigner;
    this.router = new ethers.Contract(addresses.router, ROUTER_ABI, signer);
    this.nfa = new ethers.Contract(addresses.nfa, NFA_ABI, provider);
    this.nfaWriter = new ethers.Contract(addresses.nfa, NFA_ABI, signer);
    this.pk = new ethers.Contract(addresses.pkSkill, PK_ABI, signer);
    this.task = new ethers.Contract(addresses.taskSkill, TASK_SKILL_ABI, operatorSigner || signer);
    this.market = new ethers.Contract(addresses.marketSkill, MARKET_SKILL_ABI, signer);
    if (addresses.battleRoyale && ethers.utils.isAddress(addresses.battleRoyale)) {
      this.battleRoyale = new ethers.Contract(addresses.battleRoyale, BATTLE_ROYALE_ABI, signer);
    }
    this.oracle = new ethers.Contract(addresses.oracle, ORACLE_ABI, operatorSigner || signer);
    this.worldState = new ethers.Contract(addresses.worldState, WORLD_STATE_ABI, provider);
    this.depositRouter = new ethers.Contract(addresses.depositRouter, DEPOSIT_ROUTER_ABI, signer);
    this.clw = new ethers.Contract(addresses.clwToken, CLW_ABI, signer);
  }

  // ============================================
  // READ: Lobster
  // ============================================

  async getLobsterStatus(nfaId: number): Promise<{
    state: LobsterState;
    clwBalance: string;
    jobClass: number;
    active: boolean;
    dailyCost: string;
  }> {
    const [state, balance, [jobClass], active, dailyCost] = await Promise.all([
      this.router.getLobsterState(nfaId),
      this.router.clwBalances(nfaId),
      this.router.getJobClass(nfaId),
      this.router.isActive(nfaId),
      this.router.getDailyCost(nfaId),
    ]);

    return {
      state: {
        rarity: state.rarity,
        shelter: state.shelter,
        courage: state.courage,
        wisdom: state.wisdom,
        social: state.social,
        create: state.create,
        grit: state.grit,
        str: state.str,
        def: state.def,
        spd: state.spd,
        vit: state.vit,
        mutation1: state.mutation1,
        mutation2: state.mutation2,
        level: state.level,
        xp: state.xp,
        lastUpkeepTime: state.lastUpkeepTime,
      },
      clwBalance: ethers.utils.formatEther(balance),
      jobClass,
      active,
      dailyCost: ethers.utils.formatEther(dailyCost),
    };
  }

  async getOwnedNFAs(owner: string): Promise<number[]> {
    const balance = await this.nfa.balanceOf(owner);
    const ids: number[] = [];
    for (let i = 0; i < balance.toNumber(); i++) {
      const id = await this.nfa.tokenOfOwnerByIndex(owner, i);
      ids.push(id.toNumber());
    }
    return ids;
  }

  async getNFAOwner(nfaId: number): Promise<string> {
    return this.nfa.ownerOf(nfaId);
  }

  async getNFAOwnersTrail(nfaId: number): Promise<string[]> {
    const topic = ethers.utils.id('Transfer(address,address,uint256)');
    const tokenTopic = ethers.utils.hexZeroPad(ethers.BigNumber.from(nfaId).toHexString(), 32);
    const logs = await this.nfa.provider.getLogs({
      address: this.addresses.nfa,
      fromBlock: 0,
      toBlock: 'latest',
      topics: [topic, null, null, tokenTopic],
    });

    const iface = new ethers.utils.Interface(NFA_ABI);
    const owners: string[] = [];
    for (const log of logs) {
      const parsed = iface.parseLog(log);
      const to = String(parsed.args.to).toLowerCase();
      if (to !== ethers.constants.AddressZero.toLowerCase() && !owners.includes(to)) {
        owners.push(to);
      }
    }
    return owners.reverse();
  }

  async getLearningTree(nfaId: number): Promise<{ root: string; version: number; lastUpdate: number }> {
    const [root, version, lastUpdate] = await this.nfa.getLearningTree(nfaId);
    return {
      root,
      version: Number(version),
      lastUpdate: Number(lastUpdate),
    };
  }

  // ============================================
  // READ: PK
  // ============================================

  async getPKMatch(matchId: number): Promise<PKMatch> {
    const m = await this.pk.getMatch(matchId);
    return {
      nfaA: m.nfaA.toNumber(),
      nfaB: m.nfaB.toNumber(),
      commitA: m.commitA,
      commitB: m.commitB,
      strategyA: m.strategyA,
      strategyB: m.strategyB,
      stake: m.stake.toBigInt(),
      phase: m.phase,
      phaseTimestamp: m.phaseTimestamp,
      revealedA: m.revealedA,
      revealedB: m.revealedB,
    };
  }

  async getPKMatchCount(): Promise<number> {
    const count = await this.pk.getMatchCount();
    return count.toNumber();
  }

  async getPKParticipants(matchId: number): Promise<{ participantA: string; participantB: string }> {
    const [participantA, participantB] = await Promise.all([
      this.pk.participantAOf(matchId),
      this.pk.participantBOf(matchId),
    ]);
    return { participantA, participantB };
  }

  // ============================================
  // READ/WRITE: Battle Royale
  // ============================================

  private requireBattleRoyale(): ethers.Contract {
    if (!this.battleRoyale) {
      throw new Error('BattleRoyale contract is not configured');
    }
    return this.battleRoyale;
  }

  async getLatestBattleRoyaleMatch(): Promise<number> {
    const br = this.requireBattleRoyale();
    const matchId = await br.latestOpenMatch();
    return matchId.toNumber();
  }

  async getBattleRoyaleMatchCount(): Promise<number> {
    const br = this.requireBattleRoyale();
    const count = await br.matchCount();
    return count.toNumber();
  }

  async getBattleRoyaleMatchInfo(matchId: number): Promise<{
    status: number;
    totalPlayers: number;
    revealBlock: number;
    losingRoom: number;
    total: bigint;
    roundId: bigint;
  }> {
    const br = this.requireBattleRoyale();
    const [status, totalPlayers, revealBlock, losingRoom, total, roundId] = await br.getMatchInfo(matchId);
    return {
      status: Number(status),
      totalPlayers: Number(totalPlayers),
      revealBlock: Number(revealBlock),
      losingRoom: Number(losingRoom),
      total: total.toBigInt(),
      roundId: roundId.toBigInt(),
    };
  }

  async getBattleRoyaleMatchConfig(matchId: number): Promise<{
    minStake: bigint;
    triggerCount: number;
    treasuryBps: number;
    revealDelay: number;
  }> {
    const br = this.requireBattleRoyale();
    const [minStake, triggerCount, treasuryBps, revealDelay] = await br.getMatchConfig(matchId);
    return {
      minStake: minStake.toBigInt(),
      triggerCount: Number(triggerCount),
      treasuryBps: Number(treasuryBps),
      revealDelay: Number(revealDelay),
    };
  }

  async getBattleRoyaleSnapshot(matchId: number): Promise<{
    playerCounts: bigint[];
    roomTotals: bigint[];
  }> {
    const br = this.requireBattleRoyale();
    const [playerCounts, roomTotals] = await br.getMatchSnapshot(matchId);
    return {
      playerCounts: playerCounts.map((v: any) => BigInt(v.toString())),
      roomTotals: roomTotals.map((v: any) => BigInt(v.toString())),
    };
  }

  async getBattleRoyalePlayerInfo(matchId: number, player: string): Promise<{ roomId: number; stake: bigint }> {
    const br = this.requireBattleRoyale();
    const [roomId, stake] = await br.getPlayerInfo(matchId, player);
    return {
      roomId: Number(roomId),
      stake: stake.toBigInt(),
    };
  }

  async getBattleRoyaleClaimable(matchId: number, player: string): Promise<bigint> {
    const br = this.requireBattleRoyale();
    const claimable = await br.getClaimable(matchId, player);
    return claimable.toBigInt();
  }

  async getBattleRoyaleEffectiveNfa(matchId: number, player: string): Promise<number> {
    const br = this.requireBattleRoyale();
    const nfaId = await br.getEffectivePlayerNfa(matchId, player);
    return nfaId.toNumber();
  }

  async getBattleRoyaleRoomChangeCount(matchId: number, player: string): Promise<number> {
    const br = this.requireBattleRoyale();
    const count = await br.roomChangeCount(matchId, player);
    return count.toNumber();
  }

  getBattleRoyaleAutonomyParticipant(nfaId: number): string {
    const digest = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ['bytes32', 'uint256'],
        [BATTLE_ROYALE_AUTONOMY_PARTICIPANT_SALT, nfaId]
      )
    );
    return ethers.utils.getAddress(`0x${digest.slice(-40)}`);
  }

  async getBattleRoyaleAutonomyPlayerInfo(matchId: number, nfaId: number): Promise<{ participant: string; roomId: number; stake: bigint }> {
    const participant = this.getBattleRoyaleAutonomyParticipant(nfaId);
    const info = await this.getBattleRoyalePlayerInfo(matchId, participant);
    return { participant, ...info };
  }

  async getBattleRoyaleAutonomyClaimable(matchId: number, nfaId: number): Promise<{ participant: string; claimable: bigint }> {
    const participant = this.getBattleRoyaleAutonomyParticipant(nfaId);
    const claimable = await this.getBattleRoyaleClaimable(matchId, participant);
    return { participant, claimable };
  }

  async getBattleRoyaleAutonomyEffectiveNfa(matchId: number, nfaId: number): Promise<{ participant: string; effectiveNfa: number }> {
    const participant = this.getBattleRoyaleAutonomyParticipant(nfaId);
    const effectiveNfa = await this.getBattleRoyaleEffectiveNfa(matchId, participant);
    return { participant, effectiveNfa };
  }

  async getBattleRoyaleAutonomyRoomChangeCount(matchId: number, nfaId: number): Promise<{ participant: string; count: number }> {
    const participant = this.getBattleRoyaleAutonomyParticipant(nfaId);
    const count = await this.getBattleRoyaleRoomChangeCount(matchId, participant);
    return { participant, count };
  }

  async resolveBattleRoyaleParticipantContext(matchId: number, nfaId: number): Promise<{
    participant: string;
    roomId: number;
    stake: bigint;
    claimable: bigint;
    effectiveNfa: number;
    roomChangeCount: number;
    isLegacyOwnerParticipant: boolean;
  }> {
    const autonomyParticipant = this.getBattleRoyaleAutonomyParticipant(nfaId);
    const [autonomyInfo, autonomyClaimable, autonomyEffectiveNfa, autonomyRoomChangeCount] = await Promise.all([
      this.getBattleRoyalePlayerInfo(matchId, autonomyParticipant),
      this.getBattleRoyaleClaimable(matchId, autonomyParticipant),
      this.getBattleRoyaleEffectiveNfa(matchId, autonomyParticipant),
      this.getBattleRoyaleRoomChangeCount(matchId, autonomyParticipant),
    ]);

    if (
      autonomyInfo.roomId > 0 ||
      autonomyInfo.stake > 0n ||
      autonomyClaimable > 0n ||
      autonomyEffectiveNfa === nfaId ||
      autonomyRoomChangeCount > 0
    ) {
      return {
        participant: autonomyParticipant,
        roomId: autonomyInfo.roomId,
        stake: autonomyInfo.stake,
        claimable: autonomyClaimable,
        effectiveNfa: autonomyEffectiveNfa,
        roomChangeCount: autonomyRoomChangeCount,
        isLegacyOwnerParticipant: false,
      };
    }

    const owner = await this.getNFAOwner(nfaId);
    const [ownerInfo, ownerClaimable, ownerEffectiveNfa, ownerRoomChangeCount] = await Promise.all([
      this.getBattleRoyalePlayerInfo(matchId, owner),
      this.getBattleRoyaleClaimable(matchId, owner),
      this.getBattleRoyaleEffectiveNfa(matchId, owner),
      this.getBattleRoyaleRoomChangeCount(matchId, owner),
    ]);

    return {
      participant: owner,
      roomId: ownerInfo.roomId,
      stake: ownerInfo.stake,
      claimable: ownerClaimable,
      effectiveNfa: ownerEffectiveNfa,
      roomChangeCount: ownerRoomChangeCount,
      isLegacyOwnerParticipant: true,
    };
  }

  // ============================================
  // READ: World State
  // ============================================

  async getWorldState(): Promise<{
    rewardMultiplier: number;
    pkStakeLimit: string;
    mutationBonus: number;
    dailyCostMultiplier: number;
    activeEvents: string[];
    clwPrice: string;
  }> {
    const [rewardMul, pkLimit, mutBonus, costMul, events, price] = await Promise.all([
      this.worldState.rewardMultiplier(),
      this.worldState.pkStakeLimit(),
      this.worldState.mutationBonus(),
      this.worldState.dailyCostMultiplier(),
      this.worldState.activeEvents(),
      this.worldState.getCLWPrice().catch(() => ethers.BigNumber.from(0)),
    ]);

    // Parse event flags
    const eventNum = ethers.BigNumber.from(events).toNumber();
    const activeEvents: string[] = [];
    if (eventNum & 1) activeEvents.push('泡沫');
    if (eventNum & 2) activeEvents.push('寒冬');
    if (eventNum & 4) activeEvents.push('黄金时代');

    return {
      rewardMultiplier: rewardMul.toNumber(),
      pkStakeLimit: ethers.utils.formatEther(pkLimit),
      mutationBonus: mutBonus.toNumber(),
      dailyCostMultiplier: costMul.toNumber(),
      activeEvents,
      clwPrice: ethers.utils.formatEther(price),
    };
  }

  // ============================================
  // WRITE: CLW Operations
  // ============================================

  async depositCLW(nfaId: number, amount: string): Promise<string> {
    const amountWei = ethers.utils.parseEther(amount);
    // Check and approve if needed
    const signerAddr = await this.signer.getAddress();
    const allowance = await this.clw.allowance(signerAddr, this.router.address);
    if (allowance.lt(amountWei)) {
      const approveTx = await this.clw.approve(this.router.address, ethers.constants.MaxUint256);
      await approveTx.wait();
    }
    const tx = await this.router.depositCLW(nfaId, amountWei);
    const receipt = await tx.wait();
    return receipt.transactionHash;
  }

  async buyAndDeposit(nfaId: number, bnbAmount: string): Promise<string> {
    const tx = await this.depositRouter.buyAndDeposit(nfaId, {
      value: ethers.utils.parseEther(bnbAmount),
    });
    const receipt = await tx.wait();
    return receipt.transactionHash;
  }

  async requestWithdraw(nfaId: number, amount: string): Promise<string> {
    const tx = await this.router.requestWithdrawCLW(nfaId, ethers.utils.parseEther(amount));
    const receipt = await tx.wait();
    return receipt.transactionHash;
  }

  async updateLearningTreeByOwner(nfaId: number, hash: string): Promise<string> {
    const tx = await this.nfaWriter.updateLearningTreeByOwner(nfaId, hash);
    const receipt = await tx.wait();
    return receipt.transactionHash;
  }

  // ============================================
  // WRITE: PK Operations
  // ============================================

  async createPKMatch(nfaId: number, stake: string): Promise<string> {
    const tx = await this.pk.createMatch(nfaId, ethers.utils.parseEther(stake));
    const receipt = await tx.wait();
    return receipt.transactionHash;
  }

  async joinPKMatch(matchId: number, nfaId: number): Promise<string> {
    const tx = await this.pk.joinMatch(matchId, nfaId);
    const receipt = await tx.wait();
    return receipt.transactionHash;
  }

  async commitPKStrategy(matchId: number, strategy: number, salt: string): Promise<string> {
    const signerAddr = await this.signer.getAddress();
    const saltBytes = ethers.utils.formatBytes32String(salt);
    const hash = await this.pk.getStrategyHash(strategy, saltBytes, signerAddr);
    const tx = await this.pk.commitStrategy(matchId, hash);
    const receipt = await tx.wait();
    return receipt.transactionHash;
  }

  async revealPKStrategy(matchId: number, strategy: number, salt: string): Promise<string> {
    const saltBytes = ethers.utils.formatBytes32String(salt);
    const tx = await this.pk.revealStrategy(matchId, strategy, saltBytes);
    const receipt = await tx.wait();
    return receipt.transactionHash;
  }

  async settlePK(matchId: number): Promise<string> {
    const tx = await this.pk.settle(matchId);
    const receipt = await tx.wait();
    return receipt.transactionHash;
  }

  async getStrategyHash(strategy: number, salt: string, sender: string): Promise<string> {
    return this.pk.getStrategyHash(strategy, salt, sender);
  }

  async getSignerAddress(): Promise<string> {
    return this.signer.getAddress();
  }

  // ============================================
  // WRITE: Task Operations
  // ============================================

  async completeTypedTask(
    nfaId: number,
    taskType: number,
    xpReward: number,
    clwReward: number,
    matchScore: number
  ): Promise<string> {
    const clwWei = ethers.utils.parseEther(clwReward.toString());
    const tx = await this.task.completeTypedTask(nfaId, taskType, xpReward, clwWei, matchScore);
    const receipt = await tx.wait();
    return receipt.transactionHash;
  }

  async isTaskOperator(address: string): Promise<boolean> {
    return this.task.operators(address);
  }

  async getTaskLastTime(nfaId: number): Promise<number> {
    const value = await this.task.lastTaskTime(nfaId);
    return value.toNumber();
  }

  async getTaskStats(nfaId: number): Promise<{
    total: number;
    clwEarned: string;
    counts: [number, number, number, number, number];
  }> {
    const [total, clwEarned, courage, wisdom, social, create, grit] = await this.task.getTaskStats(nfaId);
    return {
      total: Number(total),
      clwEarned: ethers.utils.formatEther(clwEarned),
      counts: [Number(courage), Number(wisdom), Number(social), Number(create), Number(grit)],
    };
  }

  async previewTypedTaskOutcome(
    nfaId: number,
    taskType: number,
    xpReward: number,
    clwReward: string
  ): Promise<{
    matchScore: number;
    actualClw: string;
    streakMul: number;
    worldMul: number;
    cooldownReady: boolean;
    personalityDrift: boolean;
  }> {
    const clwRewardWei = ethers.utils.parseEther(clwReward);
    const [matchScore, actualClw, streakMul, worldMul, cooldownReady, personalityDrift] =
      await this.task.previewTypedTaskOutcome(nfaId, taskType, xpReward, clwRewardWei);
    return {
      matchScore: Number(matchScore),
      actualClw: ethers.utils.formatEther(actualClw),
      streakMul: Number(streakMul),
      worldMul: Number(worldMul),
      cooldownReady: Boolean(cooldownReady),
      personalityDrift: Boolean(personalityDrift),
    };
  }

  // ============================================
  // WRITE: Market Operations
  // ============================================

  async listFixedPrice(nfaId: number, priceBNB: string): Promise<string> {
    const tx = await this.market.listFixedPrice(nfaId, ethers.utils.parseEther(priceBNB));
    const receipt = await tx.wait();
    return receipt.transactionHash;
  }

  async listAuction(nfaId: number, startPriceBNB: string): Promise<string> {
    const tx = await this.market.listAuction(nfaId, ethers.utils.parseEther(startPriceBNB));
    const receipt = await tx.wait();
    return receipt.transactionHash;
  }

  async listSwap(nfaId: number, targetNfaId: number): Promise<string> {
    const tx = await this.market.listSwap(nfaId, targetNfaId);
    const receipt = await tx.wait();
    return receipt.transactionHash;
  }

  async buyFixedPrice(listingId: number, priceBNB: string): Promise<string> {
    const tx = await this.market.buyFixedPrice(listingId, { value: ethers.utils.parseEther(priceBNB) });
    const receipt = await tx.wait();
    return receipt.transactionHash;
  }

  async bidOnAuction(listingId: number, bidBNB: string): Promise<string> {
    const tx = await this.market.bid(listingId, { value: ethers.utils.parseEther(bidBNB) });
    const receipt = await tx.wait();
    return receipt.transactionHash;
  }

  async settleAuction(listingId: number): Promise<string> {
    const tx = await this.market.settleAuction(listingId);
    const receipt = await tx.wait();
    return receipt.transactionHash;
  }

  async acceptSwap(listingId: number): Promise<string> {
    const tx = await this.market.acceptSwap(listingId);
    const receipt = await tx.wait();
    return receipt.transactionHash;
  }

  async cancelListing(listingId: number): Promise<string> {
    const tx = await this.market.cancelListing(listingId);
    const receipt = await tx.wait();
    return receipt.transactionHash;
  }

  async getMarketListing(listingId: number): Promise<{
    nfaId: number; seller: string; listingType: number;
    price: string; highestBid: string; highestBidder: string;
    endTime: number; swapTargetId: number; active: boolean;
  }> {
    const l = await this.market.listings(listingId);
    return {
      nfaId: l.nfaId.toNumber(), seller: l.seller, listingType: l.listingType,
      price: ethers.utils.formatEther(l.price),
      highestBid: ethers.utils.formatEther(l.highestBid),
      highestBidder: l.highestBidder,
      endTime: l.endTime, swapTargetId: l.swapTargetId.toNumber(), active: l.active,
    };
  }

  async getMarketListingCount(): Promise<number> {
    const count = await this.market.listingCount();
    return count.toNumber();
  }

  async approveNFAForMarket(nfaId: number): Promise<string> {
    const nfaWithSigner = this.nfa.connect(this.signer);
    const tx = await nfaWithSigner.setApprovalForAll(this.addresses.marketSkill, true);
    const receipt = await tx.wait();
    return receipt.transactionHash;
  }

  // ============================================
  // WRITE: Oracle Operations
  // ============================================

  async fulfillReasoning(requestId: number, choice: number, reasoningCid: string): Promise<string> {
    const tx = await this.oracle.fulfillReasoning(requestId, choice, reasoningCid);
    const receipt = await tx.wait();
    return receipt.transactionHash;
  }

  getOracleContract(): ethers.Contract {
    return this.oracle;
  }
}
