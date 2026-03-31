import * as Phaser from 'phaser';
import { eventBus } from '../EventBus';

const STRATEGIES = [
  { name: '全攻', desc: 'ATK 150% / DEF 50%', color: '#ff4444' },
  { name: '平衡', desc: 'ATK 100% / DEF 100%', color: '#ffaa00' },
  { name: '全防', desc: 'ATK 50% / DEF 150%', color: '#4488ff' },
];

/**
 * PKScene — PK 擂台界面
 * 显示策略选择 + 简单战斗动画
 */
export class PKScene extends Phaser.Scene {
  private nfaId = 0;
  private shelter = 0;

  constructor() {
    super({ key: 'PKScene' });
  }

  init(data: { nfaId: number; shelter: number }) {
    this.nfaId = data.nfaId || 1;
    this.shelter = data.shelter || 0;
  }

  create() {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    this.add.rectangle(W / 2, H / 2, W, H, 0x0a0a0a, 0.95);

    // 标题
    this.add.text(W / 2, 30, '[ 竞技擂台 ]', {
      fontSize: '16px', fontFamily: 'monospace', color: '#ff3333',
    }).setOrigin(0.5);

    // 擂台视觉
    this.add.text(W / 2, 55, 'ARENA MODE — 创建或加入对战', {
      fontSize: '10px', fontFamily: 'monospace', color: '#ff6666',
    }).setOrigin(0.5).setAlpha(0.6);

    // 两个选项：创建 / 搜索
    const btnY = 90;

    const createBtn = this.add.text(W / 2 - 80, btnY, '[ 创建擂台 ]', {
      fontSize: '12px', fontFamily: 'monospace', color: '#ff4444',
      backgroundColor: '#1a0000', padding: { x: 10, y: 6 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    const searchBtn = this.add.text(W / 2 + 80, btnY, '[ 搜索对手 ]', {
      fontSize: '12px', fontFamily: 'monospace', color: '#ffaa00',
      backgroundColor: '#1a1a00', padding: { x: 10, y: 6 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    createBtn.on('pointerdown', () => this.showStrategyPicker('create'));
    searchBtn.on('pointerdown', () => {
      eventBus.emit('pk:search', { nfaId: this.nfaId });
      searchBtn.setText('搜索中...');
    });

    // 策略选择区域（初始隐藏）
    this.createStrategyCards(W, H);

    // 返回
    const backBtn = this.add.text(W / 2, H - 30, '[ ESC 返回避难所 ]', {
      fontSize: '10px', fontFamily: 'monospace', color: '#39ff14',
    }).setOrigin(0.5).setAlpha(0.5).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => this.goBack());
    this.input.keyboard!.on('keydown-ESC', () => this.goBack());

    // 监听搜索结果
    eventBus.on('pk:matches', (data: unknown) => {
      const matches = data as Array<{ matchId: number; nfaA: number; stake: number }>;
      this.showMatches(matches, W, H);
    });
  }

  private createStrategyCards(W: number, H: number) {
    // 这些会在 showStrategyPicker 中显示
  }

  private showStrategyPicker(mode: 'create' | 'join', matchId?: number) {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;
    const startY = 140;

    this.add.text(W / 2, startY, '选择策略:', {
      fontSize: '12px', fontFamily: 'monospace', color: '#ffffff',
    }).setOrigin(0.5);

    STRATEGIES.forEach((s, i) => {
      const y = startY + 35 + i * 50;
      const btn = this.add.rectangle(W / 2, y, 200, 40, 0x111122)
        .setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(s.color).color)
        .setInteractive({ useHandCursor: true });

      this.add.text(W / 2, y - 8, s.name, {
        fontSize: '14px', fontFamily: 'monospace', color: s.color,
      }).setOrigin(0.5);

      this.add.text(W / 2, y + 10, s.desc, {
        fontSize: '9px', fontFamily: 'monospace', color: '#888888',
      }).setOrigin(0.5);

      btn.on('pointerdown', () => {
        if (mode === 'create') {
          eventBus.emit('pk:create', { nfaId: this.nfaId, strategy: i, stake: 100 });
        } else {
          eventBus.emit('pk:join', { nfaId: this.nfaId, matchId, strategy: i });
        }
        this.showWaiting();
      });
    });
  }

  private showMatches(matches: Array<{ matchId: number; nfaA: number; stake: number }>, W: number, H: number) {
    if (matches.length === 0) {
      this.add.text(W / 2, H / 2, '暂无等待中的对战', {
        fontSize: '12px', fontFamily: 'monospace', color: '#666666',
      }).setOrigin(0.5);
      return;
    }

    matches.forEach((m, i) => {
      const y = 140 + i * 40;
      const text = this.add.text(W / 2, y, `擂台 #${m.matchId}  |  NFA #${m.nfaA}  |  质押 ${m.stake} CLW  [ 加入 ]`, {
        fontSize: '10px', fontFamily: 'monospace', color: '#ffaa00',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      text.on('pointerdown', () => this.showStrategyPicker('join', m.matchId));
    });
  }

  private showWaiting() {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.8).setDepth(50);
    this.add.text(W / 2, H / 2, '上链中...', {
      fontSize: '16px', fontFamily: 'monospace', color: '#ff4444',
    }).setOrigin(0.5).setDepth(51);

    eventBus.on('pk:result', (res: unknown) => {
      const result = res as { success: boolean; won?: boolean; txHash?: string };
      if (result.success) {
        const msg = result.won ? '胜利!' : '败北...';
        const color = result.won ? '#39ff14' : '#ff4444';
        this.add.text(W / 2, H / 2 + 30, msg, {
          fontSize: '24px', fontFamily: 'monospace', color,
        }).setOrigin(0.5).setDepth(51);
      }
      this.time.delayedCall(2000, () => this.goBack());
    });
  }

  private goBack() {
    this.scene.start('ShelterScene', { nfaId: this.nfaId, shelter: this.shelter });
  }
}
