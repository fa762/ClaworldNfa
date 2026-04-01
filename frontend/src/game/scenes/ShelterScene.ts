import * as Phaser from 'phaser';
import { eventBus } from '../EventBus';
import { DialogueBox } from '../ui/DialogueBox';
import { StatusHUD } from '../ui/StatusHUD';
import { getTaskDialogue, getPKDialogue, getMarketDialogue, getPortalDialogue, getOpenClawDialogue, type GameLang } from '../data/npc-dialogues';
import { buildLobsterIdentity } from '@/lib/lobsterIdentity';
import { getShelterDescription } from '@/lib/shelter';

interface NpcDef {
  key: string;
  texture: string;
  artTexture?: string;
  label: string;
  x: number;
  y: number;
  action: string; // scene key or event name
}

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

interface ShelterSceneData {
  nfaId: number;
  shelter: number;
  personality?: Personality;
  playerPosition?: PlayerPosition;
  entryAction?: string;
  lang?: GameLang;
}

interface EchoProjection {
  nfaId: number;
  x: number;
  y: number;
  title: string;
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
  private personality: Personality = { courage: 50, wisdom: 50, social: 50, create: 50, grit: 50 };
  private readonly SPEED = 160;
  private readonly INTERACT_DIST = 50;
  private facing: 'front' | 'back' | 'left' | 'right' = 'front';
  private lastInteractTime = 0;
  private readonly INTERACT_COOLDOWN = 600; // ms，对话关闭后防止立即重触发
  private playerPosition?: PlayerPosition;
  private moveTarget: PlayerPosition | null = null;
  private lang: GameLang = 'zh';
  private echoes: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super({ key: 'ShelterScene' });
  }

  init(data: ShelterSceneData) {
    this.nfaId = data.nfaId || (this.registry.get('nfaId') as number) || 1;
    this.shelter = data.shelter || (this.registry.get('shelter') as number) || 0;
    if (data.personality) this.personality = data.personality;
    else {
      const cached = this.registry.get('personality') as typeof ShelterScene.prototype.personality | undefined;
      if (cached) this.personality = cached;
    }
    this.playerPosition = data.playerPosition || (this.registry.get('playerPosition') as PlayerPosition | undefined);
    this.lang = data.lang || (this.registry.get('gameLang') as GameLang) || 'zh';
  }

  create() {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;
    const floorTexture = this.textures.exists('tile-floor-art') ? 'tile-floor-art' : 'tile-floor';

    // ── 地板 ──
    for (let x = 0; x < W + 32; x += 32) {
      for (let y = 0; y < H + 32; y += 32) {
        this.add.image(x, y, floorTexture).setOrigin(0);
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

    // ── 功能分区光带 ──
    const zoneDefs = [
      { x: W * 0.25, y: H * 0.3, w: 160, h: 92, color: 0xffd34d },
      { x: W * 0.75, y: H * 0.3, w: 160, h: 92, color: 0xff4d4d },
      { x: W * 0.5, y: H * 0.2, w: 220, h: 84, color: 0x4da3ff },
      { x: W * 0.15, y: H * 0.7, w: 132, h: 84, color: 0xaa66ff },
      { x: W * 0.85, y: H * 0.7, w: 148, h: 92, color: 0x66ffcc },
    ];

    zoneDefs.forEach((zone) => {
      this.add.rectangle(zone.x, zone.y, zone.w, zone.h, zone.color, 0.06).setDepth(1);
      this.add.rectangle(zone.x, zone.y + zone.h / 2 - 4, zone.w * 0.72, 6, zone.color, 0.08).setDepth(1);
    });

    this.add.rectangle(W / 2, H / 2, Math.min(W * 0.55, 440), 12, 0x39ff14, 0.04).setDepth(1);
    this.add.rectangle(W / 2, H / 2 + 78, Math.min(W * 0.4, 320), 8, 0x39ff14, 0.03).setDepth(1);
    this.spawnHallOfEchoes(W, H);

    // ── 标题 ──
    const shelterNames = this.lang === 'zh'
      ? ['虚空', '珊瑚', '深渊', '海藻', '海沟', '礁石', '火山', '废土']
      : ['Void', 'Coral', 'Abyss', 'Kelp', 'Trench', 'Reef', 'Volcano', 'Wasteland'];
    const shelterName = shelterNames[this.shelter] || `SHELTER-0${this.shelter}`;
    this.add.text(W / 2, 14, `SHELTER-0${this.shelter}  ${shelterName}`, {
      fontSize: '18px', fontFamily: 'monospace', color: '#39ff14',
    }).setOrigin(0.5, 0).setDepth(100).setAlpha(0.7);

    const shelterDesc = this.lang === 'zh'
      ? getShelterDescription(this.shelter)
      : [
          'Underground corridor, blue biolight, hydroponic trays',
          'Military steel corridor',
          'Stone walls etched with scripture, warm candlelight',
          'Container market, CLW price screens',
          'Glass partitions, surveillance cameras',
          'Graffiti walls, children sketches',
          'Grey sky, ruins, distant city outline',
          'Glowing moss, natural cavern, firepit',
        ][this.shelter] ?? '';

    this.add.text(W / 2, 36, shelterDesc, {
      fontSize: W < 720 ? '9px' : '11px', fontFamily: 'monospace', color: '#7adf8b',
      align: 'center', wordWrap: { width: W - 100 },
    }).setOrigin(0.5).setDepth(100).setAlpha(0.45);

    // ── NPC 定义（根据场景大小自适应位置） ──
    this.npcDefs = [
      { key: 'task',     texture: 'npc-task',     artTexture: 'npc-task-art',     label: this.lang === 'zh' ? '[ 任务终端 ]' : '[ TASK ]',        x: W * 0.25,  y: H * 0.3,  action: 'TaskScene' },
      { key: 'pk',       texture: 'npc-pk',       artTexture: 'npc-pk-art',       label: this.lang === 'zh' ? '[ 竞技擂台 ]' : '[ ARENA ]',       x: W * 0.75,  y: H * 0.3,  action: 'PKScene' },
      { key: 'market',   texture: 'npc-market',   artTexture: 'npc-market-art',   label: this.lang === 'zh' ? '[ 交易墙 ]' : '[ MARKET ]',      x: W * 0.5,   y: H * 0.2,  action: 'MarketScene' },
      { key: 'portal',   texture: 'portal',       artTexture: 'portal-art',       label: this.lang === 'zh' ? '[ 隧道传送 ]' : '[ PORTAL ]',      x: W * 0.15,  y: H * 0.7,  action: 'event:portal' },
      { key: 'openclaw', texture: 'npc-openclaw', artTexture: 'npc-openclaw-art', label: this.lang === 'zh' ? '[ 意识唤醒舱 ]' : '[ AWAKENING ]', x: W * 0.85,  y: H * 0.7,  action: 'event:openclaw' },
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
        fontSize: '16px', fontFamily: 'monospace', color: '#39ff14',
      }).setOrigin(0.5).setAlpha(0.85);

      this.npcs.push(npc);
    }

    // ── 玩家龙虾 ──
    const hasSpriteSheet = this.textures.exists('player-walk');
    const spawn = this.playerPosition ?? { x: W / 2, y: H / 2 };
    this.player = this.physics.add.sprite(spawn.x, spawn.y, hasSpriteSheet ? 'player-walk' : 'player', hasSpriteSheet ? 1 : undefined);
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10);
    if (hasSpriteSheet) {
      this.player.setSize(18, 20).setOffset(15, 24);
    }

    this.spawnWorldEchoes(W, H);

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
    this.promptText = this.add.text(W / 2, H - 56, '', {
      fontSize: '18px', fontFamily: 'monospace', color: '#ffd700',
    }).setOrigin(0.5).setDepth(100);

    this.add.text(W / 2, H - 82, this.lang === 'zh' ? 'WASD/方向键移动  ·  点击地面移动  ·  靠近装置按 SPACE' : 'WASD/Arrows move  ·  Tap ground to move  ·  Press SPACE near terminals', {
      fontSize: W < 720 ? '10px' : '12px', fontFamily: 'monospace', color: '#39ff14',
      align: 'center',
      wordWrap: { width: W - 40 },
    }).setOrigin(0.5).setDepth(100).setAlpha(0.38);

    // ── HUD ──
    this.hudText = this.add.text(8, H - 22, this.lang === 'zh' ? `NFA #${this.nfaId}  |  WASD 移动  |  SPACE 交互` : `NFA #${this.nfaId}  |  WASD Move  |  SPACE Interact`, {
      fontSize: '14px', fontFamily: 'monospace', color: '#39ff14',
    }).setDepth(100).setAlpha(0.6);

    // ── 对话框 ──
    this.dialogueBox = new DialogueBox(this, this.lang);

    // ── 状态 HUD ──
    this.statusHUD = new StatusHUD(this, this.nfaId);

    // ── 监听链上数据更新 ──
    const offStats = eventBus.on('nfa:stats', (data: unknown) => {
      const stats = data as { clw: string; level: number; active?: boolean; dailyCost?: string };
      this.hudText.setText(this.lang === 'zh'
        ? `NFA #${this.nfaId}  |  CLW: ${stats.clw}  |  Lv.${stats.level}  |  ${stats.active ? 'ACTIVE' : 'DORMANT'}  |  UPKEEP ${stats.dailyCost ?? '0'}  |  WASD 移动  |  SPACE 交互`
        : `NFA #${this.nfaId}  |  CLW: ${stats.clw}  |  Lv.${stats.level}  |  ${stats.active ? 'ACTIVE' : 'DORMANT'}  |  UPKEEP ${stats.dailyCost ?? '0'}  |  WASD Move  |  SPACE Interact`);
    });

    const offFullStats = eventBus.on('nfa:fullStats', (data: unknown) => {
      const stats = data as { courage: number; wisdom: number; social: number; create: number; grit: number };
      this.personality = { courage: stats.courage, wisdom: stats.wisdom, social: stats.social, create: stats.create, grit: stats.grit };
      this.registry.set('personality', this.personality);
    });

    const offSwitchNfa = eventBus.on('game:switchNfa', (data: unknown) => {
      const payload = data as { nfaId: number; shelter: number; personality: Personality };
      this.nfaId = payload.nfaId;
      this.shelter = payload.shelter;
      this.personality = payload.personality;
      this.registry.set('nfaId', this.nfaId);
      this.registry.set('shelter', this.shelter);
      this.registry.set('personality', this.personality);
      this.scene.restart({
        nfaId: this.nfaId,
        shelter: this.shelter,
        personality: this.personality,
        playerPosition: { x: this.player.x, y: this.player.y },
      });
    });

    this.registry.set('nfaId', this.nfaId);
    this.registry.set('shelter', this.shelter);
    this.registry.set('personality', this.personality);
    this.registry.set('playerPosition', { x: this.player.x, y: this.player.y });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offStats();
      offFullStats();
      offSwitchNfa();
      this.dialogueBox.destroy();
      this.statusHUD.destroy();
      this.echoes.forEach((echo) => echo.destroy());
      this.echoes = [];
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

    const usingKeyboard = left || right || up || down;

    if (usingKeyboard) {
      this.moveTarget = null;
    } else if (this.moveTarget) {
      const dx = this.moveTarget.x - this.player.x;
      const dy = this.moveTarget.y - this.player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= 6) {
        this.moveTarget = null;
      } else {
        body.setVelocity((dx / dist) * this.SPEED, (dy / dist) * this.SPEED);
      }
    }

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
      this.promptText.setText(this.lang === 'zh' ? `[SPACE / 点击] 进入 ${def.label}` : `[SPACE / Tap] Enter ${def.label}`);
      this.promptText.setAlpha(1);
    } else {
      this.promptText.setAlpha(0);
    }

    // ── 交互 ──
    const now = Date.now();
    if (Phaser.Input.Keyboard.JustDown(this.interactKey) && this.nearestNpc
        && now - this.lastInteractTime > this.INTERACT_COOLDOWN) {
      const def = this.nearestNpc.getData('def') as NpcDef;
      this.handleInteract(def);
    }

    this.registry.set('playerPosition', { x: this.player.x, y: this.player.y });
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
    this.lastInteractTime = Date.now();
    // 根据 NPC 类型显示对话
    const sceneData = this.buildSceneData();

    switch (def.key) {
      case 'task': {
        const d = getTaskDialogue(this.nfaId, this.personality, this.lang);
        this.dialogueBox.show(d.lines, () => {
          if (d.choices) {
            this.dialogueBox.showChoices(d.choices.map(c => ({
              label: c.label,
              callback: () => {
                this.lastInteractTime = Date.now();
                if (c.action === 'dialogue:close') return;
                this.scene.start('TaskScene', { ...sceneData, entryAction: c.action });
              },
            })));
          } else {
            this.lastInteractTime = Date.now();
            this.scene.start('TaskScene', sceneData);
          }
        });
        break;
      }
      case 'pk': {
        const d = getPKDialogue(this.nfaId, this.lang);
        this.dialogueBox.show(d.lines, () => {
          if (d.choices) {
            this.dialogueBox.showChoices(d.choices.map(c => ({
              label: c.label,
              callback: () => {
                this.lastInteractTime = Date.now();
                if (c.action === 'dialogue:close') return;
                this.scene.start('PKScene', { ...sceneData, entryAction: c.action });
              },
            })));
          } else {
            this.lastInteractTime = Date.now();
          }
        });
        break;
      }
      case 'market': {
        const d = getMarketDialogue(this.lang);
        this.dialogueBox.show(d.lines, () => {
          if (d.choices) {
            this.dialogueBox.showChoices(d.choices.map(c => ({
              label: c.label,
              callback: () => {
                this.lastInteractTime = Date.now();
                if (c.action === 'dialogue:close') return;
                this.scene.start('MarketScene', { ...sceneData, entryAction: c.action });
              },
            })));
          } else {
            this.lastInteractTime = Date.now();
          }
        });
        break;
      }
      case 'portal': {
        const d = getPortalDialogue(this.shelter, this.lang);
        this.dialogueBox.show(d.lines, () => {
          if (d.choices) {
            this.dialogueBox.showChoices(d.choices.map(c => ({
              label: c.label,
              callback: () => {
                this.lastInteractTime = Date.now();
                const targetShelter = (c.data as { shelter: number }).shelter;
                this.scene.start('ShelterScene', { ...sceneData, shelter: targetShelter });
              },
            })));
          } else {
            this.lastInteractTime = Date.now();
          }
        });
        break;
      }
      case 'openclaw': {
        const d = getOpenClawDialogue(this.lang);
        this.dialogueBox.show(d.lines, () => {
          if (d.choices) {
            this.dialogueBox.showChoices(d.choices.map(c => ({
              label: c.label,
              callback: () => {
                this.lastInteractTime = Date.now();
                if (c.action === 'openclaw:install') {
                  eventBus.emit('game:openclaw');
                } else if (c.action === 'openclaw:connected') {
                  eventBus.emit('game:openclaw');
                }
              },
            })));
          } else {
            this.lastInteractTime = Date.now();
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

  private buildSceneData(): ShelterSceneData {
    return {
      nfaId: this.nfaId,
      shelter: this.shelter,
      personality: this.personality,
      playerPosition: { x: this.player.x, y: this.player.y },
      lang: this.lang,
    };
  }

  private spawnWorldEchoes(W: number, H: number) {
    const echoIds = [
      this.nfaId + 7,
      this.nfaId + 19,
      Math.max(1, this.nfaId - 11),
    ];
    const positions: EchoProjection[] = [
      { nfaId: echoIds[0], x: W * 0.38, y: H * 0.58, title: this.lang === 'zh' ? '活跃投影' : 'Active Echo' },
      { nfaId: echoIds[1], x: W * 0.62, y: H * 0.62, title: this.lang === 'zh' ? '交易残影' : 'Market Echo' },
      { nfaId: echoIds[2], x: W * 0.5, y: H * 0.75, title: this.lang === 'zh' ? '擂台回波' : 'Arena Echo' },
    ];

    positions.forEach((echo, index) => {
      const ring = this.add.circle(echo.x, echo.y, 18 + index * 2, 0x39ff14, 0.06).setDepth(4);
      const core = this.add.circle(echo.x, echo.y, 8, index === 1 ? 0x3399ff : 0x39ff14, 0.18).setDepth(5);
      const identity = buildLobsterIdentity({
        rarity: (echo.nfaId + index) % 5,
        shelter: (this.shelter + index + 1) % 8,
        level: 8 + ((echo.nfaId + index) % 21),
        courage: 30 + ((echo.nfaId * 7) % 60),
        wisdom: 30 + ((echo.nfaId * 11) % 60),
        social: 30 + ((echo.nfaId * 13) % 60),
        create: 30 + ((echo.nfaId * 17) % 60),
        grit: 30 + ((echo.nfaId * 19) % 60),
      }, this.lang);

      const text = this.add.text(echo.x, echo.y + 26, `${echo.title} · NFA #${echo.nfaId}\n${identity.title}`, {
        fontSize: W < 720 ? '9px' : '11px', fontFamily: 'monospace', color: '#7adf8b',
        align: 'center',
      }).setOrigin(0.5).setAlpha(0.55).setDepth(6);

      this.tweens.add({
        targets: [ring, core],
        alpha: { from: 0.04, to: 0.2 },
        scale: { from: 0.96, to: 1.08 },
        duration: 1200 + index * 200,
        yoyo: true,
        repeat: -1,
      });

      this.echoes.push(ring, core, text);
    });

    const broadcastMessages = this.lang === 'zh'
      ? [
          `世界广播：SHELTER-0${this.shelter} 近期检测到 3 个活跃龙虾信号`,
          `交易墙记录：最近 24 小时内有新的拍卖与互换请求写入链上`,
          `擂台频道：竞技终端正在等待新的揭示与结算动作`,
          `回声榜更新：最强龙虾投影已同步到当前避难所`,
          `避难所情报：${getShelterDescription(this.shelter)}`,
        ]
      : [
          `World Broadcast: 3 active lobster echoes detected near SHELTER-0${this.shelter}`,
          `Market feed: new auction and swap requests were written onchain in the last 24h`,
          `Arena channel: the combat terminals are waiting for new reveals and settlements`,
          `Hall of Echoes updated: champion lobster projections synced to this shelter`,
          `Shelter intel: ${['Underground corridor, blue biolight, hydroponic trays','Military steel corridor','Stone walls etched with scripture, warm candlelight','Container market, CLW price screens','Glass partitions, surveillance cameras','Graffiti walls, children sketches','Grey sky, ruins, distant city outline','Glowing moss, natural cavern, firepit'][this.shelter] ?? ''}`,
        ];

    const broadcast = this.add.text(W / 2, 34, broadcastMessages[0], {
      fontSize: W < 720 ? '9px' : '11px', fontFamily: 'monospace', color: '#39ff14', align: 'center',
      wordWrap: { width: W - 80 },
    }).setOrigin(0.5).setAlpha(0.45).setDepth(100);

    this.echoes.push(broadcast);

    let broadcastIndex = 0;
    this.time.addEvent({
      delay: 4200,
      repeat: -1,
      callback: () => {
        broadcastIndex = (broadcastIndex + 1) % broadcastMessages.length;
        broadcast.setText(broadcastMessages[broadcastIndex]);
      },
    });
  }

  private spawnHallOfEchoes(W: number, H: number) {
    const wallX = W - 118;
    const wallY = H * 0.52;
    const wall = this.add.rectangle(wallX, wallY, 168, 118, 0x061208, 0.55)
      .setStrokeStyle(1, 0x39ff14, 0.18)
      .setDepth(3);
    const title = this.add.text(wallX, wallY - 46, this.lang === 'zh' ? '[ 回声榜 ]' : '[ HALL OF ECHOES ]', {
      fontSize: '12px', fontFamily: 'monospace', color: '#39ff14',
    }).setOrigin(0.5).setDepth(4);

    this.echoes.push(wall, title);

    const champions = [
      { id: this.nfaId + 88, rank: 1 },
      { id: this.nfaId + 42, rank: 2 },
      { id: Math.max(1, this.nfaId - 23), rank: 3 },
    ];

    champions.forEach((champ, index) => {
      const identity = buildLobsterIdentity({
        rarity: (champ.id + index) % 5,
        shelter: (this.shelter + index + 2) % 8,
        level: 20 + ((champ.id + index) % 25),
        courage: 45 + ((champ.id * 7) % 50),
        wisdom: 45 + ((champ.id * 11) % 50),
        social: 45 + ((champ.id * 13) % 50),
        create: 45 + ((champ.id * 17) % 50),
        grit: 45 + ((champ.id * 19) % 50),
      }, this.lang);

      const y = wallY - 18 + index * 26;
      const row = this.add.text(wallX - 66, y, `${champ.rank}. NFA #${champ.id}`, {
        fontSize: '10px', fontFamily: 'monospace', color: index === 0 ? '#ffd700' : '#9ed89f',
      }).setDepth(4);
      const sub = this.add.text(wallX - 6, y, identity.title, {
        fontSize: '9px', fontFamily: 'monospace', color: '#7adf8b',
      }).setDepth(4);

      this.echoes.push(row, sub);
    });
  }

  private setupTouchControls() {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // 如果点击在 NPC 附近，当作交互
      for (const npc of this.npcs) {
        const npcDist = Phaser.Math.Distance.Between(pointer.x, pointer.y, npc.x, npc.y);
        if (npcDist < 40) {
          const def = npc.getData('def') as NpcDef;
          this.handleInteract(def);
          return;
        }
      }

      // 点击/触屏地面后持续移动到目标点
      const worldPoint = (pointer.positionToCamera(this.cameras.main) ?? pointer) as Phaser.Math.Vector2;
      this.moveTarget = {
        x: Phaser.Math.Clamp(worldPoint.x, 36, this.cameras.main.width - 36),
        y: Phaser.Math.Clamp(worldPoint.y, 36, this.cameras.main.height - 36),
      };

      // 近距离二次点击，直接清除移动目标
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, this.moveTarget.x, this.moveTarget.y) < 8) {
        this.moveTarget = null;
      }
    });
  }
}
