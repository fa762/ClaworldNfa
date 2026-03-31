import * as Phaser from 'phaser';
import { eventBus } from '../EventBus';

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

  constructor() {
    super({ key: 'PKScene' });
  }

  init(data: { nfaId: number; shelter: number; personality?: Personality }) {
    this.nfaId = data.nfaId || (this.registry.get('nfaId') as number) || 1;
    this.shelter = data.shelter || (this.registry.get('shelter') as number) || 0;
    if (data.personality) this.personality = data.personality;
    else {
      const cached = this.registry.get('personality') as Personality | undefined;
      if (cached) this.personality = cached;
    }
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

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offMatches();
      offResult();
      offFullStats();
    });

    this.requestMatches();
  }

  private requestMatches() {
    this.showStatus('读取链上擂台中...', '#ffaa00');
    eventBus.emit('pk:search', { nfaId: this.nfaId });
  }

  private promptCreate() {
    const stake = window.prompt('输入质押 CLW 数量', '100');
    if (!stake) return;
    this.showStrategyPicker('create', { stake });
  }

  private promptReveal() {
    const matchId = window.prompt('输入要揭示策略的 Match ID');
    if (!matchId) return;
    eventBus.emit('pk:reveal', { matchId: Number(matchId) });
  }

  private promptSettle() {
    const matchId = window.prompt('输入要结算的 Match ID');
    if (!matchId) return;
    eventBus.emit('pk:settle', { matchId: Number(matchId) });
  }

  private promptCancel() {
    const matchId = window.prompt('输入要取消的 Match ID');
    if (!matchId) return;
    eventBus.emit('pk:cancel', { matchId: Number(matchId) });
  }

  private showStrategyPicker(mode: 'create' | 'join', options: { stake?: string; matchId?: number }) {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;
    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.75).setDepth(50);
    const title = this.add.text(W / 2, H / 2 - 110, mode === 'create' ? '创建擂台：选择策略' : `加入擂台 #${options.matchId}：选择策略`, {
      fontSize: '18px', fontFamily: 'monospace', color: '#ffffff',
    }).setOrigin(0.5).setDepth(51);

    const createdObjects: Phaser.GameObjects.GameObject[] = [overlay, title];

    if (options.stake) {
      const stakeText = this.add.text(W / 2, H / 2 - 88, `质押: ${options.stake} CLW`, {
        fontSize: '14px', fontFamily: 'monospace', color: '#ffaa00',
      }).setOrigin(0.5).setDepth(51);
      createdObjects.push(stakeText);
    }

    STRATEGIES.forEach((strategy, index) => {
      const y = H / 2 - 30 + index * 58;
      const card = this.add.rectangle(W / 2, y, 280, 52, 0x111122)
        .setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(strategy.color).color)
        .setDepth(51)
        .setInteractive({ useHandCursor: true });
      const name = this.add.text(W / 2, y - 8, strategy.name, {
        fontSize: '18px', fontFamily: 'monospace', color: strategy.color,
      }).setOrigin(0.5).setDepth(52);
      const desc = this.add.text(W / 2, y + 10, strategy.desc, {
        fontSize: '12px', fontFamily: 'monospace', color: '#888888',
      }).setOrigin(0.5).setDepth(52);

      card.on('pointerdown', () => {
        createdObjects.forEach((obj) => obj.destroy());
        if (mode === 'create' && options.stake) {
          eventBus.emit('pk:create', { nfaId: this.nfaId, strategy: index, stake: options.stake });
        }
        if (mode === 'join' && options.matchId) {
          eventBus.emit('pk:join', { nfaId: this.nfaId, matchId: options.matchId, strategy: index });
        }
      });

      createdObjects.push(card, name, desc);
    });

    const cancel = this.add.text(W / 2, H / 2 + 155, '[ 取消 ]', {
      fontSize: '15px', fontFamily: 'monospace', color: '#ff4444',
    }).setOrigin(0.5).setDepth(52).setInteractive({ useHandCursor: true });

    cancel.on('pointerdown', () => createdObjects.forEach((obj) => obj.destroy()));
    createdObjects.push(cancel);
  }

  private renderMatches() {
    this.rows.forEach((row) => row.destroy());
    this.rows = [];

    const W = this.cameras.main.width;

    if (this.matches.length === 0) {
      const empty = this.add.text(W / 2, 200, '没有活跃中的链上对战', {
        fontSize: '16px', fontFamily: 'monospace', color: '#666666',
      }).setOrigin(0.5);
      this.rows.push(empty);
      return;
    }

    this.matches.slice(0, 6).forEach((match, index) => {
      const y = 140 + index * 50;
      const rowBg = this.add.rectangle(W / 2, y + 10, W - 36, 40, 0x111122, 0.5).setStrokeStyle(1, 0x222233);
      const rowText = this.add.text(18, y,
        `${String(match.matchId).padEnd(6)} ${String(match.nfaA).padEnd(8)} ${String(match.nfaB || '-').padEnd(8)} ${`${match.stake} CLW`.padEnd(12)} ${match.phaseName.padEnd(14)}`,
        { fontSize: '12px', fontFamily: 'monospace', color: '#cccccc' },
      );

      this.rows.push(rowBg, rowText);

      if (match.phase === 0) {
        const joinBtn = this.add.text(W - 70, y + 1, '[ 加入 ]', {
          fontSize: '11px', fontFamily: 'monospace', color: '#ffaa00', backgroundColor: '#1a1a00', padding: { x: 6, y: 4 },
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        joinBtn.on('pointerdown', () => this.showStrategyPicker('join', { matchId: match.matchId }));
        this.rows.push(joinBtn);
      } else if (match.phase === 2) {
        const revealBtn = this.add.text(W - 70, y + 1, '[ 揭示 ]', {
          fontSize: '11px', fontFamily: 'monospace', color: '#39ff14', backgroundColor: '#001a00', padding: { x: 6, y: 4 },
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        revealBtn.on('pointerdown', () => eventBus.emit('pk:reveal', { matchId: match.matchId }));
        this.rows.push(revealBtn);
      } else if (match.phase === 3) {
        const settleBtn = this.add.text(W - 70, y + 1, '[ 结算 ]', {
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
    this.scene.start('ShelterScene', { nfaId: this.nfaId, shelter: this.shelter, personality: this.personality });
  }
}
