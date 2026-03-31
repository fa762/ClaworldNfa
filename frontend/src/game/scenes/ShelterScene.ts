import * as Phaser from 'phaser';
import { eventBus } from '../EventBus';
import { DialogueBox } from '../ui/DialogueBox';
import { StatusHUD } from '../ui/StatusHUD';
import { getTaskDialogue, getPKDialogue, getMarketDialogue, getPortalDialogue, getOpenClawDialogue } from '../data/npc-dialogues';

interface NpcDef {
  key: string;
  texture: string;
  artTexture?: string;
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
  private dialogueBox!: DialogueBox;
  private statusHUD!: StatusHUD;
  private nfaId = 0;
  private shelter = 0;
  private personality = { courage: 50, wisdom: 50, social: 50, create: 50, grit: 50 };
  private readonly SPEED = 160;
  private readonly INTERACT_DIST = 50;
  private facing: 'front' | 'back' | 'left' | 'right' = 'front';

  constructor() {
    super({ key: 'ShelterScene' });
  }

  init(data: { nfaId: number; shelter: number; personality?: typeof ShelterScene.prototype.personality }) {
    this.nfaId = data.nfaId || (this.registry.get('nfaId') as number) || 1;
    this.shelter = data.shelter || (this.registry.get('shelter') as number) || 0;
    if (data.personality) this.personality = data.personality;
    else {
      const cached = this.registry.get('personality') as typeof ShelterScene.prototype.personality | undefined;
      if (cached) this.personality = cached;
    }
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
      { key: 'task',     texture: 'npc-task',     artTexture: 'npc-task-art',     label: '[ 任务终端 ]',     x: W * 0.25,  y: H * 0.3,  action: 'TaskScene' },
      { key: 'pk',       texture: 'npc-pk',       artTexture: 'npc-pk-art',       label: '[ 竞技擂台 ]',     x: W * 0.75,  y: H * 0.3,  action: 'PKScene' },
      { key: 'market',   texture: 'npc-market',   artTexture: 'npc-market-art',   label: '[ 交易墙 ]',       x: W * 0.5,   y: H * 0.2,  action: 'MarketScene' },
      { key: 'portal',   texture: 'portal',       artTexture: 'portal-art',       label: '[ 隧道传送 ]',     x: W * 0.15,  y: H * 0.7,  action: 'event:portal' },
      { key: 'openclaw', texture: 'npc-openclaw', artTexture: 'npc-openclaw-art', label: '[ 意识唤醒舱 ]',   x: W * 0.85,  y: H * 0.7,  action: 'event:openclaw' },
    ];

    // ── 创建 NPC ──
    this.npcs = [];
    for (const def of this.npcDefs) {
      const npcTexture = def.artTexture && this.textures.exists(def.artTexture) ? def.artTexture : def.texture;
      const npc = this.physics.add.sprite(def.x, def.y, npcTexture);
      npc.setImmovable(true);
      npc.setData('def', def);
      npc.setDepth(8);

      // NPC 标签
      this.add.text(def.x, def.y - npc.displayHeight / 2 - 10, def.label, {
        fontSize: '9px', fontFamily: 'monospace', color: '#39ff14',
      }).setOrigin(0.5).setAlpha(0.6);

      // 传送门旋转动画
      if (def.key === 'portal') {
        this.tweens.add({ targets: npc, angle: 360, duration: 4000, repeat: -1 });
      }

      this.npcs.push(npc);
    }

    // ── 玩家龙虾 ──
    const hasSpriteSheet = this.textures.exists('player-walk');
    this.player = this.physics.add.sprite(W / 2, H / 2, hasSpriteSheet ? 'player-walk' : 'player', hasSpriteSheet ? 1 : undefined);
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10);
    if (hasSpriteSheet) {
      this.player.setSize(18, 20).setOffset(15, 24);
    }

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

    // ── 对话框 ──
    this.dialogueBox = new DialogueBox(this);

    // ── 状态 HUD ──
    this.statusHUD = new StatusHUD(this, this.nfaId);

    // ── 监听链上数据更新 ──
    const offStats = eventBus.on('nfa:stats', (data: unknown) => {
      const stats = data as { clw: string; level: number };
      this.hudText.setText(`NFA #${this.nfaId}  |  CLW: ${stats.clw}  |  Lv.${stats.level}  |  WASD 移动  |  SPACE 交互`);
    });

    const offFullStats = eventBus.on('nfa:fullStats', (data: unknown) => {
      const stats = data as { courage: number; wisdom: number; social: number; create: number; grit: number };
      this.personality = { courage: stats.courage, wisdom: stats.wisdom, social: stats.social, create: stats.create, grit: stats.grit };
      this.registry.set('personality', this.personality);
    });

    this.registry.set('nfaId', this.nfaId);
    this.registry.set('shelter', this.shelter);
    this.registry.set('personality', this.personality);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offStats();
      offFullStats();
      this.dialogueBox.destroy();
      this.statusHUD.destroy();
    });

    // ── 触屏支持（移动端） ──
    this.setupTouchControls();
  }

  update() {
    // 对话框打开时禁止移动
    if (this.dialogueBox && this.dialogueBox.isVisible()) return;

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

    this.updatePlayerAnimation(body.velocity.x, body.velocity.y);

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

  private updatePlayerAnimation(vx: number, vy: number) {
    if (!this.textures.exists('player-walk')) {
      return;
    }

    if (Math.abs(vx) < 1 && Math.abs(vy) < 1) {
      this.player.anims.stop();
      const idleFrames = {
        front: 1,
        back: 4,
        left: 7,
        right: 10,
      } as const;
      this.player.setFrame(idleFrames[this.facing]);
      return;
    }

    if (Math.abs(vx) > Math.abs(vy)) {
      this.facing = vx > 0 ? 'right' : 'left';
    } else {
      this.facing = vy > 0 ? 'front' : 'back';
    }

    const animKey = `player-walk-${this.facing}`;
    if (this.player.anims.currentAnim?.key !== animKey) {
      this.player.play(animKey, true);
    } else if (!this.player.anims.isPlaying) {
      this.player.play(animKey, true);
    }
  }

  private handleInteract(def: NpcDef) {
    // 根据 NPC 类型显示对话
    const sceneData = { nfaId: this.nfaId, shelter: this.shelter, personality: this.personality };

    switch (def.key) {
      case 'task': {
        const d = getTaskDialogue(this.nfaId, this.personality);
        this.dialogueBox.show(d.lines, () => {
          this.scene.start('TaskScene', sceneData);
        });
        break;
      }
      case 'pk': {
        const d = getPKDialogue(this.nfaId);
        this.dialogueBox.show(d.lines, () => {
          if (d.choices) {
            this.dialogueBox.showChoices(d.choices.map(c => ({
              label: c.label,
              callback: () => {
                if (c.action === 'dialogue:close') return;
                this.scene.start('PKScene', sceneData);
              },
            })));
          }
        });
        break;
      }
      case 'market': {
        const d = getMarketDialogue();
        this.dialogueBox.show(d.lines, () => {
          if (d.choices) {
            this.dialogueBox.showChoices(d.choices.map(c => ({
              label: c.label,
              callback: () => {
                if (c.action === 'dialogue:close') return;
                this.scene.start('MarketScene', sceneData);
              },
            })));
          }
        });
        break;
      }
      case 'portal': {
        const d = getPortalDialogue(this.shelter);
        this.dialogueBox.show(d.lines, () => {
          if (d.choices) {
            this.dialogueBox.showChoices(d.choices.map(c => ({
              label: c.label,
              callback: () => {
                const targetShelter = (c.data as { shelter: number }).shelter;
                this.scene.start('ShelterScene', { ...sceneData, shelter: targetShelter });
              },
            })));
          }
        });
        break;
      }
      case 'openclaw': {
        const d = getOpenClawDialogue();
        this.dialogueBox.show(d.lines, () => {
          if (d.choices) {
            this.dialogueBox.showChoices(d.choices.map(c => ({
              label: c.label,
              callback: () => {
                if (c.action === 'openclaw:install') {
                  eventBus.emit('game:openclaw');
                }
              },
            })));
          }
        });
        break;
      }
      default: {
        if (def.action.startsWith('event:')) {
          eventBus.emit('game:' + def.action.replace('event:', ''));
        } else {
          this.scene.start(def.action, sceneData);
        }
      }
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
