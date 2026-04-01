import * as Phaser from 'phaser';
import { eventBus } from '../EventBus';

/**
 * StatusHUD — 顶部常驻状态栏
 * 显示：NFA ID / 等级 / Claworld / BNB / 性格雷达
 */
export class StatusHUD {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Rectangle;
  private mainText: Phaser.GameObjects.Text;
  private personalityText: Phaser.GameObjects.Text;
  private nfaId = 0;
  private hasData = false;
  private stats = { level: 0, clw: '0', bnb: '0', courage: 0, wisdom: 0, social: 0, create: 0, grit: 0, hp: 0, active: false, dailyCost: 0, shelter: 0 };
  private readonly offFullStats: () => void;

  constructor(scene: Phaser.Scene, nfaId: number) {
    this.scene = scene;
    this.nfaId = nfaId;

    const W = scene.cameras.main.width;

    this.container = scene.add.container(0, 0).setDepth(150);

    // 背景条
    this.bg = scene.add.rectangle(W / 2, 32, W, 64, 0x0a0a0a, 0.88);

    // 主信息
    this.mainText = scene.add.text(10, 8, '', {
      fontSize: W < 720 ? '12px' : '16px', fontFamily: 'monospace', color: '#39ff14',
    });

    // 性格摘要（右侧）
    this.personalityText = scene.add.text(W - 10, W < 720 ? 28 : 8, '', {
      fontSize: W < 720 ? '11px' : '16px', fontFamily: 'monospace', color: '#888888',
    }).setOrigin(1, 0);

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
    this.mainText.setText(
      W < 720
        ? `NFA #${this.nfaId}  Lv.${s.level}  Claworld:${s.clw}  ${s.active ? 'ACTIVE' : 'DORMANT'}\nHP:${s.hp}  UPKEEP:${s.dailyCost.toFixed(1)}`
        : `NFA #${this.nfaId}  Lv.${s.level}  Claworld: ${s.clw}  HP: ${s.hp}  ${s.active ? 'ACTIVE' : 'DORMANT'}  UPKEEP: ${s.dailyCost.toFixed(1)}`
    );

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
      W < 720
        ? `${sorted[0].name}:${sorted[0].val}  ${sorted[1].name}:${sorted[1].val}`
        : `${sorted[0].name}:${sorted[0].val}  ${sorted[1].name}:${sorted[1].val}  ${sorted[2].name}:${sorted[2].val}`
    );
  }

  destroy() {
    this.offFullStats();
    this.container.destroy(true);
  }
}
