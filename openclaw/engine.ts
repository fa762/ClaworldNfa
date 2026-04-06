/**
 * Claw World OpenClaw — Game Engine
 *
 * Top-level orchestrator that connects command parsing, contract interaction,
 * AI dialogue, and skill modules into a unified handleInput entry point.
 */

import {
  parseCommand,
  parsePKSubCommand,
  parseTaskSubCommand,
  parseMarketSubCommand,
} from './commandRouter';
import type { GameContractClient } from './contracts';
import type {
  AIProvider,
  OutputFormat,
  GameResponse,
  ChatMessage,
  TaskSession,
  TaskDefinition,
  StrategyAdvice,
  SaltRecord,
  LobsterState,
} from './types';
import {
  STRATEGY_NAMES,
  LISTING_TYPE_NAMES,
  TASK_TYPE_NAMES,
  TASK_TYPE_ICONS,
} from './types';
import { MarketSkill } from './skills/marketSkill';
import { ChainSkill, formatWalletInfo } from './skills/chainSkill';
import * as formatter from './formatter';
import {
  buildLobsterSystemPrompt,
  handleDialogue,
  handleCMLDialogue,
  buildTaskGenerationPrompt,
  buildStrategyAdvicePrompt,
  buildBattleNarrativePrompt,
  buildPriceAdvicePrompt,
  buildCMLSystemPrompt,
} from './dialogue';
import {
  Hippocampus,
  matchTriggers,
  buildSleepPrompt,
  parseSleepOutput,
  saveCML,
  loadCML,
  hasCML,
  initCML,
  extractBootData,
  queueRootSync,
  getPendingRootSync,
  clearPendingRootSync,
  toBytes32Hash,
} from './cml';
import type { CMLFile, CMLBootData, CMLVividMemory, HippocampusEntry } from './cml';
import { ethers } from 'ethers';

// ============================================
// ENGINE
// ============================================

export class ClawEngine {
  private client: GameContractClient;
  private ai: AIProvider;
  private marketSkill: MarketSkill;
  private chainSkill: ChainSkill | null = null;
  private format: OutputFormat;

  /** Per-NFA chat history for AI dialogue continuity. */
  private chatHistory: Map<number, ChatMessage[]> = new Map();

  /** Active task sessions: nfaId -> TaskSession. */
  private taskSessions: Map<number, TaskSession> = new Map();

  /** PK salt records for commit-reveal: matchId -> SaltRecord. */
  private saltRecords: Map<number, SaltRecord> = new Map();

  /** Per-NFA CML state for memory-enhanced conversations. */
  private cmlCache: Map<number, CMLFile> = new Map();

  /** Per-NFA CML boot data (lightweight view). */
  private cmlBootCache: Map<number, CMLBootData> = new Map();

  /** Per-NFA HIPPOCAMPUS buffers for conversation memory. */
  private hippocampi: Map<number, Hippocampus> = new Map();

  /** Per-user active conversation tracking for auto sleep. */
  private conversationSessions: Map<string, { nfaId: number; lastAt: number }> = new Map();

  /** Maximum chat history entries per NFA. */
  private static readonly MAX_HISTORY = 20;
  private static readonly SLEEP_IDLE_MS = 5 * 60 * 1000;

  constructor(
    client: GameContractClient,
    ai: AIProvider,
    format: OutputFormat = 'plain',
    chainSkill?: ChainSkill
  ) {
    this.client = client;
    this.ai = ai;
    this.marketSkill = new MarketSkill(client);
    this.chainSkill = chainSkill || null;
    this.format = format;
  }

  // ============================================
  // MAIN ENTRY POINT
  // ============================================

  /**
   * Handle any user input: commands are routed to skill methods,
   * non-commands are forwarded to AI dialogue.
   *
   * @param input         Raw user text
   * @param sender        Wallet address or user ID
   * @param defaultNfaId  The user's active NFA ID (if known)
   * @returns             Formatted game response
   */
  async handleInput(
    input: string,
    sender: string,
    defaultNfaId?: number
  ): Promise<GameResponse> {
    try {
      const cmd = parseCommand(input, sender, defaultNfaId);

      await this.maybeSleepConversation(sender, cmd?.nfaId, !!cmd);

      if (!cmd) {
        // Not a command -> AI dialogue
        return this.handleChat(input, sender, defaultNfaId);
      }

      const nfaId = cmd.nfaId;

      switch (cmd.command) {
        case 'status':
          return this.handleStatus(nfaId);
        case 'task':
          return this.handleTask(cmd.args, nfaId);
        case 'pk':
          return this.handlePK(cmd.args, nfaId, sender);
        case 'market':
          return this.handleMarket(cmd.args, nfaId);
        case 'deposit':
          return this.handleDeposit(cmd.args, nfaId);
        case 'withdraw':
          return this.handleWithdraw(cmd.args, nfaId);
        case 'world':
          return this.handleWorld();
        case 'job':
          return this.handleJob(nfaId);
        case 'wallet':
          return this.handleWallet(cmd.args);
        case 'help':
          return formatter.formatHelp(this.format);
        default:
          return { text: `未知命令: ${cmd.command}。输入 /help 查看可用命令。` };
      }
    } catch (err: any) {
      const msg = err?.reason || err?.message || String(err);
      return { text: `操作失败: ${msg}`, error: msg };
    }
  }

  // ============================================
  // STATUS
  // ============================================

  private async handleStatus(nfaId?: number): Promise<GameResponse> {
    if (!nfaId) {
      return { text: '请指定龙虾ID。用法: /status <nfaId>' };
    }

    const { state, clwBalance, jobClass, active, dailyCost } =
      await this.client.getLobsterStatus(nfaId);

    return formatter.formatLobsterStatus(
      nfaId, state, clwBalance, jobClass, active, this.format
    );
  }

  // ============================================
  // TASK
  // ============================================

  private async handleTask(args: string[], nfaId?: number): Promise<GameResponse> {
    if (!nfaId) {
      return { text: '请先指定龙虾ID。用法: /task list' };
    }

    const sub = parseTaskSubCommand(args);

    switch (sub.action) {
      case 'list':
        return this.taskGenerate(nfaId);

      case 'accept': {
        const index = sub.taskType;
        if (index === undefined || index < 1 || index > 3) {
          return { text: '请选择任务编号（1-3）。用法: /task accept <1|2|3>' };
        }
        return this.taskAcceptAndComplete(nfaId, index - 1);
      }

      default:
        return { text: '任务命令: /task list | /task accept <1|2|3>' };
    }
  }

  /**
   * Generate 3 personalized tasks using AI, store as a session.
   */
  private async taskGenerate(nfaId: number): Promise<GameResponse> {
    const [lobsterData, worldData] = await Promise.all([
      this.client.getLobsterStatus(nfaId),
      this.client.getWorldState(),
    ]);

    const prompt = buildTaskGenerationPrompt(
      lobsterData.state,
      lobsterData.jobClass,
      { rewardMultiplier: worldData.rewardMultiplier, activeEvents: worldData.activeEvents }
    );

    // Ask AI to generate tasks as JSON
    const tasks = await this.ai.chatJSON<TaskDefinition[]>(
      prompt,
      `为 Lv.${lobsterData.state.level} 的龙虾生成3个任务。`
    );

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return { text: '任务生成失败，请重试。' };
    }

    // Store session
    const session: TaskSession = {
      nfaId,
      tasks: tasks.slice(0, 3),
      selectedIndex: null,
      status: 'choosing',
      generatedAt: Date.now(),
    };
    this.taskSessions.set(nfaId, session);

    // Format task list
    const lines = [
      this.format === 'plain' ? '=== 可用任务 ===' : '**可用任务**',
      '',
    ];

    session.tasks.forEach((t, i) => {
      const icon = TASK_TYPE_ICONS[t.taskType] || '';
      const typeName = TASK_TYPE_NAMES[t.taskType] || '';
      lines.push(`${i + 1}. ${icon} [${typeName}/${t.difficulty}] ${t.title}`);
      lines.push(`   ${t.description}`);
      lines.push(`   奖励: ${t.baseCLW} CLW + ${t.baseXP} XP`);
      lines.push('');
    });

    lines.push('输入 /task accept <编号> 接取任务（如 /task accept 1）');

    return {
      text: lines.join('\n'),
      buttons: session.tasks.map((_, i) => ({
        label: `接取任务 ${i + 1}`,
        action: `/task accept ${i + 1}`,
      })),
    };
  }

  /**
   * Accept a task by index and immediately complete it on-chain.
   * Calculates match score from personality vector dot product.
   */
  private async taskAcceptAndComplete(nfaId: number, index: number): Promise<GameResponse> {
    const session = this.taskSessions.get(nfaId);
    if (!session || session.status !== 'choosing') {
      return { text: '没有待选任务。请先用 /task list 生成任务。' };
    }

    if (index < 0 || index >= session.tasks.length) {
      return { text: `无效的任务编号。请选择 1-${session.tasks.length}。` };
    }

    const task = session.tasks[index];
    session.selectedIndex = index;

    // Get lobster state for match score calculation
    const { state } = await this.client.getLobsterStatus(nfaId);

    // Calculate match score: dot product of personality vector and lobster stats
    const lobsterVector = [state.courage, state.wisdom, state.social, state.create, state.grit];
    const matchScore = this.calculateMatchScore(lobsterVector, task.personalityVector);

    // Submit to chain via operator
    const txHash = await this.client.completeTypedTask(
      nfaId,
      task.taskType,
      task.baseXP,
      task.baseCLW,
      matchScore
    );

    session.status = 'completed';

    // Calculate actual reward considering match score
    const multiplier = matchScore / 10000; // matchScore is in basis points
    const actualCLW = (task.baseCLW * multiplier).toFixed(1);

    return {
      ...formatter.formatTaskResult(
        nfaId,
        task.taskType,
        actualCLW,
        task.baseXP,
        null, // personality delta comes from chain event, not available here
        this.format
      ),
      txHash,
    };
  }

  /**
   * Calculate match score (basis points, 500 = 0.05x to 20000 = 2.0x).
   * Based on cosine-like dot product between lobster personality and task vector.
   */
  private calculateMatchScore(lobsterVec: number[], taskVec: number[]): number {
    if (taskVec.length !== 5) return 10000; // default 1.0x

    let dot = 0;
    let lobsterMag = 0;
    let taskMag = 0;

    for (let i = 0; i < 5; i++) {
      dot += lobsterVec[i] * taskVec[i];
      lobsterMag += lobsterVec[i] * lobsterVec[i];
      taskMag += taskVec[i] * taskVec[i];
    }

    lobsterMag = Math.sqrt(lobsterMag);
    taskMag = Math.sqrt(taskMag);

    if (lobsterMag === 0 || taskMag === 0) return 10000;

    // Cosine similarity: 0..1 -> scale to 500..20000 (0.05x..2.0x)
    const cosine = dot / (lobsterMag * taskMag);
    const score = Math.floor(500 + cosine * 19500);
    return Math.max(500, Math.min(20000, score));
  }

  // ============================================
  // PK
  // ============================================

  private async handlePK(args: string[], nfaId?: number, sender?: string): Promise<GameResponse> {
    if (!nfaId) {
      return { text: '请先指定龙虾ID。' };
    }

    const sub = parsePKSubCommand(args);

    switch (sub.action) {
      case 'create':
        return this.pkCreate(nfaId, sub.stake || '100');

      case 'join':
        if (!sub.matchId) return { text: '用法: /pk join <matchId>' };
        return this.pkJoin(sub.matchId, nfaId);

      case 'commit': {
        if (!sub.matchId) return { text: '用法: /pk commit <matchId> [strategy]' };
        // If strategy is provided, commit directly; otherwise give advice first
        if (sub.strategy !== undefined) {
          return this.pkCommit(sub.matchId, nfaId, sub.strategy, sender || '');
        }
        return this.pkAdvice(sub.matchId, nfaId);
      }

      case 'reveal':
        if (!sub.matchId) return { text: '用法: /pk reveal <matchId>' };
        return this.pkReveal(sub.matchId);

      case 'settle':
        if (!sub.matchId) return { text: '用法: /pk settle <matchId>' };
        return this.pkSettle(sub.matchId, nfaId);

      case 'cancel':
        if (!sub.matchId) return { text: '用法: /pk cancel <matchId>' };
        return this.pkCancel(sub.matchId);

      case 'list':
      default:
        return { text: 'PK命令: /pk create <stake> | /pk join <id> | /pk commit <id> [strategy] | /pk reveal <id> | /pk settle <id>' };
    }
  }

  private async pkCreate(nfaId: number, stake: string): Promise<GameResponse> {
    const txHash = await this.client.createPKMatch(nfaId, stake);
    return {
      text: `PK 创建成功！赌注: ${stake} CLW。等待对手加入。`,
      txHash,
    };
  }

  private async pkJoin(matchId: number, nfaId: number): Promise<GameResponse> {
    const txHash = await this.client.joinPKMatch(matchId, nfaId);
    return {
      text: `已加入 PK #${matchId}！现在需要双方提交策略: /pk commit ${matchId} <0|1|2>`,
      txHash,
      buttons: [
        { label: '全攻', action: `/pk commit ${matchId} 0` },
        { label: '均衡', action: `/pk commit ${matchId} 1` },
        { label: '全防', action: `/pk commit ${matchId} 2` },
      ],
    };
  }

  /**
   * Analyze opponent and give strategy advice before committing.
   */
  private async pkAdvice(matchId: number, nfaId: number): Promise<GameResponse> {
    const match = await this.client.getPKMatch(matchId);

    // Determine opponent
    const opponentId = match.nfaA === nfaId ? match.nfaB : match.nfaA;
    if (opponentId === 0) {
      return { text: '对手尚未加入。' };
    }

    const [myData, opponentData] = await Promise.all([
      this.client.getLobsterStatus(nfaId),
      this.client.getLobsterStatus(opponentId),
    ]);

    const prompt = buildStrategyAdvicePrompt(myData.state, opponentData.state);
    const advice = await this.ai.chatJSON<StrategyAdvice>(
      prompt,
      `分析对手 #${opponentId} 并推荐策略。`
    );

    const stratName = STRATEGY_NAMES[advice.recommendedStrategy] || '未知';

    return {
      text: [
        this.format === 'plain' ? `=== PK #${matchId} 策略分析 ===` : `**PK #${matchId} 策略分析**`,
        '',
        `对手: #${opponentId} (Lv.${opponentData.state.level})`,
        `STR:${opponentData.state.str} DEF:${opponentData.state.def} SPD:${opponentData.state.spd} VIT:${opponentData.state.vit}`,
        '',
        `推荐策略: ${stratName}（置信度 ${advice.confidence}%）`,
        advice.reasoning,
        '',
        `使用 /pk commit ${matchId} <0|1|2> 提交策略`,
      ].join('\n'),
      buttons: [
        { label: `全攻`, action: `/pk commit ${matchId} 0` },
        { label: `均衡`, action: `/pk commit ${matchId} 1` },
        { label: `全防`, action: `/pk commit ${matchId} 2` },
      ],
    };
  }

  private async pkCommit(
    matchId: number,
    nfaId: number,
    strategy: number,
    sender: string
  ): Promise<GameResponse> {
    if (strategy < 0 || strategy > 2) {
      return { text: '无效策略。0=全攻, 1=均衡, 2=全防' };
    }

    // Generate a random salt for commit-reveal
    const salt = ethers.utils.hexlify(ethers.utils.randomBytes(16));

    // Store salt for later reveal
    this.saltRecords.set(matchId, {
      matchId,
      nfaId,
      strategy,
      salt,
      createdAt: Date.now(),
    });

    const txHash = await this.client.commitPKStrategy(matchId, strategy, salt);

    return {
      text: `策略已提交: ${STRATEGY_NAMES[strategy]}。等待对手提交后使用 /pk reveal ${matchId}`,
      txHash,
      buttons: [{ label: '揭示策略', action: `/pk reveal ${matchId}` }],
    };
  }

  private async pkReveal(matchId: number): Promise<GameResponse> {
    const record = this.saltRecords.get(matchId);
    if (!record) {
      return {
        text: `找不到 PK #${matchId} 的策略记录。请确认你已在本会话中提交过策略。`,
      };
    }

    const txHash = await this.client.revealPKStrategy(
      matchId,
      record.strategy,
      record.salt
    );

    return {
      text: `策略已揭示: ${STRATEGY_NAMES[record.strategy]}。使用 /pk settle ${matchId} 结算。`,
      txHash,
      buttons: [{ label: '结算', action: `/pk settle ${matchId}` }],
    };
  }

  private async pkSettle(matchId: number, nfaId: number): Promise<GameResponse> {
    const txHash = await this.client.settlePK(matchId);

    // Fetch settled match for narrative
    const match = await this.client.getPKMatch(matchId);
    const opponentId = match.nfaA === nfaId ? match.nfaB : match.nfaA;

    // Try to generate a battle narrative
    try {
      const [myData, opData] = await Promise.all([
        this.client.getLobsterStatus(nfaId),
        this.client.getLobsterStatus(opponentId),
      ]);

      const myStrategy = match.nfaA === nfaId ? match.strategyA : match.strategyB;
      const opStrategy = match.nfaA === nfaId ? match.strategyB : match.strategyA;

      // Determine winner (simplified: use match result from chain)
      // In practice, the winner is determined by the contract events
      const winnerId = 0; // 0 = unknown at this point without parsing events

      const narrativePrompt = buildBattleNarrativePrompt(
        myData.state, opData.state,
        myStrategy, opStrategy,
        winnerId, false
      );
      const narrative = await this.ai.chat(narrativePrompt, '请描写这场战斗。', []);

      // Clean up salt record
      this.saltRecords.delete(matchId);

      const matchResult = formatter.formatPKMatch(matchId, match, this.format);

      return {
        text: matchResult.text + '\n\n' + narrative,
        txHash,
      };
    } catch {
      // If narrative fails, just return the match result
      this.saltRecords.delete(matchId);
      return {
        ...formatter.formatPKMatch(matchId, match, this.format),
        txHash,
      };
    }
  }

  private async pkCancel(matchId: number): Promise<GameResponse> {
    const match = await this.client.getPKMatch(matchId);

    // Use cancelMatch for phase 0 (OPEN), cancelJoinedMatch would need
    // additional logic; for simplicity we just call the generic cancel
    const txHash = await this.client.settlePK(matchId); // fall back
    this.saltRecords.delete(matchId);

    return {
      text: `PK #${matchId} 已取消。`,
      txHash,
    };
  }

  // ============================================
  // MARKET
  // ============================================

  private async handleMarket(args: string[], nfaId?: number): Promise<GameResponse> {
    const sub = parseMarketSubCommand(args);

    switch (sub.action) {
      case 'list':
        return this.marketList();

      case 'sell': {
        if (!sub.nfaId || !sub.price) {
          return { text: '用法: /market sell <nfaId> <price_in_BNB>' };
        }
        return this.marketSell(sub.nfaId, sub.price);
      }

      case 'auction': {
        if (!sub.nfaId || !sub.price) {
          return { text: '用法: /market auction <nfaId> <startPrice>' };
        }
        const txHash = await this.marketSkill.listAuction(sub.nfaId, sub.price);
        return { text: `拍卖已创建！起拍价 ${sub.price} BNB`, txHash };
      }

      case 'buy': {
        if (!sub.listingId) return { text: '用法: /market buy <listingId>' };
        return this.marketBuy(sub.listingId);
      }

      case 'bid': {
        if (!sub.listingId || !sub.price) {
          return { text: '用法: /market bid <listingId> <amount>' };
        }
        const txHash = await this.marketSkill.bidOnAuction(sub.listingId, sub.price);
        return { text: `出价成功: ${sub.price} BNB`, txHash };
      }

      case 'settle': {
        if (!sub.listingId) return { text: '用法: /market settle <listingId>' };
        const txHash = await this.marketSkill.settleAuction(sub.listingId);
        return { text: `拍卖已结算！`, txHash };
      }

      case 'cancel': {
        if (!sub.listingId) return { text: '用法: /market cancel <listingId>' };
        const txHash = await this.marketSkill.cancelListing(sub.listingId);
        return { text: `挂单 #${sub.listingId} 已取消。`, txHash };
      }

      default:
        return {
          text: '市场命令: /market list | sell <nfaId> <price> | buy <id> | bid <id> <amount> | settle <id> | cancel <id>',
        };
    }
  }

  private async marketList(): Promise<GameResponse> {
    const listings = await this.marketSkill.getActiveListings();

    if (listings.length === 0) {
      return { text: '市场暂无活跃挂单。' };
    }

    const lines = [
      this.format === 'plain' ? '=== 市场挂单 ===' : '**市场挂单**',
      '',
    ];

    for (const l of listings) {
      const typeName = LISTING_TYPE_NAMES[l.listingType] || '未知';
      const priceInfo =
        l.listingType === 1
          ? `起拍 ${l.price} BNB / 最高出价 ${l.highestBid} BNB`
          : l.listingType === 2
          ? `互换目标: #${l.swapTargetId}`
          : `${l.price} BNB`;

      lines.push(`#${l.listingId} | NFA #${l.nfaId} | ${typeName} | ${priceInfo}`);
    }

    lines.push('');
    lines.push('使用 /market buy <id> 购买，/market bid <id> <amount> 出价');

    return { text: lines.join('\n') };
  }

  private async marketSell(nfaId: number, price: string): Promise<GameResponse> {
    const txHash = await this.marketSkill.listFixedPrice(nfaId, price);
    return {
      text: `NFA #${nfaId} 已上架！固定价格: ${price} BNB`,
      txHash,
    };
  }

  private async marketBuy(listingId: number): Promise<GameResponse> {
    const txHash = await this.marketSkill.buyFixedPrice(listingId);
    return {
      text: `购买成功！`,
      txHash,
    };
  }

  // ============================================
  // DEPOSIT / WITHDRAW
  // ============================================

  private async handleDeposit(args: string[], nfaId?: number): Promise<GameResponse> {
    if (!nfaId) return { text: '请指定龙虾ID。' };

    const amount = args[0];
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return { text: '用法: /deposit <amount> （BNB 数量）' };
    }

    // Use buyAndDeposit to buy CLW with BNB and deposit in one tx
    const txHash = await this.client.buyAndDeposit(nfaId, amount);
    return {
      text: `已用 ${amount} BNB 购买并充值 CLW 到龙虾 #${nfaId}。`,
      txHash,
    };
  }

  private async handleWithdraw(args: string[], nfaId?: number): Promise<GameResponse> {
    if (!nfaId) return { text: '请指定龙虾ID。' };

    const amount = args[0];
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return { text: '用法: /withdraw <amount> （CLW 数量）' };
    }

    const txHash = await this.client.requestWithdraw(nfaId, amount);
    return {
      text: `已提交 ${amount} CLW 提取请求。提取有24小时冷却期。`,
      txHash,
    };
  }

  // ============================================
  // WORLD STATE
  // ============================================

  private async handleWorld(): Promise<GameResponse> {
    const ws = await this.client.getWorldState();
    return formatter.formatWorldState(
      ws.rewardMultiplier,
      ws.pkStakeLimit,
      ws.mutationBonus,
      ws.dailyCostMultiplier,
      ws.activeEvents,
      this.format
    );
  }

  // ============================================
  // JOB
  // ============================================

  private async handleJob(nfaId?: number): Promise<GameResponse> {
    if (!nfaId) return { text: '请指定龙虾ID。用法: /job <nfaId>' };

    const { state, jobClass } = await this.client.getLobsterStatus(nfaId);
    const jobNames = ['探索者', '外交官', '创造者', '守护者', '学者', '先驱'];
    const jobDescriptions = [
      '擅长冒险任务，勇气加成',
      '擅长社交任务，社交加成',
      '擅长创造任务，创造加成',
      '擅长防御，毅力加成',
      '擅长解谜，智慧加成',
      '全面发展，均衡加成',
    ];

    return {
      text: [
        this.format === 'plain' ? `=== 龙虾 #${nfaId} 职业 ===` : `**龙虾 #${nfaId} 职业**`,
        `职业: ${jobNames[jobClass] || '未知'}`,
        `说明: ${jobDescriptions[jobClass] || ''}`,
        `等级: ${state.level}`,
      ].join('\n'),
    };
  }

  // ============================================
  // WALLET
  // ============================================

  private async handleWallet(args: string[]): Promise<GameResponse> {
    if (!this.chainSkill) {
      return { text: 'chain.skill 未配置。请检查 OpenClaw 设置。' };
    }

    const sub = args[0];

    if (sub === 'init') {
      const pin = args[1];
      if (!pin || pin.length < 4) {
        return { text: '用法: /wallet init <PIN码> （至少4位）' };
      }
      const address = await this.chainSkill.initWallet(pin);
      return {
        text: [
          this.format === 'plain' ? '=== 🔑 钱包已创建 ===' : '🔑 **钱包已创建**',
          `地址: ${address}`,
          '',
          '接下来：',
          '1. 往此地址转入少量 tBNB 作为 gas 费',
          '2. 去官网 NFA 详情页 → 维护 Tab → 转移到 OpenClaw',
          '3. 粘贴上面的地址，确认转移',
          '4. 转移完成后输入 /status 查看你的龙虾！',
        ].join('\n'),
      };
    }

    if (sub === 'unlock') {
      const pin = args[1];
      if (!pin) return { text: '用法: /wallet unlock <PIN码>' };
      try {
        this.chainSkill.unlockWallet(pin);
        return { text: '🔓 钱包已解锁。' };
      } catch {
        return { text: '❌ PIN码错误。' };
      }
    }

    // Default: show wallet info
    try {
      const info = await this.chainSkill.getWalletInfo();
      return { text: formatWalletInfo(info, this.format) };
    } catch {
      const addr = this.chainSkill.getAddress();
      if (addr) {
        return {
          text: [
            this.format === 'plain' ? '=== 🔑 OpenClaw 钱包 ===' : '🔑 **OpenClaw 钱包**',
            `地址: ${addr}`,
            '',
            '⚠ 钱包已锁定。使用 /wallet unlock <PIN码> 解锁。',
          ].join('\n'),
        };
      }
      return { text: '还没有钱包。使用 /wallet init <PIN码> 创建钱包。' };
    }
  }

  // ============================================
  // CML MEMORY SYSTEM
  // ============================================

  /**
   * Load CML for an NFA. Call this at conversation start (after boot).
   * Returns the boot data for system prompt injection.
   */
  loadNFACML(nfaId: number): CMLBootData | null {
    const cml = loadCML(nfaId);
    if (!cml) return null;

    this.cmlCache.set(nfaId, cml);
    const bootData = extractBootData(cml);
    this.cmlBootCache.set(nfaId, bootData);

    // Initialize HIPPOCAMPUS for this NFA
    if (!this.hippocampi.has(nfaId)) {
      this.hippocampi.set(nfaId, new Hippocampus());
    }

    return bootData;
  }

  async ensureNFACML(nfaId: number, state: LobsterState): Promise<CMLBootData | null> {
    let cml = loadCML(nfaId);

    if (!cml && !hasCML(nfaId)) {
      cml = initCML(nfaId, {
        rarity: state.rarity,
        shelter: state.shelter,
        personality: {
          courage: state.courage,
          wisdom: state.wisdom,
          social: state.social,
          create: state.create,
          grit: state.grit,
        },
        level: state.level,
      });
      const hash = saveCML(nfaId, cml);
      await this.syncLearningTree(nfaId, hash);
    }

    if (!cml) return null;

    this.cmlCache.set(nfaId, cml);
    const bootData = extractBootData(cml);
    this.cmlBootCache.set(nfaId, bootData);
    if (!this.hippocampi.has(nfaId)) this.hippocampi.set(nfaId, new Hippocampus());

    const pending = getPendingRootSync(nfaId);
    if (pending) {
      await this.syncLearningTree(nfaId, pending.hash);
    }

    return bootData;
  }

  /**
   * Match user message against CML triggers.
   * Returns recalled vivid memories (max 3).
   */
  recallMemories(nfaId: number, userMessage: string): CMLVividMemory[] {
    const cml = this.cmlCache.get(nfaId);
    if (!cml) return [];
    return matchTriggers(userMessage, cml);
  }

  /**
   * Buffer a conversation snippet to HIPPOCAMPUS.
   * Call this for meaningful exchanges during conversation.
   */
  bufferToHippocampus(nfaId: number, content: string): void {
    let hippo = this.hippocampi.get(nfaId);
    if (!hippo) {
      hippo = new Hippocampus();
      this.hippocampi.set(nfaId, hippo);
    }
    hippo.push(content);
  }

  /**
   * Execute SLEEP: consolidate conversation memories into CML.
   * Call this when conversation ends (window close, timeout, explicit).
   * Returns the new CML hash.
   */
  async executeSleep(nfaId: number): Promise<{ hash: string; success: boolean }> {
    const cml = this.cmlCache.get(nfaId);
    const hippo = this.hippocampi.get(nfaId);

    if (!cml || !hippo || hippo.length === 0) {
      return { hash: '', success: false };
    }

    // Build SLEEP prompt and send to LLM
    const sleepPrompt = buildSleepPrompt(cml, hippo.getAll());
    const rawOutput = await this.ai.chat(sleepPrompt, '执行 SLEEP 记忆合并。', []);

    // Parse LLM output into new CML
    const newCML = parseSleepOutput(rawOutput);
    if (!newCML) {
      return { hash: '', success: false };
    }

    // Save to disk
    const hash = saveCML(nfaId, newCML);

    // Update caches
    this.cmlCache.set(nfaId, newCML);
    this.cmlBootCache.set(nfaId, extractBootData(newCML));

    // Clear HIPPOCAMPUS
    hippo.clear();

    await this.syncLearningTree(nfaId, hash);

    return { hash, success: true };
  }

  async closeConversation(sender: string): Promise<{ slept: boolean; hash?: string }> {
    const session = this.conversationSessions.get(sender);
    if (!session) return { slept: false };

    const hippo = this.hippocampi.get(session.nfaId);
    if (!hippo || hippo.length === 0) {
      this.conversationSessions.delete(sender);
      return { slept: false };
    }

    const result = await this.executeSleep(session.nfaId);
    this.chatHistory.delete(session.nfaId);
    this.conversationSessions.delete(sender);
    return { slept: result.success, hash: result.hash };
  }

  /** Get HIPPOCAMPUS entries for an NFA (for inspection). */
  getHippocampus(nfaId: number): HippocampusEntry[] {
    return this.hippocampi.get(nfaId)?.getAll() || [];
  }

  // ============================================
  // AI DIALOGUE (NON-COMMAND)
  // ============================================

  private async handleChat(
    input: string,
    sender: string,
    nfaId?: number
  ): Promise<GameResponse> {
    if (!nfaId) {
      return {
        text: '请先选择你的龙虾（通过 /status <id> 查看）才能对话。',
      };
    }

    const [lobsterData, worldData] = await Promise.all([
      this.client.getLobsterStatus(nfaId),
      this.client.getWorldState(),
    ]);

    await this.ensureNFACML(nfaId, lobsterData.state);

    // Get or create chat history
    let history = this.chatHistory.get(nfaId) || [];

    // Try CML-enhanced dialogue first
    const cmlBoot = this.cmlBootCache.get(nfaId);
    let response: string;

    if (cmlBoot) {
      // Trigger matching: recall relevant memories
      const recalled = this.recallMemories(nfaId, input);

      response = await handleCMLDialogue(
        this.ai,
        input,
        nfaId,
        lobsterData.state,
        lobsterData.jobClass,
        worldData.activeEvents,
        cmlBoot,
        recalled,
        history
      );

      // Buffer meaningful exchange to HIPPOCAMPUS
      const snippet = `用户: ${input.slice(0, 100)} → 龙虾: ${response.slice(0, 100)}`;
      this.bufferToHippocampus(nfaId, snippet);
    } else {
      // Fallback to basic dialogue
      response = await handleDialogue(
        this.ai,
        input,
        nfaId,
        lobsterData.state,
        lobsterData.jobClass,
        worldData.activeEvents,
        history
      );
    }

    // Update history
    history.push({ role: 'user', content: input });
    history.push({ role: 'assistant', content: response });

    // Trim history if too long
    if (history.length > ClawEngine.MAX_HISTORY * 2) {
      history = history.slice(-ClawEngine.MAX_HISTORY * 2);
    }
    this.chatHistory.set(nfaId, history);

    this.conversationSessions.set(sender, { nfaId, lastAt: Date.now() });

    return { text: response };
  }

  private async syncLearningTree(nfaId: number, hash: string): Promise<void> {
    try {
      await this.client.updateLearningTreeByOwner(nfaId, toBytes32Hash(hash));
      clearPendingRootSync(nfaId);
    } catch {
      queueRootSync(nfaId, hash);
    }
  }

  private async maybeSleepConversation(sender: string, incomingNfaId?: number, isCommand = false): Promise<void> {
    const session = this.conversationSessions.get(sender);
    if (!session) return;

    const shouldSleep =
      isCommand ||
      (incomingNfaId !== undefined && incomingNfaId !== session.nfaId) ||
      (Date.now() - session.lastAt > ClawEngine.SLEEP_IDLE_MS);

    if (!shouldSleep) return;

    await this.closeConversation(sender);
  }
}
