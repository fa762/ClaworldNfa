import * as Phaser from 'phaser';
import { eventBus } from '../EventBus';

/**
 * StatusHUD — 顶部常驻状态栏
 * 显示：NFA ID / 等级 / CLW / BNB / 性格雷达
 */
export class StatusHUD {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Rectangle;
  private mainText: Phaser.GameObjects.Text;
  private personalityText: Phaser.GameObjects.Text;
  private nfaId = 0;
  private stats = { level: 0, clw: '0', bnb: '0', courage: 0, wisdom: 0, social: 0, create: 0, grit: 0, hp: 0 };
  private readonly offFullStats: () => void;

  constructor(scene: Phaser.Scene, nfaId: number) {
    this.scene = scene;
    this.nfaId = nfaId;

    const W = scene.cameras.main.width;

    this.container = scene.add.container(0, 0).setDepth(150);

    // 背景条
    this.bg = scene.add.rectangle(W / 2, 28, W, 56, 0x0a0a0a, 0.88);

    // 主信息
    this.mainText = scene.add.text(10, 10, '', {
      fontSize: '16px', fontFamily: 'monospace', color: '#39ff14',
    });

    // 性格摘要（右侧）
    this.personalityText = scene.add.text(W - 10, 10, '', {
      fontSize: '16px', fontFamily: 'monospace', color: '#888888',
    }).setOrigin(1, 0);

    this.container.add([this.bg, this.mainText, this.personalityText]);

    // 监听数据更新
    this.offFullStats = eventBus.on('nfa:fullStats', (data: unknown) => {
      this.stats = data as typeof this.stats;
      this.refresh();
    });

    this.refresh();
  }

  refresh() {
    const s = this.stats;
    this.mainText.setText(
      `NFA #${this.nfaId}  |  Lv.${s.level}  |  CLW: ${s.clw}  |  HP: ${s.hp}`
    );

    // 找最高性格维度
    const dims = [
      { name: '勇', val: s.courage },
      { name: '智', val: s.wisdom },
      { name: '社', val: s.social },
      { name: '创', val: s.create },
      { name: '毅', val: s.grit },
    ];
    const sorted = [...dims].sort((a, b) => b.val - a.val);
    const top = sorted[0];
    this.personalityText.setText(`${top.name}${top.val}  ${sorted[1].name}${sorted[1].val}  ${sorted[2].name}${sorted[2].val}`);
  }

  destroy() {
    this.offFullStats();
    this.container.destroy(true);
  }
}
