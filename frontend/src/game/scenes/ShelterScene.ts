import * as Phaser from 'phaser';
import { eventBus } from '../EventBus';

interface NpcDef {
  key: string;
  texture: string;
  label: string;
  x: number;
  y: number;
  action: string; // scene key or event name
}

/**
 * ShelterScene — 避难所主场景（赛博朋克终端厅）
 * 玩家控制龙虾在场景中走动，接近 NPC 按空格交互
 */
export class ShelterScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private interactKey!: Phaser.Input.Keyboard.Key;
  private npcs: Phaser.Physics.Arcade.Sprite[] = [];
  private npcDefs: NpcDef[] = [];
  private nearestNpc: Phaser.Physics.Arcade.Sprite | null = null;
  private promptText!: Phaser.GameObjects.Text;
  private hudText!: Phaser.GameObjects.Text;
  private nfaId = 0;
  private shelter = 0;
  private readonly SPEED = 160;
  private readonly INTERACT_DIST = 50;

  constructor() {
    super({ key: 'ShelterScene' });
  }

  init(data: { nfaId: number; shelter: number }) {
    this.nfaId = data.nfaId || 1;
    this.shelter = data.shelter || 0;
  }

  create() {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    // ── 地板 ──
    for (let x = 0; x < W + 32; x += 32) {
      for (let y = 0; y < H + 32; y += 32) {
        this.add.image(x, y, 'tile-floor').setOrigin(0);
      }
    }

    // ── 墙壁边框 ──
    for (let x = 0; x < W + 32; x += 32) {
      this.add.image(x, 0, 'tile-wall').setOrigin(0);
      this.add.image(x, H - 32, 'tile-wall').setOrigin(0);
    }
    for (let y = 0; y < H + 32; y += 32) {
      this.add.image(0, y, 'tile-wall').setOrigin(0);
      this.add.image(W - 32, y, 'tile-wall').setOrigin(0);
    }

    // ── 标题 ──
    const shelterNames = ['虚空', '珊瑚', '深渊', '海藻', '海沟', '礁石', '火山', '废土'];
    const shelterName = shelterNames[this.shelter] || `SHELTER-0${this.shelter}`;
    this.add.text(W / 2, 12, `SHELTER-0${this.shelter}  ${shelterName}`, {
      fontSize: '10px', fontFamily: 'monospace', color: '#39ff14',
    }).setOrigin(0.5, 0).setDepth(100).setAlpha(0.5);

    // ── NPC 定义（根据场景大小自适应位置） ──
    this.npcDefs = [
      { key: 'task',     texture: 'npc-task',     label: '[ 任务终端 ]',     x: W * 0.25,  y: H * 0.3,  action: 'TaskScene' },
      { key: 'pk',       texture: 'npc-pk',       label: '[ 竞技擂台 ]',     x: W * 0.75,  y: H * 0.3,  action: 'PKScene' },
      { key: 'market',   texture: 'npc-market',   label: '[ 交易墙 ]',       x: W * 0.5,   y: H * 0.2,  action: 'MarketScene' },
      { key: 'portal',   texture: 'portal',       label: '[ 隧道传送 ]',     x: W * 0.15,  y: H * 0.7,  action: 'event:portal' },
      { key: 'openclaw', texture: 'npc-openclaw', label: '[ 意识唤醒舱 ]',   x: W * 0.85,  y: H * 0.7,  action: 'event:openclaw' },
    ];

    // ── 创建 NPC ──
    this.npcs = [];
    for (const def of this.npcDefs) {
      const npc = this.physics.add.sprite(def.x, def.y, def.texture);
      npc.setImmovable(true);
      npc.setData('def', def);

      // NPC 标签
      this.add.text(def.x, def.y - 24, def.label, {
        fontSize: '9px', fontFamily: 'monospace', color: '#39ff14',
      }).setOrigin(0.5).setAlpha(0.6);

      // 传送门旋转动画
      if (def.key === 'portal') {
        this.tweens.add({ targets: npc, angle: 360, duration: 4000, repeat: -1 });
      }

      this.npcs.push(npc);
    }

    // ── 玩家龙虾 ──
    this.player = this.physics.add.sprite(W / 2, H / 2, 'player');
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10);

    // ── 碰撞 ──
    this.physics.world.setBounds(32, 32, W - 64, H - 64);

    // ── 键盘 ──
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // ── 交互提示 ──
    this.promptText = this.add.text(W / 2, H - 48, '', {
      fontSize: '11px', fontFamily: 'monospace', color: '#ffd700',
    }).setOrigin(0.5).setDepth(100);

    // ── HUD ──
    this.hudText = this.add.text(8, H - 20, `NFA #${this.nfaId}  |  WASD 移动  |  SPACE 交互`, {
      fontSize: '9px', fontFamily: 'monospace', color: '#39ff14',
    }).setDepth(100).setAlpha(0.4);

    // ── 监听链上数据更新 ──
    eventBus.on('nfa:stats', (data: unknown) => {
      const stats = data as { clw: string; level: number };
      this.hudText.setText(`NFA #${this.nfaId}  |  CLW: ${stats.clw}  |  Lv.${stats.level}  |  WASD 移动  |  SPACE 交互`);
    });

    // ── 触屏支持（移动端） ──
    this.setupTouchControls();
  }

  update() {
    // ── 移动 ──
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0);

    const left  = this.cursors.left.isDown  || this.wasd.A.isDown;
    const right = this.cursors.right.isDown || this.wasd.D.isDown;
    const up    = this.cursors.up.isDown    || this.wasd.W.isDown;
    const down  = this.cursors.down.isDown  || this.wasd.S.isDown;

    if (left)  body.setVelocityX(-this.SPEED);
    if (right) body.setVelocityX(this.SPEED);
    if (up)    body.setVelocityY(-this.SPEED);
    if (down)  body.setVelocityY(this.SPEED);

    // 对角线速度归一化
    if (body.velocity.length() > this.SPEED) {
      body.velocity.normalize().scale(this.SPEED);
    }

    // ── 检测最近 NPC ──
    this.nearestNpc = null;
    let minDist = this.INTERACT_DIST;
    for (const npc of this.npcs) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, npc.x, npc.y);
      if (dist < minDist) {
        minDist = dist;
        this.nearestNpc = npc;
      }
    }

    if (this.nearestNpc) {
      const def = this.nearestNpc.getData('def') as NpcDef;
      this.promptText.setText(`按 SPACE 进入 ${def.label}`);
      this.promptText.setAlpha(1);
    } else {
      this.promptText.setAlpha(0);
    }

    // ── 交互 ──
    if (Phaser.Input.Keyboard.JustDown(this.interactKey) && this.nearestNpc) {
      const def = this.nearestNpc.getData('def') as NpcDef;
      this.handleInteract(def);
    }
  }

  private handleInteract(def: NpcDef) {
    if (def.action.startsWith('event:')) {
      const eventName = def.action.replace('event:', '');
      if (eventName === 'portal') {
        eventBus.emit('game:portal', { shelter: this.shelter });
      } else if (eventName === 'openclaw') {
        eventBus.emit('game:openclaw');
      }
    } else {
      // 切换到对应场景
      this.scene.start(def.action, { nfaId: this.nfaId, shelter: this.shelter });
    }
  }

  private setupTouchControls() {
    // 简单触屏：点击方向移动
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const dx = pointer.x - this.player.x;
      const dy = pointer.y - this.player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // 如果点击在 NPC 附近，当作交互
      for (const npc of this.npcs) {
        const npcDist = Phaser.Math.Distance.Between(pointer.x, pointer.y, npc.x, npc.y);
        if (npcDist < 40) {
          const def = npc.getData('def') as NpcDef;
          this.handleInteract(def);
          return;
        }
      }

      // 否则移动玩家
      if (dist > 10) {
        const body = this.player.body as Phaser.Physics.Arcade.Body;
        body.setVelocity(
          (dx / dist) * this.SPEED,
          (dy / dist) * this.SPEED,
        );
        this.time.delayedCall(300, () => body.setVelocity(0));
      }
    });
  }
}
