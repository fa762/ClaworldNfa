import * as Phaser from 'phaser';
import { eventBus } from '../EventBus';
import { loadPKSalt } from '../chain/contracts';
import { TerminalModal } from '../ui/TerminalModal';

const STRATEGIES = [
  { name: '全攻', desc: 'ATK 150% / DEF 50%', color: '#ff4444' },
  { name: '平衡', desc: 'ATK 100% / DEF 100%', color: '#ffaa00' },
  { name: '全防', desc: 'ATK 50% / DEF 150%', color: '#4488ff' },
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

  constructor() {
    super({ key: 'PKScene' });
  }

  init(data: { nfaId: number; shelter: number; personality?: Personality; playerPosition?: PlayerPosition; entryAction?: string }) {
    this.nfaId = data.nfaId || (this.registry.get('nfaId') as number) || 1;
    this.shelter = data.shelter || (this.registry.get('shelter') as number) || 0;
    if (data.personality) this.personality = data.personality;
    else {
      const cached = this.registry.get('personality') as Personality | undefined;
      if (cached) this.personality = cached;
    }
    this.playerPosition = data.playerPosition || (this.registry.get('playerPosition') as PlayerPosition | undefined);
    this.entryAction = data.entryAction;
  }

  create() {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    this.add.rectangle(W / 2, H / 2, W, H, 0x0a0a0a, 0.95);

    this.add.text(W / 2, 26, '[ 竞技擂台 ]', {
      fontSize: '24px', fontFamily: 'monospace', color: '#ff3333',
    }).setOrigin(0.5);

    this.add.text(W / 2, 48, `NFA #${this.nfaId} — 真链上 PK`, {
      fontSize: '14px', fontFamily: 'monospace', color: '#ff6666',
    }).setOrigin(0.5).setAlpha(0.7);

    this.add.text(W / 2, 64, '创建擂台 -> 挑策略 -> 等对手 -> 揭示 -> 结算', {
      fontSize: '12px', fontFamily: 'monospace', color: '#aaaaaa',
    }).setOrigin(0.5).setAlpha(0.75);

    this.modal = new TerminalModal(this);

    const buttons = [
      { label: '[ 创建 ]', x: W * 0.18, action: () => this.promptCreate() },
      { label: '[ 刷新 ]', x: W * 0.35, action: () => this.requestMatches() },
      { label: '[ 揭示 ]', x: W * 0.52, action: () => this.promptReveal() },
      { label: '[ 结算 ]', x: W * 0.69, action: () => this.promptSettle() },
      { label: '[ 取消 ]', x: W * 0.86, action: () => this.promptCancel() },
    ];

    for (const button of buttons) {
      this.add.text(button.x, 78, button.label, {
        fontSize: '14px', fontFamily: 'monospace', color: '#39ff14',
        backgroundColor: '#001a00', padding: { x: 10, y: 6 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', button.action);
    }

    this.add.text(18, 110, 'ID     A        B        STAKE        PHASE           ACTION', {
      fontSize: '11px', fontFamily: 'monospace', color: '#555555',
    });
    this.add.rectangle(W / 2, 122, W - 32, 1, 0x333333);

    this.statusText = this.add.text(W / 2, H - 56, '读取链上擂台中...', {
      fontSize: '14px', fontFamily: 'monospace', color: '#ffaa00', align: 'center',
      wordWrap: { width: W - 40 },
    }).setOrigin(0.5);

    this.add.text(W / 2, H - 26, '[ ESC 返回避难所 ]', {
      fontSize: '14px', fontFamily: 'monospace', color: '#39ff14',
    }).setOrigin(0.5).setAlpha(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.goBack());

    this.input.keyboard!.on('keydown-ESC', () => this.goBack());

    const offMatches = eventBus.on('pk:matches', (data: unknown) => {
      this.matches = data as MatchItem[];
      this.renderMatches();
      this.showStatus(this.matches.length > 0 ? '已同步链上对战列表' : '当前没有活跃中的对战', this.matches.length > 0 ? '#39ff14' : '#666666');
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
        this.showStatus(`失败: ${result.error}`, '#ff4444');
        return;
      }

      if (result.action === 'create') {
        this.showStatus(`已创建擂台 #${result.matchId}，现在等待对手加入`, '#39ff14');
      } else if (result.action === 'join') {
        this.showStatus(`已加入擂台 #${result.matchId}，双方都 commit 后请揭示策略`, '#39ff14');
      } else if (result.action === 'reveal') {
        const readyToSettle = result.phase === 3 ? '，双方已揭示，可立即结算' : '，等待对手揭示';
        this.showStatus(`已揭示策略 #${result.matchId}${readyToSettle}`, '#39ff14');
      } else if (result.action === 'settle') {
        if (result.winnerNfaId === this.nfaId) {
          this.showStatus(`胜利! 获得 ${result.reward || '?'} CLW`, '#39ff14');
        } else if (result.loserNfaId === this.nfaId) {
          this.showStatus('败北... 本场已结算', '#ff4444');
        } else {
          this.showStatus(`对战 #${result.matchId} 已结算`, '#39ff14');
        }
      } else if (result.action === 'cancel') {
        this.showStatus(`对战 #${result.matchId} 已取消`, '#39ff14');
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
    this.showStatus('读取链上擂台中...', '#ffaa00');
    eventBus.emit('pk:search', { nfaId: this.nfaId });
  }

  private promptCreate() {
    this.modal.showForm({
      title: '创建擂台',
      subtitle: '输入本场要锁定的 CLW 质押。签名后会在链上创建对战。',
      fields: [
        { name: 'stake', label: '质押 CLW', type: 'number', value: '100', placeholder: '100' },
      ],
      submitLabel: '下一步',
      onSubmit: (values) => {
        if (!values.stake || Number(values.stake) <= 0) {
          this.showStatus('请输入有效的质押数量', '#ff4444');
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
      this.showStatus('当前没有可揭示的对战', '#666666');
      return;
    }

    this.modal.showMenu({
      title: '揭示策略',
      subtitle: '选择一场已提交 commit 的对战，公开你的策略与 salt。',
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
      this.showStatus('当前没有可结算的对战', '#666666');
      return;
    }

    this.modal.showMenu({
      title: '结算对战',
      subtitle: '双方都已揭示策略，选择一场对战执行链上结算。',
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
      this.showStatus('当前没有可取消的对战', '#666666');
      return;
    }

    this.modal.showMenu({
      title: '取消对战',
      subtitle: '只能取消 OPEN / JOINED / COMMITTED 状态的对战。',
      options: cancellable.map((match) => ({
        label: `#${match.matchId}  ${match.phaseName}`,
        description: `NFA #${match.nfaA} vs ${match.nfaB || '-'} · 质押 ${match.stake} CLW`,
        onSelect: () => eventBus.emit('pk:cancel', { matchId: match.matchId }),
      })),
    });
  }

  private showStrategyPicker(mode: 'create' | 'join', options: { stake?: string; matchId?: number }) {
    this.modal.showMenu({
      title: mode === 'create' ? '选择战斗策略' : `加入擂台 #${options.matchId}`,
      subtitle: options.stake
        ? `本场质押 ${options.stake} CLW。不同策略互相克制，揭示后才能结算。`
        : '选择你的战斗策略。',
      options: STRATEGIES.map((strategy, index) => ({
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

    if (this.matches.length === 0) {
      const empty = this.add.text(W / 2, 200, '没有活跃中的链上对战', {
        fontSize: '16px', fontFamily: 'monospace', color: '#666666',
      }).setOrigin(0.5);
      this.rows.push(empty);
      return;
    }

    this.matches.slice(0, 6).forEach((match, index) => {
      const y = isCompact ? 140 + index * 72 : 140 + index * 50;
      const rowBg = this.add.rectangle(W / 2, y + (isCompact ? 18 : 10), W - 36, isCompact ? 64 : 40, 0x111122, 0.5).setStrokeStyle(1, 0x222233);
      const rowText = this.add.text(
        18,
        y,
        isCompact
          ? `#${match.matchId}  ${match.phaseName}\nNFA ${match.nfaA} vs ${match.nfaB || '-'}\n质押 ${match.stake} CLW`
          : `${String(match.matchId).padEnd(6)} ${String(match.nfaA).padEnd(8)} ${String(match.nfaB || '-').padEnd(8)} ${`${match.stake} CLW`.padEnd(12)} ${match.phaseName.padEnd(14)}`,
        { fontSize: isCompact ? '11px' : '12px', fontFamily: 'monospace', color: '#cccccc', lineSpacing: 4 },
      );

      this.rows.push(rowBg, rowText);

      if (match.phase === 0) {
        const joinBtn = this.add.text(W - 80, y + (isCompact ? 18 : 1), '[ 加入 ]', {
          fontSize: '11px', fontFamily: 'monospace', color: '#ffaa00', backgroundColor: '#1a1a00', padding: { x: 6, y: 4 },
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        joinBtn.on('pointerdown', () => this.showStrategyPicker('join', { matchId: match.matchId }));
        this.rows.push(joinBtn);
      } else if (match.phase === 2) {
        const revealBtn = this.add.text(W - 80, y + (isCompact ? 18 : 1), '[ 揭示 ]', {
          fontSize: '11px', fontFamily: 'monospace', color: '#39ff14', backgroundColor: '#001a00', padding: { x: 6, y: 4 },
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        revealBtn.on('pointerdown', () => eventBus.emit('pk:reveal', { matchId: match.matchId }));
        this.rows.push(revealBtn);
      } else if (match.phase === 3) {
        const settleBtn = this.add.text(W - 80, y + (isCompact ? 18 : 1), '[ 结算 ]', {
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

  private goBack() {
    this.scene.start('ShelterScene', { nfaId: this.nfaId, shelter: this.shelter, personality: this.personality, playerPosition: this.playerPosition });
  }
}
