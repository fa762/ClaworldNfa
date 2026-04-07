import * as Phaser from 'phaser';
import { eventBus } from '../EventBus';
import { GAME_UI_FONT_FAMILY } from './fonts';

/**
 * StatusHUD — 顶部常驻状态栏
 * 显示：NFA 状态 / 性格 / 钱包 Gas 信息
 */
export class StatusHUD {
  private static readonly DEPTH = 2200;
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Rectangle;
  private mainText: Phaser.GameObjects.Text;
  private personalityText: Phaser.GameObjects.Text;
  private nfaId = 0;
  private hasData = false;
  private stats = { level: 0, clw: '0', gasBnb: '0', walletAddress: null as string | null, courage: 0, wisdom: 0, social: 0, create: 0, grit: 0, hp: 0, active: false, dailyCost: 0, shelter: 0 };
  private readonly offFullStats: () => void;
  private readonly compact: boolean;
  private readonly portrait: boolean;
  private readonly hudHeight: number;
  private readonly textResolution: number;

  constructor(scene: Phaser.Scene, nfaId: number) {
    this.scene = scene;
    this.nfaId = nfaId;

    const W = scene.cameras.main.width;
    const H = scene.cameras.main.height;
    this.compact = W < 820 || H < 700;
    this.portrait = H > W;
    this.hudHeight = this.portrait ? 104 : this.compact ? 78 : 64;
    this.textResolution = this.compact || this.portrait ? 2 : 1;

    this.container = scene.add.container(0, 0).setDepth(StatusHUD.DEPTH).setScrollFactor(0);

    // 背景条
    this.bg = scene.add.rectangle(W / 2, this.hudHeight / 2, W, this.hudHeight, 0x0a0a0a, 0.88)
      .setScrollFactor(0)
      .setDepth(StatusHUD.DEPTH);

    // 主信息
    this.mainText = scene.add.text(10, this.compact ? 8 : 8, '', {
      fontSize: this.portrait ? '13px' : this.compact ? '11px' : '16px', fontFamily: GAME_UI_FONT_FAMILY, color: '#39ff14',
      wordWrap: { width: W - 20 },
      lineSpacing: this.portrait ? 6 : this.compact ? 4 : 0,
    }).setScrollFactor(0).setDepth(StatusHUD.DEPTH + 1).setResolution(this.textResolution);

    // 性格摘要（右侧）
    this.personalityText = scene.add.text(W - 10, this.portrait ? 66 : this.compact ? 48 : 8, '', {
      fontSize: this.portrait ? '12px' : this.compact ? '10px' : '16px', fontFamily: GAME_UI_FONT_FAMILY, color: '#888888',
      align: this.portrait ? 'left' : 'right',
      wordWrap: this.portrait ? { width: W - 20, useAdvancedWrap: true } : undefined,
      lineSpacing: this.portrait ? 4 : 0,
    }).setOrigin(this.portrait ? 0 : 1, 0).setScrollFactor(0).setDepth(StatusHUD.DEPTH + 1).setResolution(this.textResolution);

    this.container.add([this.bg, this.mainText, this.personalityText]);

    // 监听数据更新
    this.offFullStats = eventBus.on('nfa:fullStats', (data: unknown) => {
      this.stats = data as typeof this.stats;
      this.hasData = true;
      this.refresh();
    });

    this.refresh();
  }

  refresh() {
    const s = this.stats;
    const W = this.scene.cameras.main.width;
    const walletLabel = s.walletAddress ? `${s.walletAddress.slice(0, 6)}...${s.walletAddress.slice(-4)}` : '--';
    this.mainText.setText(
      this.portrait
        ? [
            `NFA #${this.nfaId}  Lv.${s.level}  ${s.active ? '活跃' : '休眠'}`,
            `[NFA状态] Claworld:${s.clw}  生命:${s.hp}  维护:${s.dailyCost.toFixed(1)}`,
            `[钱包] Gas BNB:${s.gasBnb}  地址:${walletLabel}`,
          ].join('\n')
        : this.compact
          ? [
              `NFA #${this.nfaId}  Lv.${s.level}  ${s.active ? '活跃' : '休眠'}`,
              `[NFA] Claworld:${s.clw}  HP:${s.hp}  维护:${s.dailyCost.toFixed(1)}`,
              `[钱包] Gas BNB:${s.gasBnb}  地址:${walletLabel}`,
            ].join('\n')
          : `NFA #${this.nfaId}  等级.${s.level}  ${s.active ? '活跃' : '休眠'}   [NFA状态] Claworld:${s.clw}  生命:${s.hp}  维护:${s.dailyCost.toFixed(1)}   [钱包] Gas BNB:${s.gasBnb}  地址:${walletLabel}`
    );

    this.bg.setPosition(W / 2, this.hudHeight / 2);
    this.bg.setSize(W, this.hudHeight);
    this.mainText.setWordWrapWidth(W - 20);
    this.personalityText.setPosition(this.portrait ? 10 : W - 10, this.portrait ? 64 : this.compact ? 48 : 8);

    if (!this.hasData) {
      this.personalityText.setText('加载中...');
      return;
    }

    // 找前3高性格维度
    const dims = [
      { name: '勇气', val: s.courage },
      { name: '智慧', val: s.wisdom },
      { name: '社交', val: s.social },
      { name: '创造', val: s.create },
      { name: '毅力', val: s.grit },
    ];
    const sorted = [...dims].sort((a, b) => b.val - a.val);
    this.personalityText.setText(
      this.portrait
        ? `主性格  ${sorted[0].name}:${sorted[0].val}  ·  ${sorted[1].name}:${sorted[1].val}\n辅助  ${sorted[2].name}:${sorted[2].val}`
        : this.compact
          ? `${sorted[0].name}:${sorted[0].val}  ${sorted[1].name}:${sorted[1].val}`
          : `${sorted[0].name}:${sorted[0].val}  ${sorted[1].name}:${sorted[1].val}  ${sorted[2].name}:${sorted[2].val}`
    );
  }

  destroy() {
    this.offFullStats();
    this.container.destroy(true);
  }
}
