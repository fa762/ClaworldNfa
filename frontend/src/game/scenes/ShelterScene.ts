import * as Phaser from 'phaser';
import { eventBus } from '../EventBus';
import { DialogueBox } from '../ui/DialogueBox';
import { StatusHUD } from '../ui/StatusHUD';
import { getTaskDialogue, getPKDialogue, getMarketDialogue, getPortalDialogue, getOpenClawDialogue, getSableDialogue, type GameLang, type SableNode } from '../data/npc-dialogues';
import { GAME_UI_FONT_FAMILY } from '../ui/fonts';
import { buildLobsterIdentity } from '@/lib/lobsterIdentity';
import { getShelterDescription, getShelterSpecialty } from '@/lib/shelter';

interface NpcDef {
  key: string;
  texture: string;
  artTexture?: string;
  label: string;
  x: number;
  y: number;
  action: string; // scene key or event name
}

interface RectRegion {
  x: number;
  y: number;
  w: number;
  h: number;
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

interface WorldLayout {
  width: number;
  height: number;
  centerX: number;
  centerY: number;
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
  private world!: WorldLayout;
  private blockers: RectRegion[] = [];
  private blockerObjects: Phaser.GameObjects.Rectangle[] = [];
  private playerShadow?: Phaser.GameObjects.Ellipse;
  private playerShadowOffsetY = 18;

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
    eventBus.emit('game:scene', { scene: 'shelter', nfaId: this.nfaId, shelter: this.shelter });

    const viewportW = this.cameras.main.width;
    const viewportH = this.cameras.main.height;
    const compactViewport = viewportW < 820 || viewportH < 700;
    const portraitViewport = viewportH > viewportW;
    const touchFriendly = compactViewport || portraitViewport;
    const overlayTextResolution = touchFriendly ? 2 : 1;
    this.world = this.getWorldLayout(viewportW, viewportH);
    const W = this.world.width;
    const H = this.world.height;
    const specialty = getShelterSpecialty(this.shelter, this.lang);

    if (this.textures.exists('shelter-00-bg')) {
      this.add.image(0, 0, 'shelter-00-bg').setOrigin(0).setDisplaySize(W, H).setDepth(0);
    } else {
      const floorTexture = this.textures.exists('tile-floor-art') ? 'tile-floor-art' : 'tile-floor';
      for (let x = 0; x < W + 32; x += 32) {
        for (let y = 0; y < H + 32; y += 32) {
          this.add.image(x, y, floorTexture).setOrigin(0);
        }
      }
    }

    this.add.rectangle(this.sx(840), this.sy(928), this.sx(508), this.sy(132), 0x08110f, 0.2).setDepth(1);
    this.add.rectangle(this.sx(840), this.sy(980), this.sx(420), this.sy(42), 0x39ff14, 0.05).setDepth(1);
    this.add.rectangle(this.sx(300), this.sy(982), this.sx(150), this.sy(40), 0xaa66ff, 0.05).setDepth(1);
    this.add.rectangle(this.sx(1380), this.sy(988), this.sx(170), this.sy(44), 0x66ffcc, 0.05).setDepth(1);

    const shelterNames = this.lang === 'zh'
      ? ['虚空', '珊瑚', '深渊', '海藻', '海沟', '礁石', '火山', '废土']
      : ['Void', 'Coral', 'Abyss', 'Kelp', 'Trench', 'Reef', 'Volcano', 'Wasteland'];
    const shelterName = shelterNames[this.shelter] || `SHELTER-0${this.shelter}`;
    this.add.text(W / 2, 14, `SHELTER-0${this.shelter}  ${shelterName}`, {
      fontSize: '18px', fontFamily: GAME_UI_FONT_FAMILY, color: '#39ff14',
    }).setOrigin(0.5, 0).setDepth(100).setAlpha(0.7).setScrollFactor(0);

    const shelterDesc = this.lang === 'zh'
      ? getShelterDescription(this.shelter)
      : [
          'Underground corridor, blue biolight, hydroponic trays',
          'Military steel corridor',
          'Stone walls etched with scripture, warm candlelight',
          'Container market, Claworld price screens',
          'Glass partitions, surveillance cameras',
          'Graffiti walls, children sketches',
          'Grey sky, ruins, distant city outline',
          'Glowing moss, natural cavern, firepit',
        ][this.shelter] ?? '';

    this.add.text(W / 2, 36, shelterDesc, {
      fontSize: W < 720 ? '9px' : '11px', fontFamily: GAME_UI_FONT_FAMILY, color: '#7adf8b',
      align: 'center', wordWrap: { width: W - 100 },
    }).setOrigin(0.5).setDepth(100).setAlpha(0.45).setScrollFactor(0);

    this.add.text(W / 2, 54, this.lang === 'zh' ? `区域偏向：${specialty.text}` : `Shelter specialty: ${specialty.text}`, {
      fontSize: W < 720 ? '9px' : '11px', fontFamily: GAME_UI_FONT_FAMILY, color: specialty.color,
      align: 'center', wordWrap: { width: W - 100 },
    }).setOrigin(0.5).setDepth(100).setAlpha(0.65).setScrollFactor(0);

    this.npcDefs = [
      { key: 'market',   texture: 'npc-market',    artTexture: 'npc-market-art',    label: this.lang === 'zh' ? '[ 撮合墙 ]' : '[ MATCH WALL ]',        x: this.sx(846),  y: this.sy(294),  action: 'MarketScene' },
      { key: 'task',     texture: 'npc-task',      artTexture: 'npc-task-art',      label: this.lang === 'zh' ? '[ 任务终端 ]' : '[ TASK ]',             x: this.sx(300),  y: this.sy(452),  action: 'TaskScene' },
      { key: 'pk',       texture: 'npc-pk',        artTexture: 'npc-pk-art',        label: this.lang === 'zh' ? '[ 竞技擂台 ]' : '[ ARENA ]',            x: this.sx(1380), y: this.sy(450),  action: 'PKScene' },
      { key: 'sable',    texture: 'npc-sable-art', artTexture: 'npc-sable-art',     label: this.lang === 'zh' ? '[ SABLE / 清算员 ]' : '[ SABLE / CLEARER ]', x: this.sx(1130), y: this.sy(760),  action: 'event:sable' },
      { key: 'portal',   texture: 'portal',        artTexture: 'portal-art',        label: this.lang === 'zh' ? '[ 隧道传送 ]' : '[ PORTAL ]',           x: this.sx(248),  y: this.sy(1020), action: 'event:portal' },
      { key: 'openclaw', texture: 'npc-openclaw',  artTexture: 'npc-openclaw-art',  label: this.lang === 'zh' ? '[ 意识唤醒舱 ]' : '[ AWAKENING ]',      x: this.sx(1396), y: this.sy(1016), action: 'event:openclaw' },
    ];

    this.npcs = [];
    for (const def of this.npcDefs) {
      const npcTexture = def.artTexture && this.textures.exists(def.artTexture) ? def.artTexture : def.texture;
      const npc = this.physics.add.sprite(def.x, def.y, npcTexture);
      npc.setImmovable(true);
      npc.setAlpha(0.001);
      npc.setData('def', def);
      npc.setDepth(def.y);
      this.applyNpcHitbox(npc, def.key);

      const labelYOffset = def.key === 'market' ? this.sy(58) : this.sy(42);
      this.add.text(def.x, def.y - labelYOffset, def.label, {
        fontSize: compactViewport ? '14px' : '16px', fontFamily: GAME_UI_FONT_FAMILY, color: '#39ff14',
      }).setOrigin(0.5).setAlpha(0.85).setDepth(def.y + 18);

      this.npcs.push(npc);
    }

    this.blockers = [
      this.scaleRect(0, 0, 1680, 138),
      this.scaleRect(0, 0, 96, 1260),
      this.scaleRect(1584, 0, 96, 1260),
      this.scaleRect(96, 1204, 1488, 56),
      this.scaleRect(146, 262, 268, 252),
      this.scaleRect(1268, 262, 266, 252),
      this.scaleRect(654, 214, 372, 74),
      this.scaleRect(622, 514, 136, 78),
      this.scaleRect(916, 514, 128, 78),
      this.scaleRect(1056, 654, 178, 114),
      this.scaleRect(154, 908, 182, 120),
      this.scaleRect(1312, 914, 190, 122),
    ];

    for (const region of this.blockers) {
      const blocker = this.add.rectangle(region.x + region.w / 2, region.y + region.h / 2, region.w, region.h, 0xff0000, 0);
      this.physics.add.existing(blocker, true);
      this.blockerObjects.push(blocker);
    }

    const occluders = [
      this.scaleRect(118, 822, 320, 282),
      this.scaleRect(654, 694, 392, 128),
      this.scaleRect(1232, 806, 328, 288),
    ];
    occluders.forEach((region) => {
      if (!this.textures.exists('shelter-00-bg')) {
        return;
      }
      this.add.image(0, 0, 'shelter-00-bg')
        .setOrigin(0)
        .setDisplaySize(W, H)
        .setCrop(region.x / this.scaleX(), region.y / this.scaleY(), region.w / this.scaleX(), region.h / this.scaleY())
        .setDepth(region.y + region.h + 24);
    });

    const spawn = this.playerPosition && !this.isBlockedPoint(this.playerPosition.x, this.playerPosition.y)
      ? this.playerPosition
      : { x: this.sx(840), y: this.sy(944) };

    const hasSpriteSheet = this.textures.exists('player-walk');
    const shadowWidth = compactViewport ? this.sx(46) : this.sx(58);
    const shadowHeight = compactViewport ? this.sy(18) : this.sy(24);
    this.playerShadowOffsetY = compactViewport ? 18 : 22;
    this.playerShadow = this.add.ellipse(spawn.x, spawn.y + this.sy(this.playerShadowOffsetY), shadowWidth, shadowHeight, 0x000000, 0.28).setDepth(spawn.y - 2);
    this.player = this.physics.add.sprite(spawn.x, spawn.y, hasSpriteSheet ? 'player-walk' : 'player', hasSpriteSheet ? 1 : undefined);
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(spawn.y + 6);
    if (hasSpriteSheet) {
      this.player.setSize(18, 20).setOffset(15, 24);
    }

    this.spawnWorldEchoes(W, H);

    this.physics.add.collider(this.player, this.npcs);
    this.physics.world.setBounds(this.sx(32), this.sy(32), W - this.sx(64), H - this.sy(64));
    this.blockerObjects.forEach((blocker) => {
      this.physics.add.collider(this.player, blocker);
    });
    this.cameras.main.setBounds(0, 0, W, H);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setZoom(1);
    this.cameras.main.roundPixels = true;

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.promptText = this.add.text(viewportW / 2, portraitViewport ? viewportH - 116 : viewportH - 70, '', {
      fontSize: portraitViewport ? '17px' : compactViewport ? '14px' : '18px', fontFamily: GAME_UI_FONT_FAMILY, color: '#ffd700',
      wordWrap: { width: portraitViewport ? viewportW - 36 : viewportW - 80 },
      align: 'center',
      lineSpacing: portraitViewport ? 6 : 0,
    }).setOrigin(0.5).setDepth(130).setScrollFactor(0).setResolution(overlayTextResolution);

    this.add.text(viewportW / 2, portraitViewport ? viewportH - 156 : viewportH - 96, this.lang === 'zh' ? 'WASD/方向键移动  ·  点击地面移动  ·  靠近装置按 SPACE' : 'WASD/Arrows move  ·  Tap ground to move  ·  Press SPACE near terminals', {
      fontSize: portraitViewport ? '12px' : compactViewport ? '9px' : '12px', fontFamily: GAME_UI_FONT_FAMILY, color: '#39ff14',
      align: 'center',
      wordWrap: { width: portraitViewport ? viewportW - 36 : viewportW - 40 },
      lineSpacing: portraitViewport ? 6 : 0,
    }).setOrigin(0.5).setDepth(130).setAlpha(0.55).setScrollFactor(0).setResolution(overlayTextResolution);

    this.hudText = this.add.text(10, portraitViewport ? viewportH - 52 : viewportH - 24, touchFriendly
      ? (this.lang === 'zh' ? `NFA #${this.nfaId}\n点地面移动 · 靠近后点击装置交互` : `NFA #${this.nfaId}\nTap ground to move · Tap terminals nearby`)
      : (this.lang === 'zh' ? `NFA #${this.nfaId}  |  WASD 移动  |  SPACE 交互` : `NFA #${this.nfaId}  |  WASD Move  |  SPACE Interact`), {
      fontSize: portraitViewport ? '12px' : compactViewport ? '11px' : '14px', fontFamily: GAME_UI_FONT_FAMILY, color: '#39ff14',
      wordWrap: { width: Math.max(220, portraitViewport ? viewportW - 24 : viewportW - 140) },
      lineSpacing: touchFriendly ? 4 : compactViewport ? 3 : 0,
    }).setDepth(130).setAlpha(touchFriendly ? 0.82 : 0.6).setScrollFactor(0).setResolution(overlayTextResolution);

    this.dialogueBox = new DialogueBox(this, this.lang);
    this.statusHUD = new StatusHUD(this, this.nfaId);

    const offStats = eventBus.on('nfa:stats', (data: unknown) => {
      const stats = data as { clw: string; level: number; active?: boolean; dailyCost?: string };
      this.hudText.setText(touchFriendly
        ? (this.lang === 'zh'
          ? `NFA #${this.nfaId}\nClaworld: ${stats.clw}  |  Lv.${stats.level}\n${stats.active ? 'ACTIVE' : 'DORMANT'}  ·  UPKEEP ${stats.dailyCost ?? '0'}`
          : `NFA #${this.nfaId}\nClaworld: ${stats.clw}  |  Lv.${stats.level}\n${stats.active ? 'ACTIVE' : 'DORMANT'}  ·  UPKEEP ${stats.dailyCost ?? '0'}`)
        : (this.lang === 'zh'
          ? `NFA #${this.nfaId}  |  Claworld: ${stats.clw}  |  Lv.${stats.level}  |  ${stats.active ? 'ACTIVE' : 'DORMANT'}  |  UPKEEP ${stats.dailyCost ?? '0'}  |  WASD 移动  |  SPACE 交互`
          : `NFA #${this.nfaId}  |  Claworld: ${stats.clw}  |  Lv.${stats.level}  |  ${stats.active ? 'ACTIVE' : 'DORMANT'}  |  UPKEEP ${stats.dailyCost ?? '0'}  |  WASD Move  |  SPACE Interact`));
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

    const offCommand = eventBus.on('game:command', (data: unknown) => {
      const payload = data as { name?: string; args?: string[] };
      if (!payload.name) return;
      this.handleCliCommand(payload.name, payload.args ?? []);
    });

    this.registry.set('nfaId', this.nfaId);
    this.registry.set('shelter', this.shelter);
    this.registry.set('personality', this.personality);
    this.registry.set('playerPosition', { x: this.player.x, y: this.player.y });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offStats();
      offFullStats();
      offSwitchNfa();
      offCommand();
      this.dialogueBox.destroy();
      this.statusHUD.destroy();
      this.playerShadow?.destroy();
      this.blockerObjects.forEach((blocker) => blocker.destroy());
      this.blockerObjects = [];
      this.echoes.forEach((echo) => echo.destroy());
      this.echoes = [];
    });

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
    this.player.setDepth(this.player.y + 6);
    if (this.playerShadow) {
      this.playerShadow.setPosition(this.player.x, this.player.y + this.sy(this.playerShadowOffsetY));
      this.playerShadow.setDepth(this.player.y - 2);
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
    this.stopMovement();
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
      case 'sable': {
        this.openSableDialogue('intro', sceneData);
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

  private handleCliCommand(name: string, args: string[]) {
    const sceneData = this.buildSceneData();

    switch (name) {
      case 'task':
        this.scene.start('TaskScene', sceneData);
        break;
      case 'pk':
        this.scene.start('PKScene', sceneData);
        break;
      case 'market':
        this.scene.start('MarketScene', sceneData);
        break;
      case 'shelter':
        this.scene.restart(sceneData);
        break;
      case 'portal': {
        const targetShelter = Number(args[0]);
        if (Number.isInteger(targetShelter) && targetShelter >= 0 && targetShelter <= 7) {
          this.scene.start('ShelterScene', { ...sceneData, shelter: targetShelter });
        }
        break;
      }
      case 'openclaw':
        eventBus.emit('game:openclaw');
        break;
      default:
        break;
    }
  }

  private applyNpcHitbox(npc: Phaser.Physics.Arcade.Sprite, key: string) {
    const body = npc.body as Phaser.Physics.Arcade.Body;
    const map: Record<string, { width: number; height: number; offsetX: number; offsetY: number }> = {
      task: { width: 24, height: 12, offsetX: 12, offsetY: 34 },
      pk: { width: 24, height: 12, offsetX: 12, offsetY: 34 },
      market: { width: 42, height: 12, offsetX: 11, offsetY: 34 },
      sable: { width: 24, height: 14, offsetX: 22, offsetY: 68 },
      portal: { width: 18, height: 18, offsetX: 15, offsetY: 24 },
      openclaw: { width: 24, height: 16, offsetX: 12, offsetY: 30 },
    };

    const hitbox = map[key] ?? { width: 20, height: 12, offsetX: 14, offsetY: 32 };
    body.setSize(hitbox.width, hitbox.height);
    body.setOffset(hitbox.offsetX, hitbox.offsetY);
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
        fontSize: W < 720 ? '9px' : '11px', fontFamily: GAME_UI_FONT_FAMILY, color: '#7adf8b',
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
          `擂台频道：发现新的链上对局信号，可前往竞技场查看`,
          `避难所情报：${getShelterDescription(this.shelter)}`,
        ]
      : [
          `World Broadcast: 3 active lobster echoes detected near SHELTER-0${this.shelter}`,
          `Market feed: new auction and swap requests were written onchain in the last 24h`,
          `Arena channel: new on-chain match signals detected near the arena terminals`,
          `Shelter intel: ${['Underground corridor, blue biolight, hydroponic trays','Military steel corridor','Stone walls etched with scripture, warm candlelight','Container market, Claworld price screens','Glass partitions, surveillance cameras','Graffiti walls, children sketches','Grey sky, ruins, distant city outline','Glowing moss, natural cavern, firepit'][this.shelter] ?? ''}`,
        ];

    const broadcast = this.add.text(W / 2, 34, broadcastMessages[0], {
      fontSize: W < 720 ? '9px' : '11px', fontFamily: GAME_UI_FONT_FAMILY, color: '#39ff14', align: 'center',
      wordWrap: { width: Math.max(280, this.cameras.main.width - 80) },
    }).setOrigin(0.5).setAlpha(0.45).setDepth(100).setScrollFactor(0);

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

  private openSableDialogue(node: SableNode, sceneData: ShelterSceneData) {
    const d = getSableDialogue(node, this.lang);
    this.dialogueBox.show(d.lines, () => {
      if (!d.choices) return;
      this.dialogueBox.showChoices(d.choices.map((choice) => ({
        label: choice.label,
        callback: () => {
          this.lastInteractTime = Date.now();
          if (choice.action === 'dialogue:close') return;
          if (choice.action === 'market:browse' || choice.action === 'market:list') {
            this.scene.start('MarketScene', { ...sceneData, entryAction: choice.action });
            return;
          }
          if (choice.action.startsWith('sable:')) {
            this.openSableDialogue(choice.action.replace('sable:', '') as SableNode, sceneData);
          }
        },
      })));
    });
  }

  private getWorldLayout(viewportW: number, viewportH: number): WorldLayout {
    const compact = viewportW < 820 || viewportH < 700;
    const portrait = viewportH > viewportW;
    const width = portrait
      ? Math.max(1080, Math.floor(viewportW * 1.35))
      : compact
        ? Math.max(1360, Math.floor(viewportW * 1.9))
        : Math.max(1680, Math.floor(viewportW * 1.5));
    const height = portrait
      ? Math.max(1520, Math.floor(viewportH * 1.55))
      : compact
        ? Math.max(1080, Math.floor(viewportH * 1.8))
        : Math.max(1260, Math.floor(viewportH * 1.6));

    return {
      width,
      height,
      centerX: Math.floor(width / 2),
      centerY: Math.floor(height / 2),
    };
  }

  private sx(value: number) {
    return Math.round((value / 1680) * this.world.width);
  }

  private sy(value: number) {
    return Math.round((value / 1260) * this.world.height);
  }

  private scaleX() {
    return this.world.width / 1680;
  }

  private scaleY() {
    return this.world.height / 1260;
  }

  private scaleRect(x: number, y: number, w: number, h: number): RectRegion {
    return {
      x: this.sx(x),
      y: this.sy(y),
      w: Math.round(w * this.scaleX()),
      h: Math.round(h * this.scaleY()),
    };
  }

  private isBlockedPoint(x: number, y: number) {
    return this.blockers.some((region) => (
      x >= region.x && x <= region.x + region.w && y >= region.y && y <= region.y + region.h
    ));
  }

  private stopMovement() {
    this.moveTarget = null;
    if (this.player?.body) {
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(0, 0);
    }
  }

  private setupTouchControls() {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.dialogueBox.isVisible()) {
        this.stopMovement();
        return;
      }

      const worldPoint = (pointer.positionToCamera(this.cameras.main) ?? pointer) as Phaser.Math.Vector2;

      // 如果点击在 NPC 附近，当作交互
      for (const npc of this.npcs) {
        const npcDist = Phaser.Math.Distance.Between(worldPoint.x, worldPoint.y, npc.x, npc.y);
        if (npcDist < 40) {
          const def = npc.getData('def') as NpcDef;
          this.handleInteract(def);
          return;
        }
      }

      const target = {
        x: Phaser.Math.Clamp(worldPoint.x, 36, this.world.width - 36),
        y: Phaser.Math.Clamp(worldPoint.y, 36, this.world.height - 36),
      };

      if (this.isBlockedPoint(target.x, target.y)) {
        this.moveTarget = null;
        return;
      }

      // 点击/触屏地面后持续移动到目标点
      this.moveTarget = target;

      // 近距离二次点击，直接清除移动目标
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, this.moveTarget.x, this.moveTarget.y) < 8) {
        this.moveTarget = null;
      }
    });
  }
}
