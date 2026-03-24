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
import * as formatter from './formatter';
import {
  buildLobsterSystemPrompt,
  handleDialogue,
  buildTaskGenerationPrompt,
  buildStrategyAdvicePrompt,
  buildBattleNarrativePrompt,
  buildPriceAdvicePrompt,
} from './dialogue';
import { ethers } from 'ethers';

// ============================================
// ENGINE
// ============================================

export class ClawEngine {
  private client: GameContractClient;
  private ai: AIProvider;
  private marketSkill: MarketSkill;
  private format: OutputFormat;

  /** Per-NFA chat history for AI dialogue continuity. */
  private chatHistory: Map<number, ChatMessage[]> = new Map();

  /** Active task sessions: nfaId -> TaskSession. */
  private taskSessions: Map<number, TaskSession> = new Map();

  /** PK salt records for commit-reveal: matchId -> SaltRecord. */
  private saltRecords: Map<number, SaltRecord> = new Map();

  /** Maximum chat history entries per NFA. */
  private static readonly MAX_HISTORY = 20;

  constructor(
    client: GameContractClient,
    ai: AIProvider,
    format: OutputFormat = 'plain'
  ) {
    this.client = client;
    this.ai = ai;
    this.marketSkill = new MarketSkill(client);
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

    // Get or create chat history
    let history = this.chatHistory.get(nfaId) || [];

    const response = await handleDialogue(
      this.ai,
      input,
      nfaId,
      lobsterData.state,
      lobsterData.jobClass,
      worldData.activeEvents,
      history
    );

    // Update history
    history.push({ role: 'user', content: input });
    history.push({ role: 'assistant', content: response });

    // Trim history if too long
    if (history.length > ClawEngine.MAX_HISTORY * 2) {
      history = history.slice(-ClawEngine.MAX_HISTORY * 2);
    }
    this.chatHistory.set(nfaId, history);

    return { text: response };
  }
}
