import * as Phaser from 'phaser';
import { eventBus } from '../EventBus';
import { loadPKResolutionCache, loadPKSalt } from '../chain/contracts';
import { loadMatch, loadMatchResolution, loadNFAState } from '../chain/wallet';
import { TerminalModal, type ReportSection } from '../ui/TerminalModal';
import type { GameLang } from '../data/npc-dialogues';
import { GAME_UI_FONT_FAMILY } from '../ui/fonts';
import { buildIdentityFromState, buildLobsterIdentity } from '@/lib/lobsterIdentity';
import { getShelterSceneHint, getShelterSpecialty } from '@/lib/shelter';
import { getBscScanTxUrl } from '@/contracts/addresses';

const STRATEGIES_ZH = [
  { name: '全攻', desc: '攻击 150% / 防御 50%', color: '#ff4444' },
  { name: '平衡', desc: '攻击 100% / 防御 100%', color: '#ffaa00' },
  { name: '全防', desc: '攻击 50% / 防御 150%', color: '#4488ff' },
];
const STRATEGIES_EN = [
  { name: 'Aggro', desc: 'ATK 150% / DEF 50%', color: '#ff4444' },
  { name: 'Balance', desc: 'ATK 100% / DEF 100%', color: '#ffaa00' },
  { name: 'Guard', desc: 'ATK 50% / DEF 150%', color: '#4488ff' },
];
const PK_PHASE_NAMES_ZH = ['开放中', '已加入', '已提交', '已公开', '已结算', '已取消'];
const PK_PHASE_NAMES_EN = ['OPEN', 'JOINED', 'COMMITTED', 'REVEALED', 'SETTLED', 'CANCELLED'];
const COMMIT_TIMEOUT_SECONDS = 60 * 60;
const REVEAL_TIMEOUT_SECONDS = 30 * 60;

const STRATEGY_ATK_MUL = [15000, 10000, 5000];
const STRATEGY_DEF_MUL = [5000, 10000, 15000];

interface Personality {
  courage: number;
  wisdom: number;
  social: number;
  create: number;
  grit: number;
}

interface PlayerPosition {
  x: number;
  y: number;
}

interface SwitchNfaPayload {
  nfaId: number;
  shelter: number;
  personality: Personality;
  lang?: GameLang;
}

interface MatchItem {
  matchId: number;
  nfaA: number;
  nfaB: number;
  stake: string;
  phase: number;
  phaseName: string;
  phaseTimestamp: number;
  revealedA: boolean;
  revealedB: boolean;
}

type MatchPhaseSnapshot = {
  phase: number;
  phaseTimestamp: number;
  revealedA: boolean;
  revealedB: boolean;
  nfaA: number;
  nfaB: number;
};

type LobsterStateSnapshot = Awaited<ReturnType<typeof loadNFAState>>;

type CombatBreakdown = {
  nfaA: {
    strategyName: string;
    atkMulPct: number;
    defMulPct: number;
    biasText: string;
    effStr: number;
    effDef: number;
    rawDamage: number;
    hp: number;
    damageScore: number;
    speedBoost: boolean;
  };
  nfaB: {
    strategyName: string;
    atkMulPct: number;
    defMulPct: number;
    biasText: string;
    effStr: number;
    effDef: number;
    rawDamage: number;
    hp: number;
    damageScore: number;
    speedBoost: boolean;
  };
  winner: 'A' | 'B';
};

/**
 * PKScene — 主网真实 PK 流程
 * create/join 选策略一步完成，后续由前端自动推进 reveal / settle
 */
export class PKScene extends Phaser.Scene {
  private nfaId = 0;
  private shelter = 0;
  private personality: Personality = { courage: 50, wisdom: 50, social: 50, create: 50, grit: 50 };
  private matches: MatchItem[] = [];
  private rows: Phaser.GameObjects.GameObject[] = [];
  private statusText!: Phaser.GameObjects.Text;
  private playerPosition?: PlayerPosition;
  private entryAction?: string;
  private modal!: TerminalModal;
  private lang: GameLang = 'zh';
  private showOnlyMine = false;
  private mineFilterButton?: Phaser.GameObjects.Text;
  private showJoinableOnly = false;
  private joinableFilterButton?: Phaser.GameObjects.Text;
  private prevPageButton?: Phaser.GameObjects.Text;
  private nextPageButton?: Phaser.GameObjects.Text;
  private pageInfoText?: Phaser.GameObjects.Text;
  private matchPage = 0;
  private matchTableY = 0;
  private autoProcessingMatches = new Set<number>();

  constructor() {
    super({ key: 'PKScene' });
  }

  init(data: { nfaId: number; shelter: number; personality?: Personality; playerPosition?: PlayerPosition; entryAction?: string; lang?: GameLang }) {
    this.nfaId = data.nfaId || (this.registry.get('nfaId') as number) || 1;
    this.shelter = data.shelter || (this.registry.get('shelter') as number) || 0;
    if (data.personality) this.personality = data.personality;
    else {
      const cached = this.registry.get('personality') as Personality | undefined;
      if (cached) this.personality = cached;
    }
    this.playerPosition = data.playerPosition || (this.registry.get('playerPosition') as PlayerPosition | undefined);
    this.entryAction = data.entryAction;
    this.lang = data.lang || (this.registry.get('gameLang') as GameLang) || 'zh';
  }

  create() {
    eventBus.emit('game:scene', { scene: 'pk', nfaId: this.nfaId, shelter: this.shelter });

    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    this.add.rectangle(W / 2, H / 2, W, H, 0x101010, 0.9);

    this.add.text(W / 2, 26, this.lang === 'zh' ? '[ 竞技擂台 ]' : '[ ARENA ]', {
      fontSize: '24px', fontFamily: GAME_UI_FONT_FAMILY, color: '#ff3333',
    }).setOrigin(0.5);

    this.add.text(W / 2, 48, this.lang === 'zh' ? `NFA #${this.nfaId} — 真链上 PK` : `NFA #${this.nfaId} — Onchain PK`, {
      fontSize: '14px', fontFamily: GAME_UI_FONT_FAMILY, color: '#ff6666',
    }).setOrigin(0.5).setAlpha(0.7);

    this.add.text(W / 2, 64, this.lang === 'zh' ? '创建或加入 -> 选择策略 -> 等待对手 -> 自动推进结果' : 'Create or join -> Pick strategy -> Wait -> Auto-advance result', {
      fontSize: '12px', fontFamily: GAME_UI_FONT_FAMILY, color: '#aaaaaa',
    }).setOrigin(0.5).setAlpha(0.75);

    const specialty = getShelterSpecialty(this.shelter, this.lang);
    this.add.text(W / 2, 80, this.lang === 'zh' ? `当前避难所偏向：${specialty.text}` : `Current shelter bias: ${specialty.text}`, {
      fontSize: '11px', fontFamily: GAME_UI_FONT_FAMILY, color: specialty.color,
    }).setOrigin(0.5).setAlpha(0.75);

    this.add.text(W / 2, 94, getShelterSceneHint(this.shelter, 'pk', this.lang), {
      fontSize: '10px', fontFamily: GAME_UI_FONT_FAMILY, color: '#d8aaaa',
      align: 'center', wordWrap: { width: W - 40 },
    }).setOrigin(0.5).setAlpha(0.6);

    this.modal = new TerminalModal(this);
    const compactHeader = W < 720;

    const buttons = [
      { label: this.lang === 'zh' ? '[ 创建 ]' : '[ CREATE ]', x: W * 0.24, action: () => this.promptCreate() },
      { label: this.lang === 'zh' ? '[ 刷新 ]' : '[ REFRESH ]', x: W * 0.5, action: () => this.requestMatches() },
      { label: this.lang === 'zh' ? '[ 取消 ]' : '[ CANCEL ]', x: W * 0.76, action: () => this.promptCancel() },
    ];

    buttons.forEach((button, index) => {
      const col = compactHeader ? index % 3 : index;
      const row = compactHeader ? Math.floor(index / 3) : 0;
      const x = compactHeader ? W * (0.22 + col * 0.28) : button.x;
      const y = compactHeader ? 112 + row * 34 : 110;

      this.add.text(x, y, button.label, {
        fontSize: '14px', fontFamily: GAME_UI_FONT_FAMILY, color: '#39ff14',
        backgroundColor: '#062406', padding: { x: 10, y: 6 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', button.action);
    });

    const toolsY = compactHeader ? 182 : 144;
    this.mineFilterButton = this.add.text(18, toolsY, '', {
      fontSize: '11px', fontFamily: GAME_UI_FONT_FAMILY, color: '#39ff14',
      backgroundColor: '#001a00', padding: { x: 8, y: 4 },
    }).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.toggleMineFilter());

    this.joinableFilterButton = this.add.text(126, toolsY, '', {
      fontSize: '11px', fontFamily: GAME_UI_FONT_FAMILY, color: '#ffaa00',
      backgroundColor: '#1a1a00', padding: { x: 8, y: 4 },
    }).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.toggleJoinableFilter());

    this.add.text(W - 18, toolsY, this.lang === 'zh' ? '[ 搜索对局 ]' : '[ FIND ID ]', {
      fontSize: '11px', fontFamily: GAME_UI_FONT_FAMILY, color: '#7ad7ff',
      backgroundColor: '#00131a', padding: { x: 8, y: 4 },
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.promptFindMatch());

    this.prevPageButton = this.add.text(W - 214, toolsY, this.lang === 'zh' ? '[ 上页 ]' : '[ PREV ]', {
      fontSize: '11px', fontFamily: GAME_UI_FONT_FAMILY, color: '#39ff14',
      backgroundColor: '#001a00', padding: { x: 8, y: 4 },
    }).setOrigin(0, 0).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.changePage(-1));

    this.pageInfoText = this.add.text(W - 152, toolsY + 5, '', {
      fontSize: '10px', fontFamily: GAME_UI_FONT_FAMILY, color: '#7ad7ff',
    }).setOrigin(0, 0);

    this.nextPageButton = this.add.text(W - 86, toolsY, this.lang === 'zh' ? '[ 下页 ]' : '[ NEXT ]', {
      fontSize: '11px', fontFamily: GAME_UI_FONT_FAMILY, color: '#39ff14',
      backgroundColor: '#001a00', padding: { x: 8, y: 4 },
    }).setOrigin(0, 0).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.changePage(1));

    const headerY = toolsY + 28;
    this.add.text(18, headerY, this.lang === 'zh' ? 'ID     发起方   应战方   赌注         阶段           操作' : 'ID     A        B        STAKE        PHASE           ACTION', {
      fontSize: '11px', fontFamily: GAME_UI_FONT_FAMILY, color: '#555555',
    });
    this.add.rectangle(W / 2, headerY + 12, W - 32, 1, 0x333333);
    this.matchTableY = headerY + 24;
    this.refreshMineFilterButton();
    this.refreshJoinableFilterButton();

    this.statusText = this.add.text(W / 2, H - 56, this.lang === 'zh' ? '读取链上擂台中...' : 'Loading arena matches...', {
      fontSize: '14px', fontFamily: GAME_UI_FONT_FAMILY, color: '#ffaa00', align: 'center',
      wordWrap: { width: W - 40 },
    }).setOrigin(0.5);

    const topBackBtn = this.add.text(18, 14, this.lang === 'zh' ? '[ ← 返回避难所 ]' : '[ ← BACK ]', {
      fontSize: '14px', fontFamily: GAME_UI_FONT_FAMILY, color: '#39ff14',
      backgroundColor: '#061a06', padding: { x: 8, y: 5 },
    }).setOrigin(0, 0).setDepth(1000).setScrollFactor(0).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.goBack());

    this.input.keyboard!.on('keydown-ESC', () => this.goBack());

    const offMatches = eventBus.on('pk:matches', (data: unknown) => {
      this.matches = data as MatchItem[];
      this.matchPage = 0;
      this.renderMatches();
      this.showStatus(this.matches.length > 0 ? (this.lang === 'zh' ? '已同步链上对局列表' : 'Loaded onchain matches') : (this.lang === 'zh' ? '当前还没有链上对局' : 'No on-chain matches yet'), this.matches.length > 0 ? '#39ff14' : '#666666');
      void this.maybeAutoAdvanceFromMatches();
    });

    const offResult = eventBus.on('pk:result', (data: unknown) => {
      const result = data as {
        status: 'pending' | 'confirmed' | 'failed';
        action: string;
        txHash?: string;
        error?: string;
        matchId?: number;
        phase?: number;
        winnerNfaId?: number;
        loserNfaId?: number;
        reward?: string;
      };

      if (result.status === 'pending') {
        this.showStatus(`${this.pendingActionText(result.action)} ${this.lang === 'zh' ? '提交中' : 'pending'}... ${result.txHash?.slice(0, 10)}...`, '#ffaa00');
        return;
      }

      if (result.matchId) {
        this.autoProcessingMatches.delete(result.matchId);
      }

      if (result.status === 'failed') {
        if (result.action === 'reveal' && result.matchId && result.error?.includes('Saved strategy')) {
          localStorage.removeItem(`claw-pk-${result.matchId}`);
        }
        if (this.isPkPhaseDrift(result.action, result.error)) {
          this.showStatus(
            this.lang === 'zh'
              ? `对局 #${result.matchId ?? '?'} 状态已变化，正在重新同步链上结果...`
              : `Match #${result.matchId ?? '?'} already advanced. Resyncing on-chain state...`,
            '#ffaa00',
          );
          this.requestMatches();
          return;
        }
        const message = result.error?.includes('No saved strategy')
          ? (this.lang === 'zh' ? '当前浏览器没有保存这场对局的策略记录，无法代你揭示。' : 'This browser has no saved strategy record for this match.')
          : result.error;
        this.showStatus(this.lang === 'zh' ? `失败: ${message}` : `Failed: ${message}`, '#ff4444');
        return;
      }

      if (result.action === 'create') {
        this.showStatus(this.lang === 'zh' ? `已创建擂台 #${result.matchId}，现在等待对手加入` : `Match #${result.matchId} created. Waiting for opponent.`, '#39ff14');
      } else if (result.action === 'join') {
        this.showStatus(this.lang === 'zh' ? `已加入擂台 #${result.matchId}，策略已锁定，系统将自动推进结果` : `Joined match #${result.matchId}. Strategy locked, match will auto-advance.`, '#39ff14');
      } else if (result.action === 'reveal') {
        const nextStep = result.phase === 3
          ? (this.lang === 'zh' ? '，双方已公开，正在自动结算' : ', both revealed. Auto-settling now.')
          : (this.lang === 'zh' ? '，等待对手公开策略' : ', waiting for opponent reveal.');
        this.showStatus(this.lang === 'zh' ? `已公开策略 #${result.matchId}${nextStep}` : `Revealed strategy for #${result.matchId}${nextStep}`, '#39ff14');
      } else if (result.action === 'settle') {
        if (result.winnerNfaId === this.nfaId) {
          this.showStatus(this.lang === 'zh' ? `胜利! 获得 ${result.reward || '?'} Claworld` : `Victory! Earned ${result.reward || '?'} Claworld`, '#39ff14');
        } else if (result.loserNfaId === this.nfaId) {
          this.showStatus(this.lang === 'zh' ? '败北... 本场已结算' : 'Defeat... Match settled.', '#ff4444');
        } else {
          this.showStatus(this.lang === 'zh' ? `对战 #${result.matchId} 已结算` : `Match #${result.matchId} settled`, '#39ff14');
        }
        this.showSettlementReport(result);
      } else if (result.action === 'cancel') {
        this.showStatus(this.lang === 'zh' ? `对战 #${result.matchId} 已取消` : `Match #${result.matchId} cancelled`, '#39ff14');
      }

      this.requestMatches();
    });

    const offFullStats = eventBus.on('nfa:fullStats', (data: unknown) => {
      const stats = data as Personality;
      this.personality = stats;
      this.registry.set('personality', stats);
    });

    const offSwitchNfa = eventBus.on('game:switchNfa', (data: unknown) => {
      const payload = data as SwitchNfaPayload;
      this.scene.start('ShelterScene', {
        nfaId: payload.nfaId,
        shelter: payload.shelter,
        personality: payload.personality,
        playerPosition: this.playerPosition,
        lang: payload.lang ?? this.lang,
      });
    });

    const offCommand = eventBus.on('game:command', (data: unknown) => {
      const payload = data as { name?: string; args?: string[] };
      if (!payload.name) return;
      this.handleCliCommand(payload.name, payload.args ?? []);
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offMatches();
      offResult();
      offFullStats();
      offSwitchNfa();
      offCommand();
      this.modal.destroy();
    });

    this.requestMatches();

    if (this.entryAction === 'pk:showCreate') {
      this.time.delayedCall(150, () => this.promptCreate());
    }
  }

  private requestMatches() {
      this.showStatus(this.lang === 'zh' ? '读取全部链上对局中...' : 'Loading on-chain matches...', '#ffaa00');
      eventBus.emit('pk:search', { nfaId: this.nfaId });
  }

  private phaseName(phase: number) {
    return this.lang === 'zh'
      ? (PK_PHASE_NAMES_ZH[phase] ?? `阶段 ${phase}`)
      : (PK_PHASE_NAMES_EN[phase] ?? `PHASE ${phase}`);
  }

  private pendingActionText(action: string) {
    if (this.lang !== 'zh') return action.toUpperCase();
    const labels: Record<string, string> = {
      create: '创建对局',
      join: '加入对局',
      reveal: '公开策略',
      settle: '结算对局',
      cancel: '取消对局',
    };
    return labels[action] ?? action;
  }

  private isPkPhaseDrift(action: string, error?: string) {
    if (!error) return false;
    const normalized = error.toLowerCase();
    if (action === 'reveal') {
      return normalized.includes('not in reveal phase')
        || normalized.includes('already revealed')
        || normalized.includes('phase changed')
        || normalized.includes('state changed');
    }
    if (action === 'settle') {
      return normalized.includes('cannot settle')
        || normalized.includes('not revealed')
        || normalized.includes('already settled')
        || normalized.includes('phase changed')
        || normalized.includes('state changed');
    }
    return false;
  }

  private getPhaseAgeSeconds(match: MatchPhaseSnapshot) {
    return Math.max(0, Math.floor(Date.now() / 1000) - match.phaseTimestamp);
  }

  private canCancelMatch(match: MatchPhaseSnapshot) {
    if (match.phase === 0) return this.isMyMatch(match);
    if (match.phase === 1) return this.getPhaseAgeSeconds(match) > COMMIT_TIMEOUT_SECONDS;
    if (match.phase === 2) {
      return this.getPhaseAgeSeconds(match) > REVEAL_TIMEOUT_SECONDS && !match.revealedA && !match.revealedB;
    }
    return false;
  }

  private canSettleMatch(match: MatchPhaseSnapshot) {
    if (match.phase === 3) return true;
    if (match.phase !== 2) return false;
    return this.getPhaseAgeSeconds(match) > REVEAL_TIMEOUT_SECONDS && (match.revealedA || match.revealedB);
  }

  private isMyMatch(match: { nfaA: number; nfaB: number }) {
    return match.nfaA === this.nfaId || match.nfaB === this.nfaId;
  }

  private hasMyReveal(match: { nfaA: number; nfaB: number; revealedA: boolean; revealedB: boolean }) {
    if (match.nfaA === this.nfaId) return match.revealedA;
    if (match.nfaB === this.nfaId) return match.revealedB;
    return false;
  }

  private async maybeAutoAdvanceFromMatches() {
    const settleable = this.matches.find((match) => this.isMyMatch(match) && match.phase === 3);
    if (settleable) {
      await this.maybeAutoAdvanceMatch(settleable.matchId);
      return;
    }

    const revealable = this.matches.find((match) =>
      this.isMyMatch(match) &&
      match.phase === 2 &&
      !this.hasMyReveal(match) &&
      Boolean(loadPKSalt(match.matchId))
    );

    if (revealable) {
      await this.maybeAutoAdvanceMatch(revealable.matchId);
    }
  }

  private async maybeAutoAdvanceMatch(matchId: number) {
    if (this.autoProcessingMatches.has(matchId)) return;

    const match = await loadMatch(matchId);
    if (!match || !this.isMyMatch(match)) return;

    if (match.phase === 3) {
      this.autoProcessingMatches.add(matchId);
      this.showStatus(this.lang === 'zh' ? `对局 #${matchId} 双方已公开，正在自动结算...` : `Match #${matchId} fully revealed. Auto-settling...`, '#7ad7ff');
      eventBus.emit('pk:settle', { matchId });
      return;
    }

    if (match.phase === 2 && !this.hasMyReveal(match) && loadPKSalt(matchId)) {
      this.autoProcessingMatches.add(matchId);
      this.showStatus(this.lang === 'zh' ? `对局 #${matchId} 已就绪，正在自动公开策略...` : `Match #${matchId} committed. Auto-revealing strategy...`, '#7ad7ff');
      eventBus.emit('pk:reveal', { matchId });
    }
  }

  private refreshMineFilterButton() {
    this.mineFilterButton?.setText(
      this.showOnlyMine
        ? (this.lang === 'zh' ? '[ 我的对局 ]' : '[ MY MATCHES ]')
        : (this.lang === 'zh' ? '[ 全部对局 ]' : '[ ALL MATCHES ]')
    );
  }

  private refreshJoinableFilterButton() {
    this.joinableFilterButton?.setText(
      this.showJoinableOnly
        ? (this.lang === 'zh' ? '[ 可加入中 ]' : '[ JOINABLE ]')
        : (this.lang === 'zh' ? '[ 可加入对局 ]' : '[ JOINABLE ]')
    );
  }

  private toggleMineFilter() {
    this.showOnlyMine = !this.showOnlyMine;
    if (this.showOnlyMine) this.showJoinableOnly = false;
    this.matchPage = 0;
    this.refreshMineFilterButton();
    this.refreshJoinableFilterButton();
    this.renderMatches();
    this.showStatus(
      this.showOnlyMine
        ? (this.lang === 'zh' ? `仅显示 NFA #${this.nfaId} 的对局` : `Showing matches for NFA #${this.nfaId} only`)
        : (this.lang === 'zh' ? '显示全部链上对局' : 'Showing all on-chain matches'),
      '#39ff14',
    );
  }

  private toggleJoinableFilter() {
    this.showJoinableOnly = !this.showJoinableOnly;
    if (this.showJoinableOnly) this.showOnlyMine = false;
    this.matchPage = 0;
    this.refreshMineFilterButton();
    this.refreshJoinableFilterButton();
    this.renderMatches();
    this.showStatus(
      this.showJoinableOnly
        ? (this.lang === 'zh' ? '仅显示可加入的开放对局' : 'Showing joinable open matches only')
        : (this.lang === 'zh' ? '显示全部链上对局' : 'Showing all on-chain matches'),
      '#39ff14',
    );
  }

  private getVisibleMatches() {
    const base = this.showJoinableOnly
      ? this.matches.filter((match) => match.phase === 0 && !this.isMyMatch(match))
      : this.showOnlyMine
        ? this.matches.filter((match) => this.isMyMatch(match))
        : this.matches;

    const score = (match: MatchItem) => {
      if (match.phase === 0 && !this.isMyMatch(match)) return 0;
      if (this.isMyMatch(match) && match.phase <= 3) return 1;
      if (match.phase <= 3) return 2;
      if (match.phase === 4) return 3;
      return 4;
    };

    return [...base].sort((a, b) => {
      const delta = score(a) - score(b);
      if (delta !== 0) return delta;
      return b.matchId - a.matchId;
    });
  }

  private getPageSize() {
    return this.cameras.main.width < 720 ? 5 : 6;
  }

  private clampMatchPage(totalMatches: number, pageSize: number) {
    const pageCount = Math.max(1, Math.ceil(totalMatches / pageSize));
    this.matchPage = Math.max(0, Math.min(this.matchPage, pageCount - 1));
    return pageCount;
  }

  private refreshPageControls(totalMatches = this.getVisibleMatches().length) {
    const pageSize = this.getPageSize();
    const pageCount = this.clampMatchPage(totalMatches, pageSize);
    if (this.pageInfoText) {
      this.pageInfoText.setText(this.lang === 'zh'
        ? `${this.matchPage + 1}/${pageCount} 页`
        : `PAGE ${this.matchPage + 1}/${pageCount}`);
    }
    if (this.prevPageButton) {
      const enabled = this.matchPage > 0;
      this.prevPageButton.setAlpha(enabled ? 1 : 0.35);
    }
    if (this.nextPageButton) {
      const enabled = this.matchPage < pageCount - 1;
      this.nextPageButton.setAlpha(enabled ? 1 : 0.35);
    }
  }

  private changePage(delta: number) {
    const visibleMatches = this.getVisibleMatches();
    const pageSize = this.getPageSize();
    const pageCount = this.clampMatchPage(visibleMatches.length, pageSize);
    const nextPage = Math.max(0, Math.min(this.matchPage + delta, pageCount - 1));
    if (nextPage === this.matchPage) return;
    this.matchPage = nextPage;
    this.renderMatches();
    this.showStatus(
      this.lang === 'zh'
        ? `切换到第 ${this.matchPage + 1} 页`
        : `Switched to page ${this.matchPage + 1}`,
      '#39ff14',
    );
  }

  private strategyName(strategy: number) {
    const names = this.lang === 'zh'
      ? ['全攻', '平衡', '全防']
      : ['Aggro', 'Balance', 'Guard'];
    return names[strategy] ?? String(strategy);
  }

  private formatClaw(amount: number) {
    if (!Number.isFinite(amount)) return '0';
    if (Math.abs(amount - Math.round(amount)) < 0.000001) return String(Math.round(amount));
    if (amount >= 100) return amount.toFixed(1).replace(/\.0$/, '');
    return amount.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  }

  private shortHash(hash: string) {
    if (hash.length <= 14) return hash;
    return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
  }

  private getBiasBonusText(state: LobsterStateSnapshot, strategy: number) {
    if (strategy === 0 && state.courage >= 70) {
      return this.lang === 'zh' ? '勇气匹配 +5% 攻击' : 'Courage match +5% ATK';
    }
    if (strategy === 2 && state.grit >= 70) {
      return this.lang === 'zh' ? '毅力匹配 +5% 防御' : 'Grit match +5% DEF';
    }
    if (strategy === 1 && state.wisdom >= 70) {
      return this.lang === 'zh' ? '智慧匹配 +3% 攻防' : 'Wisdom match +3% ATK/DEF';
    }
    return this.lang === 'zh' ? '无人格加成' : 'No personality bonus';
  }

  private getAdjustedMultipliers(state: LobsterStateSnapshot, strategy: number) {
    let atkMul = STRATEGY_ATK_MUL[strategy] ?? 10000;
    let defMul = STRATEGY_DEF_MUL[strategy] ?? 10000;
    if (strategy === 0 && state.courage >= 70) atkMul += 500;
    if (strategy === 2 && state.grit >= 70) defMul += 500;
    if (strategy === 1 && state.wisdom >= 70) {
      atkMul += 300;
      defMul += 300;
    }
    return { atkMul, defMul };
  }

  private buildCombatBreakdown(
    match: { nfaA: number; nfaB: number; strategyA: number; strategyB: number },
    stateA: LobsterStateSnapshot,
    stateB: LobsterStateSnapshot,
  ): CombatBreakdown {
    const aMul = this.getAdjustedMultipliers(stateA, match.strategyA);
    const bMul = this.getAdjustedMultipliers(stateB, match.strategyB);

    const effStrA = Math.floor((stateA.str * aMul.atkMul) / 10000);
    const effDefA = Math.floor((stateA.def * aMul.defMul) / 10000);
    const effStrB = Math.floor((stateB.str * bMul.atkMul) / 10000);
    const effDefB = Math.floor((stateB.def * bMul.defMul) / 10000);

    let rawDamageA = Math.max(1, effStrA - effDefB);
    let rawDamageB = Math.max(1, effStrB - effDefA);

    const speedBoostA = stateA.spd > stateB.spd;
    const speedBoostB = stateB.spd > stateA.spd;
    if (speedBoostA) rawDamageA = Math.floor((rawDamageA * 11000) / 10000);
    if (speedBoostB) rawDamageB = Math.floor((rawDamageB * 11000) / 10000);

    const hpA = stateA.vit * 10;
    const hpB = stateB.vit * 10;
    const damageScoreA = (rawDamageA * 10000) / Math.max(1, hpB);
    const damageScoreB = (rawDamageB * 10000) / Math.max(1, hpA);

    return {
      nfaA: {
        strategyName: this.strategyName(match.strategyA),
        atkMulPct: aMul.atkMul / 100,
        defMulPct: aMul.defMul / 100,
        biasText: this.getBiasBonusText(stateA, match.strategyA),
        effStr: effStrA,
        effDef: effDefA,
        rawDamage: rawDamageA,
        hp: hpA,
        damageScore: damageScoreA,
        speedBoost: speedBoostA,
      },
      nfaB: {
        strategyName: this.strategyName(match.strategyB),
        atkMulPct: bMul.atkMul / 100,
        defMulPct: bMul.defMul / 100,
        biasText: this.getBiasBonusText(stateB, match.strategyB),
        effStr: effStrB,
        effDef: effDefB,
        rawDamage: rawDamageB,
        hp: hpB,
        damageScore: damageScoreB,
        speedBoost: speedBoostB,
      },
      winner: damageScoreA >= damageScoreB ? 'A' : 'B',
    };
  }

  private getRowAction(match: MatchItem) {
    const isMine = this.isMyMatch(match);

    if (match.phase === 0 && !isMine) {
      return {
        label: this.lang === 'zh' ? '[ 加入 ]' : '[ JOIN ]',
        color: '#ffaa00',
        backgroundColor: '#1a1a00',
        onSelect: () => this.showStrategyPicker('join', { matchId: match.matchId }),
      };
    }

    if (this.canCancelMatch(match)) {
      return {
        label: this.lang === 'zh' ? '[ 取消 ]' : '[ CANCEL ]',
        color: '#ff8888',
        backgroundColor: '#240606',
        onSelect: () => eventBus.emit('pk:cancel', { matchId: match.matchId }),
      };
    }

    if (this.canSettleMatch(match)) {
      return {
        label: this.lang === 'zh' ? '[ 结算 ]' : '[ SETTLE ]',
        color: '#39ff14',
        backgroundColor: '#001a00',
        onSelect: () => eventBus.emit('pk:settle', { matchId: match.matchId }),
      };
    }

    return null;
  }

  private promptFindMatch() {
    this.modal.showForm({
      title: this.lang === 'zh' ? '搜索对局' : 'Find match',
      subtitle: this.lang === 'zh' ? '输入 match id，查看该场 PK 的实时链上状态。' : 'Enter a match id to inspect its live on-chain state.',
      fields: [
        { name: 'matchId', label: this.lang === 'zh' ? '对局 ID' : 'Match ID', type: 'number', placeholder: '1' },
      ],
      submitLabel: this.lang === 'zh' ? '查看' : 'Inspect',
      onSubmit: (values) => {
        const matchId = Number(values.matchId);
        if (!Number.isInteger(matchId) || matchId <= 0) {
          this.showStatus(this.lang === 'zh' ? '请输入有效的对局 ID' : 'Enter a valid match id', '#ff4444');
          return;
        }
        void this.openMatchTrace(matchId);
      },
    });
  }

  private async inspectMatch(matchId: number) {
    this.showStatus(this.lang === 'zh' ? `读取对局 #${matchId} 中...` : `Loading match #${matchId}...`, '#7ad7ff');

    const match = await loadMatch(matchId);
    if (!match) {
      this.showStatus(this.lang === 'zh' ? `未找到对局 #${matchId}` : `Match #${matchId} not found`, '#ff4444');
      return;
    }

    const isMine = match.nfaA === this.nfaId || match.nfaB === this.nfaId;
    const opponentId = match.nfaA === this.nfaId ? match.nfaB : match.nfaA;
    const phaseName = this.phaseName(match.phase);
    const options = [
      {
        label: `NFA #${match.nfaA} vs NFA #${match.nfaB || '-'}`,
        description: this.lang === 'zh'
          ? `阶段 ${phaseName} | 质押 ${Number(match.stake) / 1e18} Claworld`
          : `Phase ${phaseName} | Stake ${Number(match.stake) / 1e18} Claworld`,
        disabled: true,
        onSelect: () => {},
      },
      {
        label: this.lang === 'zh'
          ? `公开状态 发起方:${match.revealedA ? '是' : '否'} | 应战方:${match.revealedB ? '是' : '否'}`
          : `Reveal A ${match.revealedA ? 'YES' : 'NO'} | Reveal B ${match.revealedB ? 'YES' : 'NO'}`,
        description: isMine
          ? (this.lang === 'zh' ? '该对局包含当前 NFA。' : 'This match includes the active NFA.')
          : (this.lang === 'zh' ? '该对局不属于当前 NFA。' : 'This match does not belong to the active NFA.'),
        disabled: true,
        onSelect: () => {},
      },
    ];

    if (opponentId > 0) {
      options.push({
        label: this.lang === 'zh' ? `[ 查看 NFA #${opponentId} ]` : `[ VIEW NFA #${opponentId} ]`,
        description: this.lang === 'zh' ? '读取对手属性与人格倾向。' : 'Inspect opponent stats and personality bias.',
        disabled: false,
        onSelect: () => { void this.showOpponentStats(opponentId); },
      });
    }

    if (!isMine && match.phase === 0) {
      options.push({
        label: this.lang === 'zh' ? '[ 加入此对局 ]' : '[ JOIN MATCH ]',
        description: this.lang === 'zh' ? '选择你的策略后加入当前开放对局。' : 'Choose your strategy and join this open match.',
        disabled: false,
        onSelect: () => this.showStrategyPicker('join', { matchId: match.matchId }),
      });
    }

    if (isMine && match.phase === 2 && !this.hasMyReveal(match)) {
      const hasLocalStrategy = Boolean(loadPKSalt(match.matchId));
      options.push({
        label: hasLocalStrategy
          ? (this.lang === 'zh' ? '[ 自动公开策略 ]' : '[ AUTO REVEAL ]')
          : (this.lang === 'zh' ? '[ 缺少本地策略记录 ]' : '[ NO LOCAL STRATEGY ]'),
        description: hasLocalStrategy
          ? (this.lang === 'zh' ? '这场对局会自动公开你的策略，不需要再手动点揭示。' : 'This match will auto-reveal your strategy. No manual reveal is needed.')
          : (this.lang === 'zh' ? '当前浏览器没有保存这场对局的策略记录，无法代你公开。' : 'This browser does not have the saved strategy record for this match.'),
        disabled: true,
        onSelect: () => {},
      });
    }

    if (this.canSettleMatch(match)) {
      options.push({
        label: this.lang === 'zh' ? '[ 结算此局 ]' : '[ SETTLE ]',
        description: this.lang === 'zh' ? '按链上当前状态执行结算。' : 'Settle this match using the current on-chain state.',
        disabled: false,
        onSelect: () => eventBus.emit('pk:settle', { matchId: match.matchId }),
      });
    }

    if (this.canCancelMatch(match)) {
      options.push({
        label: this.lang === 'zh' ? '[ 取消此局 ]' : '[ CANCEL ]',
        description: this.lang === 'zh' ? '取消当前可撤销的对局。' : 'Cancel this match while it is still cancellable.',
        disabled: false,
        onSelect: () => eventBus.emit('pk:cancel', { matchId: match.matchId }),
      });
    }

    this.modal.showMenu({
      title: this.lang === 'zh' ? `对局 #${match.matchId}` : `Match #${match.matchId}`,
      subtitle: this.lang === 'zh'
        ? `当前阶段 ${phaseName}。这里可查看详情或加入对局，揭示与结算会自动推进。`
        : `Current phase ${phaseName}. Inspect or join here; reveal and settlement auto-advance.`,
      options,
      cancelLabel: this.lang === 'zh' ? '关闭' : 'Close',
    });
    this.showStatus(this.lang === 'zh' ? `已打开对局 #${match.matchId}` : `Opened match #${match.matchId}`, '#39ff14');
  }

  private async openMatchTrace(matchId: number) {
    this.showStatus(this.lang === 'zh' ? `读取对局 #${matchId} 中...` : `Loading match #${matchId}...`, '#7ad7ff');

    const match = await loadMatch(matchId);
    if (!match) {
      this.showStatus(this.lang === 'zh' ? `未找到对局 #${matchId}` : `Match #${matchId} not found`, '#ff4444');
      return;
    }

    const [resolution, stateA, stateB] = await Promise.all([
      loadMatchResolution(matchId),
      loadNFAState(match.nfaA).catch(() => null),
      match.nfaB > 0 ? loadNFAState(match.nfaB).catch(() => null) : Promise.resolve(null),
    ]);

    const isMine = this.isMyMatch(match);
    const phaseName = this.phaseName(match.phase);
    const opponentId = match.nfaA === this.nfaId ? match.nfaB : match.nfaA;
    const hasOpponent = match.nfaB > 0;
    const cachedResolution = loadPKResolutionCache(matchId);
    const stakePerSide = Number(match.stake) / 1e18;
    const currentPot = hasOpponent ? stakePerSide * 2 : stakePerSide;
    const fullPot = stakePerSide * 2;
    const computedBurned = hasOpponent ? fullPot * 0.1 : 0;
    const computedReward = hasOpponent ? fullPot - computedBurned : 0;
    const breakdown = stateA && stateB && hasOpponent ? this.buildCombatBreakdown(match, stateA, stateB) : null;
    const replayWinnerId = breakdown ? (breakdown.winner === 'A' ? match.nfaA : match.nfaB) : null;
    const replayTone: ReportSection['tone'] = replayWinnerId === null
      ? 'accent'
      : replayWinnerId === this.nfaId
        ? 'success'
        : isMine
          ? 'danger'
          : 'accent';
    const effectiveSettled = resolution?.type === 'settled'
      ? {
          winnerNfaId: resolution.winnerNfaId,
          loserNfaId: resolution.loserNfaId,
          reward: Number(resolution.reward) / 1e18,
          burned: Number(resolution.burned) / 1e18,
          blockNumber: resolution.blockNumber,
          transactionHash: resolution.transactionHash,
          source: 'event' as const,
        }
      : cachedResolution?.type === 'settled'
        ? {
            winnerNfaId: cachedResolution.winnerNfaId,
            loserNfaId: cachedResolution.loserNfaId,
            reward: Number(cachedResolution.reward),
            burned: Number(cachedResolution.burned),
            transactionHash: cachedResolution.txHash,
            source: 'cache' as const,
          }
        : match.phase === 4 && hasOpponent && match.revealedA !== match.revealedB
          ? {
              winnerNfaId: match.revealedA ? match.nfaA : match.nfaB,
              loserNfaId: match.revealedA ? match.nfaB : match.nfaA,
              reward: computedReward,
              burned: computedBurned,
              source: 'timeout' as const,
            }
          : null;
    const effectiveCancelled = resolution?.type === 'cancelled'
      ? {
          blockNumber: resolution.blockNumber,
          transactionHash: resolution.transactionHash,
          source: 'event' as const,
        }
      : cachedResolution?.type === 'cancelled'
        ? {
            transactionHash: cachedResolution.txHash,
            source: 'cache' as const,
          }
        : null;
    const sections: ReportSection[] = [
      {
        title: this.lang === 'zh' ? '本场概览' : 'Match snapshot',
        tone: 'accent',
        chips: [
          this.lang === 'zh' ? `阶段 ${phaseName}` : `Phase ${phaseName}`,
          this.lang === 'zh' ? `发起方质押 ${this.formatClaw(stakePerSide)} Claworld` : `Creator stake ${this.formatClaw(stakePerSide)} Claworld`,
          hasOpponent
            ? (this.lang === 'zh' ? `应战方质押 ${this.formatClaw(stakePerSide)} Claworld` : `Challenger stake ${this.formatClaw(stakePerSide)} Claworld`)
            : (this.lang === 'zh' ? '应战方质押 待加入' : 'Challenger stake pending'),
          this.lang === 'zh' ? `当前奖池 ${this.formatClaw(currentPot)} Claworld` : `Current pot ${this.formatClaw(currentPot)} Claworld`,
          hasOpponent
            ? (this.lang === 'zh' ? `胜者到账 ${this.formatClaw(computedReward)} Claworld` : `Winner payout ${this.formatClaw(computedReward)} Claworld`)
            : (this.lang === 'zh' ? `满池奖池 ${this.formatClaw(fullPot)} Claworld` : `Full pot ${this.formatClaw(fullPot)} Claworld`),
          hasOpponent
            ? (this.lang === 'zh' ? `系统销毁 ${this.formatClaw(computedBurned)} Claworld` : `Burn ${this.formatClaw(computedBurned)} Claworld`)
            : (this.lang === 'zh' ? '系统销毁 待结算' : 'Burn pending'),
        ],
        lines: [
          `NFA #${match.nfaA} vs NFA #${match.nfaB || '-'}`,
          hasOpponent
            ? (this.lang === 'zh'
              ? `公开状态 A ${match.revealedA ? '已公开' : '未公开'} · B ${match.revealedB ? '已公开' : '未公开'}`
              : `Reveal A ${match.revealedA ? 'YES' : 'NO'} · B ${match.revealedB ? 'YES' : 'NO'}`)
            : (this.lang === 'zh' ? '当前仍在等待应战。' : 'Waiting for a challenger.'),
        ],
      },
    ];

    if (effectiveSettled) {
      sections.push({
        title: this.lang === 'zh' ? '链上结果' : 'On-chain result',
        tone: effectiveSettled.winnerNfaId === this.nfaId ? 'success' : effectiveSettled.loserNfaId === this.nfaId ? 'danger' : 'accent',
        chips: [
          this.lang === 'zh' ? `实际胜者 NFA #${effectiveSettled.winnerNfaId}` : `Winner NFA #${effectiveSettled.winnerNfaId}`,
          this.lang === 'zh' ? `败者 NFA #${effectiveSettled.loserNfaId}` : `Loser NFA #${effectiveSettled.loserNfaId}`,
          this.lang === 'zh' ? `胜者到账 ${this.formatClaw(effectiveSettled.reward)} Claworld` : `Reward ${this.formatClaw(effectiveSettled.reward)} Claworld`,
          this.lang === 'zh' ? `系统销毁 ${this.formatClaw(effectiveSettled.burned)} Claworld` : `Burn ${this.formatClaw(effectiveSettled.burned)} Claworld`,
          ...(effectiveSettled.blockNumber ? [this.lang === 'zh' ? `区块 #${effectiveSettled.blockNumber}` : `Block #${effectiveSettled.blockNumber}`] : []),
        ],
        links: effectiveSettled.transactionHash
          ? [
              {
                label: this.lang === 'zh'
                  ? `查看交易 ${this.shortHash(effectiveSettled.transactionHash)}`
                  : `View tx ${this.shortHash(effectiveSettled.transactionHash)}`,
                href: getBscScanTxUrl(effectiveSettled.transactionHash),
              },
            ]
          : [],
        lines: effectiveSettled.source === 'cache'
          ? [
              this.lang === 'zh'
                ? '公共 RPC 暂未返回结算事件，当前先使用本地成功交易回执结果。'
                : 'Public RPC did not return the settlement event. Using the locally cached confirmed receipt.',
            ]
          : effectiveSettled.source === 'timeout'
            ? [
                this.lang === 'zh'
                  ? '公共 RPC 暂未返回结算事件，本场按超时结算规则推断：谁公开谁胜。'
                  : 'Public RPC did not return the settlement event. This result is inferred from the timeout settlement rule.',
              ]
            : undefined,
      });
    } else if (effectiveCancelled) {
      sections.push({
        title: this.lang === 'zh' ? '链上结果' : 'On-chain result',
        tone: 'danger',
        chips: [
          this.lang === 'zh' ? '状态 已取消' : 'Status Cancelled',
          this.lang === 'zh' ? '胜者 无' : 'Winner None',
          this.lang === 'zh' ? '奖励 0 Claworld' : 'Reward 0 Claworld',
          this.lang === 'zh' ? '销毁 0 Claworld' : 'Burn 0 Claworld',
          ...(effectiveCancelled.blockNumber ? [this.lang === 'zh' ? `区块 #${effectiveCancelled.blockNumber}` : `Block #${effectiveCancelled.blockNumber}`] : []),
        ],
        links: effectiveCancelled.transactionHash
          ? [
              {
                label: this.lang === 'zh'
                  ? `查看交易 ${this.shortHash(effectiveCancelled.transactionHash)}`
                  : `View tx ${this.shortHash(effectiveCancelled.transactionHash)}`,
                href: getBscScanTxUrl(effectiveCancelled.transactionHash),
              },
            ]
          : [],
        lines: effectiveCancelled.source === 'cache'
          ? [
              this.lang === 'zh'
                ? '公共 RPC 暂未返回取消事件，当前先使用本地成功交易回执结果。'
                : 'Public RPC did not return the cancellation event. Using the locally cached confirmed receipt.',
            ]
          : undefined,
      });
    } else if (!hasOpponent) {
      sections.push({
        title: this.lang === 'zh' ? '当前状态' : 'Current state',
        tone: 'accent',
        chips: [
          this.lang === 'zh' ? '状态 等待应战' : 'Status Waiting',
          this.lang === 'zh' ? `发起方已锁定 ${this.formatClaw(stakePerSide)} Claworld` : `Creator locked ${this.formatClaw(stakePerSide)} Claworld`,
          this.lang === 'zh' ? `应战加入后奖池 ${this.formatClaw(fullPot)} Claworld` : `Full pot after join ${this.formatClaw(fullPot)} Claworld`,
        ],
      });
    } else if (match.phase === 5) {
      sections.push({
        title: this.lang === 'zh' ? '链上结果' : 'On-chain result',
        tone: 'danger',
        chips: [
          this.lang === 'zh' ? '状态 已取消' : 'Status Cancelled',
          this.lang === 'zh' ? '胜者 无' : 'Winner None',
          this.lang === 'zh' ? '奖励 0 Claworld' : 'Reward 0 Claworld',
          this.lang === 'zh' ? '销毁 0 Claworld' : 'Burn 0 Claworld',
        ],
        lines: [
          this.lang === 'zh'
            ? '公共 RPC 未返回取消事件，当前按合约状态展示。'
            : 'Public RPC did not return the cancel event; showing contract state.',
        ],
      });
    } else if (breakdown && replayWinnerId !== null) {
      sections.push({
        title: match.phase === 4
          ? (this.lang === 'zh' ? '公式复盘' : 'Formula replay')
          : (this.lang === 'zh' ? '当前战况' : 'Current verdict'),
        tone: match.phase === 4 ? 'accent' : 'accent',
        chips: [
          match.phase === 4
            ? (this.lang === 'zh' ? `仅公式复盘 · 当前占优 NFA #${replayWinnerId}` : `Formula replay only · Advantage NFA #${replayWinnerId}`)
            : (this.lang === 'zh' ? `当前占优 NFA #${replayWinnerId}` : `Advantage NFA #${replayWinnerId}`),
          this.lang === 'zh' ? `胜者到账 ${this.formatClaw(computedReward)} Claworld` : `Winner payout ${this.formatClaw(computedReward)} Claworld`,
          this.lang === 'zh' ? `系统销毁 ${this.formatClaw(computedBurned)} Claworld` : `Burn ${this.formatClaw(computedBurned)} Claworld`,
        ],
        lines: match.phase === 4
          ? [
              this.lang === 'zh'
                ? '公共 RPC 未返回结算事件，以下仅按当前属性做公式复盘，不代表历史实际结算结果。'
                : 'Public RPC did not return the settlement event. This is only a replay using current stats, not the historical final result.',
            ]
          : [
              this.lang === 'zh'
                ? '未结算前，以下为实时公式推演，不是最终链上结果。'
                : 'Before settlement, this is a live formula replay, not the final on-chain result.',
            ],
      });
    }

    if (breakdown && stateA && stateB && hasOpponent) {
      const settledWinnerId = effectiveSettled?.winnerNfaId ?? null;
      const toneA: ReportSection['tone'] = match.phase === 5
        ? 'normal'
        : settledWinnerId === match.nfaA
          ? 'success'
          : settledWinnerId === match.nfaB
            ? 'danger'
            : match.phase < 4 && breakdown.winner === 'A'
              ? 'accent'
              : 'normal';
      const toneB: ReportSection['tone'] = match.phase === 5
        ? 'normal'
        : settledWinnerId === match.nfaB
          ? 'success'
          : settledWinnerId === match.nfaA
            ? 'danger'
            : match.phase < 4 && breakdown.winner === 'B'
              ? 'accent'
              : 'normal';

      sections.push({
        title: this.lang === 'zh' ? `发起方 · NFA #${match.nfaA}` : `Creator · NFA #${match.nfaA}`,
        tone: toneA,
        layout: 'half',
        chips: [
          this.lang === 'zh' ? `质押 ${this.formatClaw(stakePerSide)} Claworld` : `Stake ${this.formatClaw(stakePerSide)} Claworld`,
          this.lang === 'zh' ? `策略 ${breakdown.nfaA.strategyName}` : `Strategy ${breakdown.nfaA.strategyName}`,
          this.lang === 'zh' ? `攻倍 ${breakdown.nfaA.atkMulPct}%` : `ATK ${breakdown.nfaA.atkMulPct}%`,
          this.lang === 'zh' ? `防倍 ${breakdown.nfaA.defMulPct}%` : `DEF ${breakdown.nfaA.defMulPct}%`,
          breakdown.nfaA.speedBoost
            ? (this.lang === 'zh' ? '先手 +10%' : 'Speed +10%')
            : (this.lang === 'zh' ? '无先手加成' : 'No speed bonus'),
        ],
        lines: [
          this.lang === 'zh'
            ? `STR / DEF / SPD / VIT：${stateA.str} / ${stateA.def} / ${stateA.spd} / ${stateA.vit}`
            : `STR / DEF / SPD / VIT: ${stateA.str} / ${stateA.def} / ${stateA.spd} / ${stateA.vit}`,
          this.lang === 'zh'
            ? `有效攻 / 防：${breakdown.nfaA.effStr} / ${breakdown.nfaA.effDef}`
            : `Effective ATK / DEF: ${breakdown.nfaA.effStr} / ${breakdown.nfaA.effDef}`,
          this.lang === 'zh'
            ? `原伤 / HP：${breakdown.nfaA.rawDamage} / ${breakdown.nfaA.hp}`
            : `Raw damage / HP: ${breakdown.nfaA.rawDamage} / ${breakdown.nfaA.hp}`,
          this.lang === 'zh'
            ? `伤害分：${breakdown.nfaA.damageScore.toFixed(2)}`
            : `Damage score: ${breakdown.nfaA.damageScore.toFixed(2)}`,
          breakdown.nfaA.biasText,
        ],
      });
      sections.push({
        title: this.lang === 'zh' ? `应战方 · NFA #${match.nfaB}` : `Challenger · NFA #${match.nfaB}`,
        tone: toneB,
        layout: 'half',
        chips: [
          this.lang === 'zh' ? `质押 ${this.formatClaw(stakePerSide)} Claworld` : `Stake ${this.formatClaw(stakePerSide)} Claworld`,
          this.lang === 'zh' ? `策略 ${breakdown.nfaB.strategyName}` : `Strategy ${breakdown.nfaB.strategyName}`,
          this.lang === 'zh' ? `攻倍 ${breakdown.nfaB.atkMulPct}%` : `ATK ${breakdown.nfaB.atkMulPct}%`,
          this.lang === 'zh' ? `防倍 ${breakdown.nfaB.defMulPct}%` : `DEF ${breakdown.nfaB.defMulPct}%`,
          breakdown.nfaB.speedBoost
            ? (this.lang === 'zh' ? '先手 +10%' : 'Speed +10%')
            : (this.lang === 'zh' ? '无先手加成' : 'No speed bonus'),
        ],
        lines: [
          this.lang === 'zh'
            ? `STR / DEF / SPD / VIT：${stateB.str} / ${stateB.def} / ${stateB.spd} / ${stateB.vit}`
            : `STR / DEF / SPD / VIT: ${stateB.str} / ${stateB.def} / ${stateB.spd} / ${stateB.vit}`,
          this.lang === 'zh'
            ? `有效攻 / 防：${breakdown.nfaB.effStr} / ${breakdown.nfaB.effDef}`
            : `Effective ATK / DEF: ${breakdown.nfaB.effStr} / ${breakdown.nfaB.effDef}`,
          this.lang === 'zh'
            ? `原伤 / HP：${breakdown.nfaB.rawDamage} / ${breakdown.nfaB.hp}`
            : `Raw damage / HP: ${breakdown.nfaB.rawDamage} / ${breakdown.nfaB.hp}`,
          this.lang === 'zh'
            ? `伤害分：${breakdown.nfaB.damageScore.toFixed(2)}`
            : `Damage score: ${breakdown.nfaB.damageScore.toFixed(2)}`,
          breakdown.nfaB.biasText,
        ],
      });
    }

    sections.push({
      title: this.lang === 'zh' ? '结算公式' : 'Formula',
      tone: 'accent',
      layout: 'full',
      lines: this.lang === 'zh'
        ? [
            '有效攻 = STR × 攻击倍率',
            '有效防 = DEF × 防御倍率',
            '原伤 = max(1, 有效攻 - 对手有效防)',
            '速度更快的一方额外获得 10% 原伤',
            '伤害分 = 原伤 ÷ 对手 HP，分高者胜',
          ]
        : [
            'Effective ATK = STR × ATK multiplier',
            'Effective DEF = DEF × DEF multiplier',
            'Raw damage = max(1, effective ATK - enemy effective DEF)',
            'Faster side gets +10% raw damage',
            'Damage score = raw damage ÷ enemy HP, higher score wins',
          ],
    });

    const actions: Array<{ label: string; description?: string; disabled?: boolean; onSelect: () => void }> = [];

    if (opponentId > 0) {
      actions.push({
        label: this.lang === 'zh' ? `查看 NFA #${opponentId}` : `View NFA #${opponentId}`,
        description: this.lang === 'zh' ? '读取对手属性与人格倾向' : 'Inspect opponent stats and personality',
        onSelect: () => { void this.showOpponentStats(opponentId); },
      });
    }

    if (!isMine && match.phase === 0) {
      actions.push({
        label: this.lang === 'zh' ? '加入此对局' : 'Join match',
        description: this.lang === 'zh' ? '选择策略后加入当前开放对局' : 'Choose a strategy and join this open match',
        onSelect: () => this.showStrategyPicker('join', { matchId: match.matchId }),
      });
    }

    if (isMine && match.phase === 2 && !this.hasMyReveal(match)) {
      const hasLocalStrategy = Boolean(loadPKSalt(match.matchId));
      actions.push({
        label: hasLocalStrategy
          ? (this.lang === 'zh' ? '本端可自动公开策略' : 'Local auto reveal ready')
          : (this.lang === 'zh' ? '本端没有策略记录' : 'No local strategy record'),
        description: hasLocalStrategy
          ? (this.lang === 'zh' ? '当前浏览器保存了 salt，前端会自动公开。' : 'This browser has the salt and can auto-reveal.')
          : (this.lang === 'zh' ? '这场对局可能是在别的浏览器、设备或 skill CLI 中提交。' : 'This match was likely committed from another browser, device, or skill CLI.'),
        disabled: true,
        onSelect: () => {},
      });
    }

    if (this.canSettleMatch(match)) {
      actions.push({
        label: this.lang === 'zh' ? '结算此局' : 'Settle match',
        description: this.lang === 'zh' ? '当链上已满足条件时执行结算' : 'Settle when the on-chain conditions are met',
        onSelect: () => eventBus.emit('pk:settle', { matchId: match.matchId }),
      });
    }

    if (this.canCancelMatch(match)) {
      actions.push({
        label: this.lang === 'zh' ? '取消此局' : 'Cancel match',
        description: this.lang === 'zh' ? '仅限当前仍可撤销的对局' : 'Only for currently cancellable matches',
        onSelect: () => eventBus.emit('pk:cancel', { matchId: match.matchId }),
      });
    }

    this.modal.showReport({
      title: this.lang === 'zh' ? `PK 战报 #${match.matchId}` : `PK Report #${match.matchId}`,
      subtitle: this.lang === 'zh'
        ? `阶段 ${phaseName}。上方先看胜负与质押，再看左右对照与公式复盘。`
        : `Current phase ${phaseName}. Review result, stakes, side-by-side stats, and formula replay.`,
      sections,
      actions,
      cancelLabel: this.lang === 'zh' ? '关闭' : 'Close',
    });
    this.showStatus(this.lang === 'zh' ? `已打开对局 #${match.matchId}` : `Opened match #${match.matchId}`, '#39ff14');
  }

  private promptCreate() {
    this.modal.showForm({
      title: this.lang === 'zh' ? '创建擂台' : 'Create match',
      subtitle: this.lang === 'zh' ? '输入本场要锁定的 Claworld 质押。创建后会等待对手加入，并自动推进结果。' : 'Enter the Claworld stake for this match. After creation it waits for an opponent and auto-advances the result.',
      fields: [
        { name: 'stake', label: this.lang === 'zh' ? '质押 Claworld' : 'Stake Claworld', type: 'number', value: '100', placeholder: '100' },
      ],
      submitLabel: this.lang === 'zh' ? '下一步' : 'Next',
      onSubmit: (values) => {
        if (!values.stake || Number(values.stake) <= 0) {
          this.showStatus(this.lang === 'zh' ? '请输入有效的质押数量' : 'Enter a valid stake amount', '#ff4444');
          return;
        }
        this.showStrategyPicker('create', { stake: values.stake });
      },
    });
  }

  private promptCancel() {
    const cancellable = this.matches.filter((match) =>
      this.canCancelMatch(match)
    );

    if (cancellable.length === 0) {
      this.showStatus(this.lang === 'zh' ? '当前没有可取消的对战' : 'No cancellable matches right now', '#666666');
      return;
    }

    this.modal.showMenu({
      title: this.lang === 'zh' ? '取消对战' : 'Cancel match',
      subtitle: this.lang === 'zh' ? '仅显示当前链上条件下真正可取消的对战。' : 'Only matches that are truly cancellable on-chain are listed here.',
      options: cancellable.map((match) => ({
        label: `#${match.matchId}  ${this.phaseName(match.phase)}`,
        description: `NFA #${match.nfaA} vs ${match.nfaB || '-'} · 质押 ${match.stake} Claworld`,
        onSelect: () => eventBus.emit('pk:cancel', { matchId: match.matchId }),
      })),
    });
  }

  private showStrategyPicker(mode: 'create' | 'join', options: { stake?: string; matchId?: number }) {
    this.modal.showMenu({
      title: mode === 'create' ? (this.lang === 'zh' ? '选择战斗策略' : 'Choose battle strategy') : (this.lang === 'zh' ? `加入擂台 #${options.matchId}` : `Join match #${options.matchId}`),
      subtitle: options.stake
        ? (this.lang === 'zh' ? `本场质押 ${options.stake} Claworld。策略锁定后会由前端自动公开并结算。` : `This match stakes ${options.stake} Claworld. Once the strategy is committed, the frontend auto-reveals and settles when ready.`)
        : (this.lang === 'zh' ? '选择你的战斗策略，提交后系统会自动推进结果。' : 'Choose your battle strategy. The frontend will auto-advance the result after commit.'),
      options: (this.lang === 'zh' ? STRATEGIES_ZH : STRATEGIES_EN).map((strategy, index) => ({
        label: strategy.name,
        description: strategy.desc,
        onSelect: () => {
          if (mode === 'create' && options.stake) {
            eventBus.emit('pk:create', { nfaId: this.nfaId, strategy: index, stake: options.stake });
          }
          if (mode === 'join' && options.matchId) {
            eventBus.emit('pk:join', { nfaId: this.nfaId, matchId: options.matchId, strategy: index });
          }
        },
      })),
    });
  }

  private renderMatches() {
    this.rows.forEach((row) => row.destroy());
    this.rows = [];

    const W = this.cameras.main.width;
    const isCompact = W < 720;
    const visibleMatches = this.getVisibleMatches();
    const pageSize = this.getPageSize();
    const pageCount = this.clampMatchPage(visibleMatches.length, pageSize);
    const pageMatches = visibleMatches.slice(this.matchPage * pageSize, this.matchPage * pageSize + pageSize);
    this.refreshPageControls(visibleMatches.length);

    if (visibleMatches.length === 0) {
      const empty = this.add.text(W / 2, 200, this.lang === 'zh' ? '还没有链上对局记录' : 'No on-chain matches yet', {
        fontSize: '16px', fontFamily: GAME_UI_FONT_FAMILY, color: '#666666',
      }).setOrigin(0.5);
      this.rows.push(empty);
      return;
    }

    pageMatches.forEach((match, index) => {
      const baseY = this.matchTableY;
      const y = isCompact ? baseY + index * 72 : baseY + index * 50;
      const rowBg = this.add.rectangle(W / 2, y + (isCompact ? 18 : 10), W - 36, isCompact ? 64 : 40, 0x111122, 0.5).setStrokeStyle(1, 0x222233);
      const rowText = this.add.text(
        18,
        y,
        isCompact
          ? this.buildCompactMatchText(match)
          : `${String(match.matchId).padEnd(6)} ${String(match.nfaA).padEnd(8)} ${String(match.nfaB || '-').padEnd(8)} ${`${match.stake} Claworld`.padEnd(12)} ${this.phaseName(match.phase).padEnd(14)}`,
        { fontSize: isCompact ? '11px' : '12px', fontFamily: GAME_UI_FONT_FAMILY, color: '#cccccc', lineSpacing: 4 },
      );

      this.rows.push(rowBg, rowText);

      const isMine = this.isMyMatch(match);
      const opponentId = match.nfaA === this.nfaId ? match.nfaB : match.nfaA;
      const detailBtn = this.add.text(W - (isCompact ? 170 : 160), y + (isCompact ? 18 : 1), this.lang === 'zh' ? '[ 详情 ]' : '[ DETAIL ]', {
        fontSize: '11px', fontFamily: GAME_UI_FONT_FAMILY, color: '#7ad7ff', backgroundColor: '#00131a', padding: { x: 6, y: 4 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      detailBtn.on('pointerdown', () => { void this.openMatchTrace(match.matchId); });
      this.rows.push(detailBtn);

      if (opponentId > 0) {
        const inspectBtn = this.add.text(W - (isCompact ? 94 : 88), y + (isCompact ? 18 : 1), this.lang === 'zh' ? '[ 属性 ]' : '[ STATS ]', {
          fontSize: '11px', fontFamily: GAME_UI_FONT_FAMILY, color: '#7ad7ff', backgroundColor: '#00131a', padding: { x: 6, y: 4 },
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        inspectBtn.on('pointerdown', () => { void this.showOpponentStats(opponentId); });
        this.rows.push(inspectBtn);
      }

      const rowAction = this.getRowAction(match);
      if (rowAction) {
        const actionBtn = this.add.text(
          W - 18,
          y + (isCompact ? 18 : 1),
          rowAction.label,
          {
            fontSize: '11px',
            fontFamily: GAME_UI_FONT_FAMILY,
            color: rowAction.color,
            backgroundColor: rowAction.backgroundColor,
            padding: { x: 6, y: 4 },
          },
        ).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
        actionBtn.on('pointerdown', rowAction.onSelect);
        this.rows.push(actionBtn);
      }
    });

    if (pageCount > 1) {
      this.showStatus(
        this.lang === 'zh'
          ? `显示第 ${this.matchPage + 1}/${pageCount} 页，共 ${visibleMatches.length} 场`
          : `Showing page ${this.matchPage + 1}/${pageCount}, ${visibleMatches.length} matches`,
        '#39ff14',
      );
    }
  }

  private showStatus(text: string, color = '#39ff14') {
    this.statusText.setColor(color);
    this.statusText.setText(text);
  }

  private showSettlementReport(result: {
    matchId?: number;
    winnerNfaId?: number;
    loserNfaId?: number;
    reward?: string;
  }) {
    const title = result.winnerNfaId === this.nfaId
      ? (this.lang === 'zh' ? 'PK 结算完成: 胜利' : 'PK Settled: Victory')
      : result.loserNfaId === this.nfaId
        ? (this.lang === 'zh' ? 'PK 结算完成: 失败' : 'PK Settled: Defeat')
        : (this.lang === 'zh' ? 'PK 结算完成' : 'PK Settled');

    this.modal.showMenu({
      title,
      subtitle: this.lang === 'zh'
        ? `对局 #${result.matchId ?? '-'} 已链上结算。`
        : `Match #${result.matchId ?? '-'} has been settled on-chain.`,
      options: [
        {
          label: this.lang === 'zh'
            ? `胜者 NFA #${result.winnerNfaId ?? '-'} | 败者 NFA #${result.loserNfaId ?? '-'}`
            : `Winner NFA #${result.winnerNfaId ?? '-'} | Loser NFA #${result.loserNfaId ?? '-'}`,
          description: this.lang === 'zh'
            ? `奖励 ${result.reward ?? '?'} Claworld`
            : `Reward ${result.reward ?? '?'} Claworld`,
          disabled: true,
          onSelect: () => {},
        },
      ],
      cancelLabel: this.lang === 'zh' ? '关闭' : 'Close',
    });
  }

  private async showOpponentStats(nfaId: number) {
    try {
      this.showStatus(this.lang === 'zh' ? '读取对手属性中...' : 'Loading opponent stats...', '#7ad7ff');
      const state = await loadNFAState(nfaId);
      const identity = buildIdentityFromState(state, this.lang);
      const dominant = [
        { label: this.lang === 'zh' ? '勇气' : 'Courage', value: state.courage },
        { label: this.lang === 'zh' ? '智慧' : 'Wisdom', value: state.wisdom },
        { label: this.lang === 'zh' ? '社交' : 'Social', value: state.social },
        { label: this.lang === 'zh' ? '创造' : 'Create', value: state.create },
        { label: this.lang === 'zh' ? '毅力' : 'Grit', value: state.grit },
      ].sort((a, b) => b.value - a.value);

      this.modal.showMenu({
      title: this.lang === 'zh' ? `对手 NFA #${nfaId} · ${identity.title}` : `Opponent NFA #${nfaId} · ${identity.title}`,
      subtitle: this.lang === 'zh'
        ? `等级 ${state.level} · ${state.active ? '激活' : '休眠'} · Claworld ${state.clwBalance.toFixed(0)}`
        : `Lv.${state.level} · ${state.active ? 'Active' : 'Dormant'} · Claworld ${state.clwBalance.toFixed(0)}`,
      options: [
          { label: identity.subtitle, description: `${dominant[0].label}:${dominant[0].value} · ${dominant[1].label}:${dominant[1].value} · ${dominant[2].label}:${dominant[2].value}`, disabled: true, onSelect: () => {} },
          { label: this.lang === 'zh' ? `攻击 ${state.str}  防御 ${state.def}  速度 ${state.spd}  体力 ${state.vit}` : `STR ${state.str}  DEF ${state.def}  SPD ${state.spd}  VIT ${state.vit}`, description: this.lang === 'zh' ? '链上实时属性快照' : 'Live onchain stat snapshot', disabled: true, onSelect: () => {} },
        ],
        cancelLabel: this.lang === 'zh' ? '关闭' : 'Close',
      });
      this.showStatus(this.lang === 'zh' ? '已打开对手属性面板' : 'Opened opponent stats panel', '#39ff14');
    } catch (error) {
      this.showStatus(this.lang === 'zh' ? '读取对手属性失败' : 'Failed to load opponent stats', '#ff4444');
      console.error('Failed to load opponent stats:', error);
    }
  }

  private goBack() {
    this.scene.start('ShelterScene', { nfaId: this.nfaId, shelter: this.shelter, personality: this.personality, playerPosition: this.playerPosition, lang: this.lang });
  }

  private handleCliCommand(name: string, args: string[]) {
    const sceneData = {
      nfaId: this.nfaId,
      shelter: this.shelter,
      personality: this.personality,
      playerPosition: this.playerPosition,
      lang: this.lang,
    };

    switch (name) {
      case 'task':
        this.scene.start('TaskScene', sceneData);
        break;
      case 'pk':
        this.scene.restart(sceneData);
        break;
      case 'matches':
        this.showOnlyMine = false;
        this.showJoinableOnly = false;
        this.matchPage = 0;
        this.refreshMineFilterButton();
        this.refreshJoinableFilterButton();
        this.requestMatches();
        break;
      case 'my-matches':
        this.showOnlyMine = true;
        this.showJoinableOnly = false;
        this.matchPage = 0;
        this.refreshMineFilterButton();
        this.refreshJoinableFilterButton();
        this.requestMatches();
        break;
      case 'match': {
        const matchId = Number(args[0]);
        if (Number.isInteger(matchId) && matchId > 0) {
          void this.openMatchTrace(matchId);
        }
        break;
      }
      case 'market':
        this.scene.start('MarketScene', sceneData);
        break;
      case 'shelter':
        this.scene.start('ShelterScene', sceneData);
        break;
      case 'portal': {
        const targetShelter = Number(args[0]);
        if (Number.isInteger(targetShelter) && targetShelter >= 0 && targetShelter <= 7) {
          this.scene.start('ShelterScene', { ...sceneData, shelter: targetShelter });
        }
        break;
      }
      case 'openclaw':
        eventBus.emit('game:openclaw');
        break;
      default:
        break;
    }
  }

  private buildCompactMatchText(match: MatchItem) {
    const opponentId = match.nfaA === this.nfaId ? match.nfaB : match.nfaA;
    const identity = opponentId > 0
      ? buildLobsterIdentity({
          rarity: opponentId % 5,
          shelter: (this.shelter + 1) % 8,
          level: 8 + (opponentId % 21),
          courage: 30 + ((opponentId * 7) % 60),
          wisdom: 30 + ((opponentId * 11) % 60),
          social: 30 + ((opponentId * 13) % 60),
          create: 30 + ((opponentId * 17) % 60),
          grit: 30 + ((opponentId * 19) % 60),
        }, this.lang)
      : null;

    return this.lang === 'zh'
      ? `#${match.matchId}  ${this.phaseName(match.phase)}\n对手 NFA ${opponentId || '-'}  ·  ${identity?.title || '未知'}\n质押 ${match.stake} Claworld`
      : `#${match.matchId}  ${match.phaseName}\nOpponent NFA ${opponentId || '-'}  ·  ${identity?.title || 'Unknown'}\nStake ${match.stake} Claworld`;
  }
}
