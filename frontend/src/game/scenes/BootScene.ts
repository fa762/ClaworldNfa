import * as Phaser from 'phaser';
import { eventBus } from '../EventBus';

/**
 * BootScene — 加载资源并在收到外层状态后进入 Shelter
 */
export class BootScene extends Phaser.Scene {
  private statusText!: Phaser.GameObjects.Text;
  private readonly assetVersion = '20260401-player-ascii-v1';

  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // ── 占位符精灵（纯色方块，后续替换像素art） ──
    this.generatePlaceholders();

    const assetUrl = (name: string) => `/api/game-assets/${name}?v=${this.assetVersion}`;

    // ── 主角龙虾行走图 ──
    this.load.spritesheet('player-walk', assetUrl('lobster-walk'), {
      frameWidth: 48,
      frameHeight: 48,
    });

    // ── 真实交互物像素资源 ──
    this.load.image('npc-task-art', assetUrl('npc-task'));
    this.load.image('npc-pk-art', assetUrl('npc-pk'));
    this.load.image('npc-market-art', assetUrl('npc-market'));
    this.load.image('portal-art', assetUrl('portal'));
    this.load.image('npc-openclaw-art', assetUrl('npc-openclaw'));
    this.load.image('tile-floor-art', assetUrl('tile-floor'));

    // ── 加载瓦片地图（如果存在） ──
    this.load.on('loaderror', () => { /* 静默忽略缺失资源 */ });
  }

  create() {
    const cx = this.cameras.main.centerX;
    const cy = this.cameras.main.centerY;

    // 标题
    this.add.text(cx, cy - 80, 'CLAW WORLD', {
      fontSize: '32px',
      fontFamily: 'monospace',
      color: '#39ff14',
    }).setOrigin(0.5);

    this.add.text(cx, cy - 45, 'AWAITING LINK', {
      fontSize: '12px',
      fontFamily: 'monospace',
      color: '#39ff14',
    }).setOrigin(0.5).setAlpha(0.5);

    // 状态文本
    this.statusText = this.add.text(cx, cy + 20, '', {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#39ff14',
    }).setOrigin(0.5);

    // 底部提示
    this.add.text(cx, cy + 80, '[ PRESS TAB TO LINK NFA ]', {
      fontSize: '11px',
      fontFamily: 'monospace',
      color: '#39ff14',
    }).setOrigin(0.5).setAlpha(0.4);

    // 扫描线效果
    const scanline = this.add.rectangle(0, 0, this.cameras.main.width, 2, 0x39ff14, 0.03);
    scanline.setOrigin(0, 0);
    this.tweens.add({
      targets: scanline,
      y: this.cameras.main.height,
      duration: 3000,
      repeat: -1,
    });

    // 初始化状态
    this.statusText.setText('AWAITING WALLET SYNC');

    // 缓存性格数据
    let cachedPersonality: { courage: number; wisdom: number; social: number; create: number; grit: number } | undefined;
    const offStats = eventBus.on('nfa:fullStats', (data: unknown) => {
      const stats = data as { courage: number; wisdom: number; social: number; create: number; grit: number };
      cachedPersonality = { courage: stats.courage, wisdom: stats.wisdom, social: stats.social, create: stats.create, grit: stats.grit };
      this.registry.set('personality', cachedPersonality);
    });

    // 监听 NFA 数据加载完成
    const offLoaded = eventBus.on('nfa:loaded', (data: unknown) => {
      const { nfaId, shelter } = data as { nfaId: number; shelter: number };
      this.registry.set('nfaId', nfaId);
      this.registry.set('shelter', shelter);
      this.statusText.setText(`NFA #${nfaId} LINKED - SHELTER-0${shelter}`);
      this.scene.start('ShelterScene', { nfaId, shelter, personality: cachedPersonality });
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offStats();
      offLoaded();
    });

    this.createPlayerAnimations();

    // 通知桥接层 Phaser 已就绪
    eventBus.emit('game:ready');
  }

  private createPlayerAnimations() {
    if (!this.textures.exists('player-walk')) {
      return;
    }

    const animations: Array<{ key: string; frames: number[] }> = [
      { key: 'player-walk-front', frames: [0, 1, 2] },
      { key: 'player-walk-back', frames: [3, 4, 5] },
      { key: 'player-walk-left', frames: [6, 7, 8] },
      { key: 'player-walk-right', frames: [9, 10, 11] },
    ];

    for (const animation of animations) {
      if (this.anims.exists(animation.key)) {
        continue;
      }

      this.anims.create({
        key: animation.key,
        frames: animation.frames.map((frame) => ({ key: 'player-walk', frame })),
        frameRate: 7,
        repeat: -1,
      });
    }
  }

  /**
   * 生成占位符纹理（后续替换为像素精灵）
   */
  private generatePlaceholders() {
    // 龙虾玩家 — 绿色方块 32x32
    const playerGfx = this.make.graphics({ x: 0, y: 0 });
    playerGfx.fillStyle(0x39ff14);
    playerGfx.fillRect(0, 0, 28, 28);
    playerGfx.fillStyle(0x000000);
    playerGfx.fillRect(6, 6, 4, 4);   // 左眼
    playerGfx.fillRect(18, 6, 4, 4);  // 右眼
    playerGfx.fillRect(4, 18, 20, 4); // 嘴
    // 钳子
    playerGfx.fillStyle(0x39ff14);
    playerGfx.fillRect(-6, 8, 8, 4);
    playerGfx.fillRect(26, 8, 8, 4);
    playerGfx.generateTexture('player', 32, 32);
    playerGfx.destroy();

    // 其他玩家龙虾 — 半透明青色
    const ghostGfx = this.make.graphics({ x: 0, y: 0 });
    ghostGfx.fillStyle(0x00ffff, 0.4);
    ghostGfx.fillRect(2, 2, 28, 28);
    ghostGfx.generateTexture('ghost-lobster', 32, 32);
    ghostGfx.destroy();

    // 任务终端机 NPC — 黄色
    const taskNpc = this.make.graphics({ x: 0, y: 0 });
    taskNpc.fillStyle(0xffd700);
    taskNpc.fillRect(4, 0, 24, 28);
    taskNpc.fillStyle(0x000000);
    taskNpc.fillRect(8, 4, 16, 10);  // 屏幕
    taskNpc.fillStyle(0x39ff14);
    taskNpc.fillRect(10, 6, 12, 6);  // 屏幕内容
    taskNpc.generateTexture('npc-task', 32, 32);
    taskNpc.destroy();

    // PK 擂台终端 — 红色
    const pkNpc = this.make.graphics({ x: 0, y: 0 });
    pkNpc.fillStyle(0xff3333);
    pkNpc.fillRect(4, 0, 24, 28);
    pkNpc.fillStyle(0x000000);
    pkNpc.fillRect(8, 4, 16, 10);
    pkNpc.fillStyle(0xff6666);
    pkNpc.fillRect(10, 6, 12, 6);
    pkNpc.generateTexture('npc-pk', 32, 32);
    pkNpc.destroy();

    // 市场交易墙 — 蓝色
    const marketNpc = this.make.graphics({ x: 0, y: 0 });
    marketNpc.fillStyle(0x3399ff);
    marketNpc.fillRect(0, 0, 48, 32);
    marketNpc.fillStyle(0x000000);
    marketNpc.fillRect(4, 4, 12, 8);
    marketNpc.fillRect(20, 4, 12, 8);
    marketNpc.fillRect(4, 16, 12, 8);
    marketNpc.fillRect(20, 16, 12, 8);
    marketNpc.generateTexture('npc-market', 48, 32);
    marketNpc.destroy();

    // 传送门 — 紫色圆形
    const portal = this.make.graphics({ x: 0, y: 0 });
    portal.fillStyle(0xaa44ff, 0.7);
    portal.fillCircle(16, 16, 14);
    portal.fillStyle(0x000000, 0.5);
    portal.fillCircle(16, 16, 8);
    portal.generateTexture('portal', 32, 32);
    portal.destroy();

    // OpenClaw 意识唤醒舱 — 白色
    const ocNpc = this.make.graphics({ x: 0, y: 0 });
    ocNpc.fillStyle(0xffffff, 0.8);
    ocNpc.fillRect(4, 0, 24, 30);
    ocNpc.fillStyle(0x39ff14);
    ocNpc.fillRect(8, 4, 16, 16);
    ocNpc.fillStyle(0x000000);
    ocNpc.fillRect(12, 8, 8, 8);
    ocNpc.generateTexture('npc-openclaw', 32, 32);
    ocNpc.destroy();

    // 地板瓦片
    const floor = this.make.graphics({ x: 0, y: 0 });
    floor.fillStyle(0x111111);
    floor.fillRect(0, 0, 32, 32);
    floor.lineStyle(1, 0x222222);
    floor.strokeRect(0, 0, 32, 32);
    floor.generateTexture('tile-floor', 32, 32);
    floor.destroy();

    // 墙壁瓦片
    const wall = this.make.graphics({ x: 0, y: 0 });
    wall.fillStyle(0x1a1a2e);
    wall.fillRect(0, 0, 32, 32);
    wall.lineStyle(1, 0x39ff14, 0.2);
    wall.strokeRect(1, 1, 30, 30);
    wall.generateTexture('tile-wall', 32, 32);
    wall.destroy();
  }
}
