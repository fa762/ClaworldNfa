import * as Phaser from 'phaser';
import { eventBus } from '../EventBus';
import { loadPKSalt } from '../chain/contracts';
import { loadNFAState } from '../chain/wallet';
import { TerminalModal } from '../ui/TerminalModal';
import type { GameLang } from '../data/npc-dialogues';
import { buildIdentityFromState, buildLobsterIdentity } from '@/lib/lobsterIdentity';

const STRATEGIES_ZH = [
  { name: '全攻', desc: 'ATK 150% / DEF 50%', color: '#ff4444' },
  { name: '平衡', desc: 'ATK 100% / DEF 100%', color: '#ffaa00' },
  { name: '全防', desc: 'ATK 50% / DEF 150%', color: '#4488ff' },
];
const STRATEGIES_EN = [
  { name: 'Aggro', desc: 'ATK 150% / DEF 50%', color: '#ff4444' },
  { name: 'Balance', desc: 'ATK 100% / DEF 100%', color: '#ffaa00' },
  { name: 'Guard', desc: 'ATK 50% / DEF 150%', color: '#4488ff' },
];

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
  revealedA: boolean;
  revealedB: boolean;
}

/**
 * PKScene — 主网真实 PK 流程
 * create/join → reveal → settle 全部走链上
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
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    this.add.rectangle(W / 2, H / 2, W, H, 0x0a0a0a, 0.95);

    this.add.text(W / 2, 26, this.lang === 'zh' ? '[ 竞技擂台 ]' : '[ ARENA ]', {
      fontSize: '24px', fontFamily: 'monospace', color: '#ff3333',
    }).setOrigin(0.5);

    this.add.text(W / 2, 48, this.lang === 'zh' ? `NFA #${this.nfaId} — 真链上 PK` : `NFA #${this.nfaId} — Onchain PK`, {
      fontSize: '14px', fontFamily: 'monospace', color: '#ff6666',
    }).setOrigin(0.5).setAlpha(0.7);

    this.add.text(W / 2, 64, this.lang === 'zh' ? '创建擂台 -> 挑策略 -> 等对手 -> 揭示 -> 结算' : 'Create -> Pick strategy -> Wait -> Reveal -> Settle', {
      fontSize: '12px', fontFamily: 'monospace', color: '#aaaaaa',
    }).setOrigin(0.5).setAlpha(0.75);

    this.modal = new TerminalModal(this);
    const compactHeader = W < 720;

    const buttons = [
      { label: this.lang === 'zh' ? '[ 创建 ]' : '[ CREATE ]', x: W * 0.18, action: () => this.promptCreate() },
      { label: this.lang === 'zh' ? '[ 刷新 ]' : '[ REFRESH ]', x: W * 0.35, action: () => this.requestMatches() },
      { label: this.lang === 'zh' ? '[ 揭示 ]' : '[ REVEAL ]', x: W * 0.52, action: () => this.promptReveal() },
      { label: this.lang === 'zh' ? '[ 结算 ]' : '[ SETTLE ]', x: W * 0.69, action: () => this.promptSettle() },
      { label: this.lang === 'zh' ? '[ 取消 ]' : '[ CANCEL ]', x: W * 0.86, action: () => this.promptCancel() },
    ];

    buttons.forEach((button, index) => {
      const col = compactHeader ? index % 3 : index;
      const row = compactHeader ? Math.floor(index / 3) : 0;
      const x = compactHeader ? W * (0.22 + col * 0.28) : button.x;
      const y = compactHeader ? 80 + row * 34 : 78;

      this.add.text(x, y, button.label, {
        fontSize: '14px', fontFamily: 'monospace', color: '#39ff14',
        backgroundColor: '#001a00', padding: { x: 10, y: 6 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', button.action);
    });

    this.add.text(18, compactHeader ? 144 : 110, 'ID     A        B        STAKE        PHASE           ACTION', {
      fontSize: '11px', fontFamily: 'monospace', color: '#555555',
    });
    this.add.rectangle(W / 2, compactHeader ? 156 : 122, W - 32, 1, 0x333333);

    this.statusText = this.add.text(W / 2, H - 56, this.lang === 'zh' ? '读取链上擂台中...' : 'Loading arena matches...', {
      fontSize: '14px', fontFamily: 'monospace', color: '#ffaa00', align: 'center',
      wordWrap: { width: W - 40 },
    }).setOrigin(0.5);

    this.add.text(W / 2, H - 26, this.lang === 'zh' ? '[ ESC 返回避难所 ]' : '[ ESC BACK TO SHELTER ]', {
      fontSize: '14px', fontFamily: 'monospace', color: '#39ff14',
    }).setOrigin(0.5).setAlpha(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.goBack());

    this.input.keyboard!.on('keydown-ESC', () => this.goBack());

    const offMatches = eventBus.on('pk:matches', (data: unknown) => {
      this.matches = data as MatchItem[];
      this.renderMatches();
      this.showStatus(this.matches.length > 0 ? (this.lang === 'zh' ? '已同步链上对战列表' : 'Loaded onchain matches') : (this.lang === 'zh' ? '当前没有活跃中的对战' : 'No active matches'), this.matches.length > 0 ? '#39ff14' : '#666666');
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
        this.showStatus(`${result.action.toUpperCase()} 提交中... ${result.txHash?.slice(0, 10)}...`, '#ffaa00');
        return;
      }

      if (result.status === 'failed') {
        this.showStatus(this.lang === 'zh' ? `失败: ${result.error}` : `Failed: ${result.error}`, '#ff4444');
        return;
      }

      if (result.action === 'create') {
        this.showStatus(this.lang === 'zh' ? `已创建擂台 #${result.matchId}，现在等待对手加入` : `Match #${result.matchId} created. Waiting for opponent.`, '#39ff14');
      } else if (result.action === 'join') {
        this.showStatus(this.lang === 'zh' ? `已加入擂台 #${result.matchId}，双方都 commit 后请揭示策略` : `Joined match #${result.matchId}. Reveal after both commits.`, '#39ff14');
      } else if (result.action === 'reveal') {
        const readyToSettle = result.phase === 3
          ? (this.lang === 'zh' ? '，双方已揭示，可立即结算' : ', both revealed. Ready to settle.')
          : (this.lang === 'zh' ? '，等待对手揭示' : ', waiting for opponent reveal.');
        this.showStatus(this.lang === 'zh' ? `已揭示策略 #${result.matchId}${readyToSettle}` : `Revealed strategy for #${result.matchId}${readyToSettle}`, '#39ff14');
      } else if (result.action === 'settle') {
        if (result.winnerNfaId === this.nfaId) {
          this.showStatus(this.lang === 'zh' ? `胜利! 获得 ${result.reward || '?'} CLW` : `Victory! Earned ${result.reward || '?'} CLW`, '#39ff14');
        } else if (result.loserNfaId === this.nfaId) {
          this.showStatus(this.lang === 'zh' ? '败北... 本场已结算' : 'Defeat... Match settled.', '#ff4444');
        } else {
          this.showStatus(this.lang === 'zh' ? `对战 #${result.matchId} 已结算` : `Match #${result.matchId} settled`, '#39ff14');
        }
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

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offMatches();
      offResult();
      offFullStats();
      offSwitchNfa();
      this.modal.destroy();
    });

    this.requestMatches();

    if (this.entryAction === 'pk:showCreate') {
      this.time.delayedCall(150, () => this.promptCreate());
    }
  }

  private requestMatches() {
      this.showStatus(this.lang === 'zh' ? '读取链上擂台中...' : 'Loading arena matches...', '#ffaa00');
      eventBus.emit('pk:search', { nfaId: this.nfaId });
  }

  private promptCreate() {
    this.modal.showForm({
      title: this.lang === 'zh' ? '创建擂台' : 'Create match',
      subtitle: this.lang === 'zh' ? '输入本场要锁定的 CLW 质押。签名后会在链上创建对战。' : 'Enter the CLW stake for this match. Signing will create it onchain.',
      fields: [
        { name: 'stake', label: this.lang === 'zh' ? '质押 CLW' : 'Stake CLW', type: 'number', value: '100', placeholder: '100' },
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

  private promptReveal() {
    const revealable = this.matches.filter((match) =>
      match.phase === 2 && (match.nfaA === this.nfaId || match.nfaB === this.nfaId) && Boolean(loadPKSalt(match.matchId))
    );

    if (revealable.length === 0) {
      this.showStatus(this.lang === 'zh' ? '当前没有可揭示的对战' : 'No revealable matches right now', '#666666');
      return;
    }

    this.modal.showMenu({
      title: this.lang === 'zh' ? '揭示策略' : 'Reveal strategy',
      subtitle: this.lang === 'zh' ? '选择一场已提交 commit 的对战，公开你的策略与 salt。' : 'Choose a committed match to reveal your strategy and salt.',
      options: revealable.map((match) => ({
        label: `#${match.matchId}  对手 NFA #${match.nfaA === this.nfaId ? match.nfaB : match.nfaA}`,
        description: `质押 ${match.stake} CLW · ${match.phaseName}`,
        onSelect: () => eventBus.emit('pk:reveal', { matchId: match.matchId }),
      })),
    });
  }

  private promptSettle() {
    const settleable = this.matches.filter((match) => match.phase === 3);

    if (settleable.length === 0) {
      this.showStatus(this.lang === 'zh' ? '当前没有可结算的对战' : 'No settleable matches right now', '#666666');
      return;
    }

    this.modal.showMenu({
      title: this.lang === 'zh' ? '结算对战' : 'Settle match',
      subtitle: this.lang === 'zh' ? '双方都已揭示策略，选择一场对战执行链上结算。' : 'Both sides revealed. Choose a match to settle onchain.',
      options: settleable.map((match) => ({
        label: `#${match.matchId}  NFA #${match.nfaA} vs NFA #${match.nfaB}`,
        description: `总质押 ${Number(match.stake) * 2} CLW`,
        onSelect: () => eventBus.emit('pk:settle', { matchId: match.matchId }),
      })),
    });
  }

  private promptCancel() {
    const cancellable = this.matches.filter((match) =>
      match.phase <= 2 && (match.nfaA === this.nfaId || match.nfaB === this.nfaId)
    );

    if (cancellable.length === 0) {
      this.showStatus(this.lang === 'zh' ? '当前没有可取消的对战' : 'No cancellable matches right now', '#666666');
      return;
    }

    this.modal.showMenu({
      title: this.lang === 'zh' ? '取消对战' : 'Cancel match',
      subtitle: this.lang === 'zh' ? '只能取消 OPEN / JOINED / COMMITTED 状态的对战。' : 'Only OPEN / JOINED / COMMITTED matches can be cancelled.',
      options: cancellable.map((match) => ({
        label: `#${match.matchId}  ${match.phaseName}`,
        description: `NFA #${match.nfaA} vs ${match.nfaB || '-'} · 质押 ${match.stake} CLW`,
        onSelect: () => eventBus.emit('pk:cancel', { matchId: match.matchId }),
      })),
    });
  }

  private showStrategyPicker(mode: 'create' | 'join', options: { stake?: string; matchId?: number }) {
    this.modal.showMenu({
      title: mode === 'create' ? (this.lang === 'zh' ? '选择战斗策略' : 'Choose battle strategy') : (this.lang === 'zh' ? `加入擂台 #${options.matchId}` : `Join match #${options.matchId}`),
      subtitle: options.stake
        ? (this.lang === 'zh' ? `本场质押 ${options.stake} CLW。不同策略互相克制，揭示后才能结算。` : `This match stakes ${options.stake} CLW. Strategies counter each other and must be revealed before settlement.`)
        : (this.lang === 'zh' ? '选择你的战斗策略。' : 'Choose your battle strategy.'),
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
    const compactHeader = W < 720;

    if (this.matches.length === 0) {
      const empty = this.add.text(W / 2, 200, this.lang === 'zh' ? '没有活跃中的链上对战' : 'No active onchain matches', {
        fontSize: '16px', fontFamily: 'monospace', color: '#666666',
      }).setOrigin(0.5);
      this.rows.push(empty);
      return;
    }

    this.matches.slice(0, 6).forEach((match, index) => {
      const baseY = compactHeader ? 174 : 140;
      const y = isCompact ? baseY + index * 72 : baseY + index * 50;
      const rowBg = this.add.rectangle(W / 2, y + (isCompact ? 18 : 10), W - 36, isCompact ? 64 : 40, 0x111122, 0.5).setStrokeStyle(1, 0x222233);
      const rowText = this.add.text(
        18,
        y,
        isCompact
          ? this.buildCompactMatchText(match)
          : `${String(match.matchId).padEnd(6)} ${String(match.nfaA).padEnd(8)} ${String(match.nfaB || '-').padEnd(8)} ${`${match.stake} CLW`.padEnd(12)} ${match.phaseName.padEnd(14)}`,
        { fontSize: isCompact ? '11px' : '12px', fontFamily: 'monospace', color: '#cccccc', lineSpacing: 4 },
      );

      this.rows.push(rowBg, rowText);

      const opponentId = match.nfaA === this.nfaId ? match.nfaB : match.nfaA;
      if (opponentId > 0) {
        const inspectBtn = this.add.text(W - (isCompact ? 164 : 152), y + (isCompact ? 18 : 1), this.lang === 'zh' ? '[ 属性 ]' : '[ STATS ]', {
          fontSize: '11px', fontFamily: 'monospace', color: '#7ad7ff', backgroundColor: '#00131a', padding: { x: 6, y: 4 },
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        inspectBtn.on('pointerdown', () => { void this.showOpponentStats(opponentId); });
        this.rows.push(inspectBtn);
      }

      if (match.phase === 0) {
        const joinBtn = this.add.text(W - 80, y + (isCompact ? 18 : 1), this.lang === 'zh' ? '[ 加入 ]' : '[ JOIN ]', {
          fontSize: '11px', fontFamily: 'monospace', color: '#ffaa00', backgroundColor: '#1a1a00', padding: { x: 6, y: 4 },
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        joinBtn.on('pointerdown', () => this.showStrategyPicker('join', { matchId: match.matchId }));
        this.rows.push(joinBtn);
      } else if (match.phase === 2) {
        const revealBtn = this.add.text(W - 80, y + (isCompact ? 18 : 1), this.lang === 'zh' ? '[ 揭示 ]' : '[ REVEAL ]', {
          fontSize: '11px', fontFamily: 'monospace', color: '#39ff14', backgroundColor: '#001a00', padding: { x: 6, y: 4 },
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        revealBtn.on('pointerdown', () => eventBus.emit('pk:reveal', { matchId: match.matchId }));
        this.rows.push(revealBtn);
      } else if (match.phase === 3) {
        const settleBtn = this.add.text(W - 80, y + (isCompact ? 18 : 1), this.lang === 'zh' ? '[ 结算 ]' : '[ SETTLE ]', {
          fontSize: '11px', fontFamily: 'monospace', color: '#39ff14', backgroundColor: '#001a00', padding: { x: 6, y: 4 },
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        settleBtn.on('pointerdown', () => eventBus.emit('pk:settle', { matchId: match.matchId }));
        this.rows.push(settleBtn);
      }
    });
  }

  private showStatus(text: string, color = '#39ff14') {
    this.statusText.setColor(color);
    this.statusText.setText(text);
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
          ? `Lv.${state.level} · ${state.active ? '激活' : '休眠'} · CLW ${state.clwBalance.toFixed(0)}`
          : `Lv.${state.level} · ${state.active ? 'Active' : 'Dormant'} · CLW ${state.clwBalance.toFixed(0)}`,
        options: [
          { label: identity.subtitle, description: `${dominant[0].label}: ${dominant[0].value} · ${dominant[1].label}: ${dominant[1].value} · ${dominant[2].label}: ${dominant[2].value}`, disabled: true, onSelect: () => {} },
          { label: `STR ${state.str}  DEF ${state.def}  SPD ${state.spd}  VIT ${state.vit}`, description: this.lang === 'zh' ? '链上实时属性快照' : 'Live onchain stat snapshot', disabled: true, onSelect: () => {} },
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
      ? `#${match.matchId}  ${match.phaseName}\n对手 NFA ${opponentId || '-'}  ·  ${identity?.title || '未知'}\n质押 ${match.stake} CLW`
      : `#${match.matchId}  ${match.phaseName}\nOpponent NFA ${opponentId || '-'}  ·  ${identity?.title || 'Unknown'}\nStake ${match.stake} CLW`;
  }
}
