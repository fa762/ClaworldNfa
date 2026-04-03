import * as Phaser from 'phaser';
import { eventBus } from '../EventBus';
import { pickTasks, calcMatchScore } from '../data/task-templates';
import type { GameLang } from '../data/npc-dialogues';
import { GAME_UI_FONT_FAMILY } from '../ui/fonts';
import { getShelterSceneHint, getShelterSpecialty, getShelterTaskBias } from '@/lib/shelter';

interface TaskOption {
  type: number;     // 0=courage 1=wisdom 2=social 3=create 4=grit
  title: string;
  desc: string;
  matchScore: number;
  clw: number;
  xp: number;
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

interface SwitchNfaPayload {
  nfaId: number;
  shelter: number;
  personality: Personality;
  lang?: GameLang;
}

const TYPE_COLORS = ['#ff4444', '#4488ff', '#ffaa00', '#aa44ff', '#44ff44'];

/**
 * TaskScene — 任务 3 选 1 界面
 * 显示 3 个任务选项，玩家选一个 → 调合约
 */
export class TaskScene extends Phaser.Scene {
  private nfaId = 0;
  private shelter = 0;
  private personality: Personality = { courage: 50, wisdom: 50, social: 50, create: 50, grit: 50 };
  private tasks: TaskOption[] = [];
  private selectedIdx = -1;
  private playerPosition?: PlayerPosition;
  private lang: GameLang = 'zh';
  private confirmationObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super({ key: 'TaskScene' });
  }

  init(data: { nfaId: number; shelter: number; personality?: Personality; playerPosition?: PlayerPosition; lang?: GameLang }) {
    this.nfaId = data.nfaId || (this.registry.get('nfaId') as number) || 1;
    this.shelter = data.shelter || (this.registry.get('shelter') as number) || 0;
    if (data.personality) {
      this.personality = data.personality;
    } else {
      const cached = this.registry.get('personality') as Personality | undefined;
      if (cached) this.personality = cached;
    }
    this.playerPosition = data.playerPosition || (this.registry.get('playerPosition') as PlayerPosition | undefined);
    this.lang = data.lang || (this.registry.get('gameLang') as GameLang) || 'zh';
  }

  create() {
    eventBus.emit('game:scene', { scene: 'task', nfaId: this.nfaId, shelter: this.shelter });

    const W = this.cameras.main.width;
    const H = this.cameras.main.height;
    const compact = W < 900;

    // 背景
    this.add.rectangle(W / 2, H / 2, W, H, 0x0a0a0a, 0.95);

    // 标题
    this.add.text(W / 2, 30, this.lang === 'zh' ? '[ 任务分配终端 ]' : '[ TASK TERMINAL ]', {
      fontSize: '24px', fontFamily: GAME_UI_FONT_FAMILY, color: '#ffd700',
    }).setOrigin(0.5);

    this.add.text(W / 2, 50, this.lang === 'zh' ? `NFA #${this.nfaId} — 选择一个任务` : `NFA #${this.nfaId} — Choose a task`, {
      fontSize: '14px', fontFamily: GAME_UI_FONT_FAMILY, color: '#39ff14',
    }).setOrigin(0.5).setAlpha(0.6);

    const specialty = getShelterSpecialty(this.shelter, this.lang);
    this.add.text(W / 2, 66, this.lang === 'zh' ? `当前避难所偏向：${specialty.text}` : `Current shelter bias: ${specialty.text}`, {
      fontSize: '11px', fontFamily: GAME_UI_FONT_FAMILY, color: specialty.color,
    }).setOrigin(0.5).setAlpha(0.75);

    this.add.text(W / 2, 82, getShelterSceneHint(this.shelter, 'task', this.lang), {
      fontSize: '10px', fontFamily: GAME_UI_FONT_FAMILY, color: '#9fd39f',
      wordWrap: { width: W - 40 }, align: 'center',
    }).setOrigin(0.5).setAlpha(0.62);

    // 生成 3 个模板任务（MVP 阶段，后续接 AI）
    this.tasks = this.generateTasks();

    // 渲染任务卡片
    const headerHeight = compact ? 106 : 96;
    const footerReserve = compact ? 18 : 0;
    const cardW = compact ? Math.min(W - 28, 420) : Math.min(W * 0.28, 250);
    const gap = compact ? 12 : 20;
    const compactAvailableHeight = H - headerHeight - footerReserve - gap * 2;
    const cardH = compact ? Math.max(146, Math.floor(compactAvailableHeight / 3)) : H - 160;
    const startX = compact ? (W - cardW) / 2 : (W - (cardW * 3 + gap * 2)) / 2;

    this.tasks.forEach((task, i) => {
      const x = compact ? startX : startX + i * (cardW + gap);
      const y = compact ? headerHeight + i * (cardH + gap) : 96;

      // 卡片背景
      const card = this.add.rectangle(x + cardW / 2, y + cardH / 2, cardW, cardH, 0x111122, 0.9);
      card.setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(TYPE_COLORS[task.type]).color, 0.6);
      card.setInteractive({ useHandCursor: true });

        // 类型标签
        this.add.text(x + cardW / 2, y + 15, `[ ${this.getTypeNames()[task.type]} ]`, {
          fontSize: '15px', fontFamily: GAME_UI_FONT_FAMILY, color: TYPE_COLORS[task.type],
        }).setOrigin(0.5);

      // 标题
      const title = this.add.text(x + cardW / 2, y + 40, task.title, {
        fontSize: compact ? '13px' : '14px', fontFamily: GAME_UI_FONT_FAMILY, color: '#ffffff',
        wordWrap: { width: cardW - 24, useAdvancedWrap: true }, align: 'center',
        maxLines: compact ? 2 : 3,
      }).setOrigin(0.5, 0);
      title.setFixedSize(cardW - 24, compact ? 34 : 46);

      // 描述
      const desc = this.add.text(x + 12, y + (compact ? 82 : 75), task.desc, {
        fontSize: compact ? '11px' : '12px', fontFamily: GAME_UI_FONT_FAMILY, color: '#aaaaaa',
        wordWrap: { width: cardW - 24, useAdvancedWrap: true },
        maxLines: compact ? 3 : 8,
        lineSpacing: compact ? 4 : 2,
      });
      desc.setFixedSize(cardW - 24, compact ? 54 : cardH - 146);

      // 奖励
      this.add.text(x + cardW / 2, y + cardH - (compact ? 38 : 50), `Claworld: +${task.clw}  XP: +${task.xp}`, {
        fontSize: compact ? '12px' : '13px', fontFamily: GAME_UI_FONT_FAMILY, color: '#39ff14',
        wordWrap: { width: cardW - 24, useAdvancedWrap: true },
        align: 'center',
      }).setOrigin(0.5);

      // 匹配度
      const matchColor = task.matchScore >= 1.0 ? '#39ff14' : task.matchScore >= 0.5 ? '#ffaa00' : '#ff4444';
      this.add.text(x + cardW / 2, y + cardH - (compact ? 18 : 30), `${this.lang === 'zh' ? '匹配度' : 'Match'}: ${task.matchScore.toFixed(2)}x`, {
        fontSize: compact ? '12px' : '13px', fontFamily: GAME_UI_FONT_FAMILY, color: matchColor,
      }).setOrigin(0.5);

      // 点击选择
      card.on('pointerdown', () => this.selectTask(i));
      card.on('pointerover', () => card.setStrokeStyle(2, 0x39ff14));
      card.on('pointerout', () => {
        if (this.selectedIdx !== i) {
          card.setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(TYPE_COLORS[task.type]).color, 0.6);
        }
      });
    });

    const topBackBtn = this.add.text(16, 16, this.lang === 'zh' ? '[ ← 返回避难所 ]' : '[ ← BACK ]', {
      fontSize: compact ? '13px' : '14px', fontFamily: GAME_UI_FONT_FAMILY, color: '#39ff14',
      backgroundColor: '#061a06', padding: { x: 8, y: 5 },
    }).setOrigin(0, 0).setDepth(1000).setScrollFactor(0).setInteractive({ useHandCursor: true });
    topBackBtn.on('pointerdown', () => this.goBack());

    this.input.keyboard!.on('keydown-ESC', () => this.goBack());

    // 键盘选择 1/2/3
    this.input.keyboard!.on('keydown-ONE',   () => this.selectTask(0));
    this.input.keyboard!.on('keydown-TWO',   () => this.selectTask(1));
    this.input.keyboard!.on('keydown-THREE', () => this.selectTask(2));

    const offFullStats = eventBus.on('nfa:fullStats', (data: unknown) => {
      const stats = data as Personality;
      this.personality = stats;
      this.registry.set('personality', stats);
    });

    const offSwitchNfa = eventBus.on('game:switchNfa', (data: unknown) => {
      const payload = data as SwitchNfaPayload;
      this.scene.start('ShelterScene', {
        nfaId: payload.nfaId,
        shelter: payload.shelter,
        personality: payload.personality,
        playerPosition: this.playerPosition,
        lang: payload.lang ?? this.lang,
      });
    });

    const offCommand = eventBus.on('game:command', (data: unknown) => {
      const payload = data as { name?: string; args?: string[] };
      if (!payload.name) return;
      this.handleCliCommand(payload.name, payload.args ?? []);
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offFullStats();
      offSwitchNfa();
      offCommand();
    });
  }

  private selectTask(idx: number) {
    if (this.selectedIdx >= 0) return; // 已选择
    this.selectedIdx = idx;
    const task = this.tasks[idx];

    const W = this.cameras.main.width;
    const H = this.cameras.main.height;
    const compact = W < 900;
    const boxWidth = compact ? Math.min(W - 28, 420) : 420;
    const titleText = this.add.text(W / 2, H / 2 - 35, this.lang === 'zh' ? `确认执行: ${task.title}?` : `Confirm task: ${task.title}?`, {
      fontSize: compact ? '16px' : '18px', fontFamily: GAME_UI_FONT_FAMILY, color: '#ffd700', align: 'center',
      wordWrap: { width: boxWidth - 60, useAdvancedWrap: true },
      lineSpacing: 4,
    }).setOrigin(0.5).setDepth(52);

    const detailText = this.add.text(W / 2, H / 2 + 10, this.lang === 'zh' ? `Claworld +${task.clw}  XP +${task.xp}  匹配 ${task.matchScore.toFixed(2)}x` : `Claworld +${task.clw}  XP +${task.xp}  Match ${task.matchScore.toFixed(2)}x`, {
      fontSize: compact ? '13px' : '14px', fontFamily: GAME_UI_FONT_FAMILY, color: '#39ff14',
      align: 'center',
      wordWrap: { width: boxWidth - 48, useAdvancedWrap: true },
      lineSpacing: 3,
    }).setOrigin(0.5).setDepth(52);

    const contentHeight = Math.max(titleText.height + detailText.height + 94, compact ? 188 : 170);

    // 确认弹窗
    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.7).setDepth(50);
    const confirmBox = this.add.rectangle(W / 2, H / 2, boxWidth, contentHeight, 0x111122).setDepth(51);
    confirmBox.setStrokeStyle(1, 0x39ff14);

    titleText.setPosition(W / 2, H / 2 - contentHeight / 2 + 42);
    detailText.setPosition(W / 2, H / 2 - contentHeight / 2 + 90);

    // 确认/取消
    const yesBtn = this.add.text(W / 2 - 60, H / 2 + contentHeight / 2 - 34, this.lang === 'zh' ? '[ 确认 ]' : '[ CONFIRM ]', {
      fontSize: '16px', fontFamily: GAME_UI_FONT_FAMILY, color: '#39ff14',
    }).setOrigin(0.5).setDepth(52).setInteractive({ useHandCursor: true });

    const noBtn = this.add.text(W / 2 + 60, H / 2 + contentHeight / 2 - 34, this.lang === 'zh' ? '[ 取消 ]' : '[ CANCEL ]', {
      fontSize: '16px', fontFamily: GAME_UI_FONT_FAMILY, color: '#ff4444',
    }).setOrigin(0.5).setDepth(52).setInteractive({ useHandCursor: true });

    this.confirmationObjects = [overlay, confirmBox, titleText, detailText, yesBtn, noBtn];

    yesBtn.on('pointerdown', () => {
      // 发送到 React 层调合约
      eventBus.emit('task:submit', {
        nfaId: this.nfaId,
        taskType: task.type,
        xp: task.xp,
        clw: task.clw,
        matchScore: Math.round(task.matchScore * 100),
      });

      // 显示等待
      this.clearConfirmationObjects();
      const waitText = this.add.text(W / 2, H / 2, this.lang === 'zh' ? '上链中...' : 'Submitting onchain...', {
        fontSize: '20px', fontFamily: GAME_UI_FONT_FAMILY, color: '#ffd700',
      }).setOrigin(0.5).setDepth(52);

      // 监听结果
      const unsub = eventBus.on('task:result', (res: unknown) => {
        const result = res as { status: 'pending' | 'confirmed' | 'failed'; txHash?: string; error?: string; actualClw?: string };

        if (result.status === 'pending') {
          waitText.setText(this.lang === 'zh' ? `等待确认...\n${result.txHash?.slice(0, 10)}...` : `Awaiting confirmation...\n${result.txHash?.slice(0, 10)}...`);
          return;
        }

        waitText.destroy();

        if (result.status === 'confirmed') {
          const rewardText = result.actualClw
            ? (this.lang === 'zh' ? `任务完成! 实际奖励 ${Number(result.actualClw).toFixed(2)} Claworld` : `Task complete! Reward ${Number(result.actualClw).toFixed(2)} Claworld`)
            : (this.lang === 'zh' ? `任务完成! TX: ${result.txHash?.slice(0, 10)}...` : `Task complete! TX: ${result.txHash?.slice(0, 10)}...`);

          this.add.text(W / 2, H / 2, rewardText, {
            fontSize: '16px', fontFamily: GAME_UI_FONT_FAMILY, color: '#39ff14',
            align: 'center',
            wordWrap: { width: 360 },
          }).setOrigin(0.5).setDepth(52);
        } else {
          this.add.text(W / 2, H / 2, this.lang === 'zh' ? `失败: ${result.error}` : `Failed: ${result.error}`, {
            fontSize: '16px', fontFamily: GAME_UI_FONT_FAMILY, color: '#ff4444',
            align: 'center',
            wordWrap: { width: Math.min(W - 32, 420), useAdvancedWrap: true },
          }).setOrigin(0.5).setDepth(52);
          this.selectedIdx = -1;
        }
        this.time.delayedCall(2000, () => this.goBack());
        unsub();
      });
    });

    noBtn.on('pointerdown', () => {
      this.clearConfirmationObjects();
      this.selectedIdx = -1;
    });
  }

  private generateTasks(): TaskOption[] {
    // 根据性格权重从 25 个模板中选取 3 个任务
    const templates = pickTasks(this.personality, getShelterTaskBias(this.shelter));
    return templates.map(t => ({
      type: t.type,
      title: t.title,
      desc: t.desc,
      matchScore: calcMatchScore(this.personality, t.type),
      clw: Math.min(t.baseClw, 100),
      xp: Math.min(t.baseXp, 50),
    }));
  }

  private goBack() {
    this.clearConfirmationObjects();
    this.scene.start('ShelterScene', { nfaId: this.nfaId, shelter: this.shelter, personality: this.personality, playerPosition: this.playerPosition, lang: this.lang });
  }

  private clearConfirmationObjects() {
    this.confirmationObjects.forEach((obj) => obj.destroy());
    this.confirmationObjects = [];
  }

  private handleCliCommand(name: string, args: string[]) {
    const sceneData = {
      nfaId: this.nfaId,
      shelter: this.shelter,
      personality: this.personality,
      playerPosition: this.playerPosition,
      lang: this.lang,
    };

    switch (name) {
      case 'task':
        this.scene.restart(sceneData);
        break;
      case 'pk':
        this.scene.start('PKScene', sceneData);
        break;
      case 'market':
        this.scene.start('MarketScene', sceneData);
        break;
      case 'shelter':
        this.scene.start('ShelterScene', sceneData);
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

  private getTypeNames() {
    return this.lang === 'zh'
      ? ['勇气', '智慧', '社交', '创造', '毅力']
      : ['Courage', 'Wisdom', 'Social', 'Create', 'Grit'];
  }
}
