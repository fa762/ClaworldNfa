import * as Phaser from 'phaser';
import { eventBus } from '../EventBus';

interface TaskOption {
  type: number;     // 0=courage 1=wisdom 2=social 3=create 4=grit
  title: string;
  desc: string;
  matchScore: number;
  clw: number;
  xp: number;
}

const TYPE_NAMES = ['勇气', '智慧', '社交', '创造', '毅力'];
const TYPE_COLORS = ['#ff4444', '#4488ff', '#ffaa00', '#aa44ff', '#44ff44'];

/**
 * TaskScene — 任务 3 选 1 界面
 * 显示 3 个任务选项，玩家选一个 → 调合约
 */
export class TaskScene extends Phaser.Scene {
  private nfaId = 0;
  private shelter = 0;
  private tasks: TaskOption[] = [];
  private selectedIdx = -1;

  constructor() {
    super({ key: 'TaskScene' });
  }

  init(data: { nfaId: number; shelter: number }) {
    this.nfaId = data.nfaId || 1;
    this.shelter = data.shelter || 0;
  }

  create() {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    // 背景
    this.add.rectangle(W / 2, H / 2, W, H, 0x0a0a0a, 0.95);

    // 标题
    this.add.text(W / 2, 30, '[ 任务分配终端 ]', {
      fontSize: '16px', fontFamily: 'monospace', color: '#ffd700',
    }).setOrigin(0.5);

    this.add.text(W / 2, 50, `NFA #${this.nfaId} — 选择一个任务`, {
      fontSize: '10px', fontFamily: 'monospace', color: '#39ff14',
    }).setOrigin(0.5).setAlpha(0.6);

    // 生成 3 个模板任务（MVP 阶段，后续接 AI）
    this.tasks = this.generateTasks();

    // 渲染任务卡片
    const cardW = Math.min(W * 0.28, 220);
    const gap = 20;
    const totalW = cardW * 3 + gap * 2;
    const startX = (W - totalW) / 2;

    this.tasks.forEach((task, i) => {
      const x = startX + i * (cardW + gap);
      const y = 80;
      const cardH = H - 160;

      // 卡片背景
      const card = this.add.rectangle(x + cardW / 2, y + cardH / 2, cardW, cardH, 0x111122, 0.9);
      card.setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(TYPE_COLORS[task.type]).color, 0.6);
      card.setInteractive({ useHandCursor: true });

      // 类型标签
      this.add.text(x + cardW / 2, y + 15, `[ ${TYPE_NAMES[task.type]} ]`, {
        fontSize: '12px', fontFamily: 'monospace', color: TYPE_COLORS[task.type],
      }).setOrigin(0.5);

      // 标题
      this.add.text(x + cardW / 2, y + 40, task.title, {
        fontSize: '11px', fontFamily: 'monospace', color: '#ffffff',
        wordWrap: { width: cardW - 20 }, align: 'center',
      }).setOrigin(0.5, 0);

      // 描述
      this.add.text(x + 10, y + 75, task.desc, {
        fontSize: '9px', fontFamily: 'monospace', color: '#aaaaaa',
        wordWrap: { width: cardW - 20 },
      });

      // 奖励
      this.add.text(x + cardW / 2, y + cardH - 50, `CLW: +${task.clw}  XP: +${task.xp}`, {
        fontSize: '10px', fontFamily: 'monospace', color: '#39ff14',
      }).setOrigin(0.5);

      // 匹配度
      const matchColor = task.matchScore >= 1.0 ? '#39ff14' : task.matchScore >= 0.5 ? '#ffaa00' : '#ff4444';
      this.add.text(x + cardW / 2, y + cardH - 30, `匹配度: ${task.matchScore.toFixed(2)}x`, {
        fontSize: '10px', fontFamily: 'monospace', color: matchColor,
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

    // 返回按钮
    const backBtn = this.add.text(W / 2, H - 30, '[ ESC 返回避难所 ]', {
      fontSize: '10px', fontFamily: 'monospace', color: '#39ff14',
    }).setOrigin(0.5).setAlpha(0.5).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => this.goBack());

    this.input.keyboard!.on('keydown-ESC', () => this.goBack());

    // 键盘选择 1/2/3
    this.input.keyboard!.on('keydown-ONE',   () => this.selectTask(0));
    this.input.keyboard!.on('keydown-TWO',   () => this.selectTask(1));
    this.input.keyboard!.on('keydown-THREE', () => this.selectTask(2));
  }

  private selectTask(idx: number) {
    if (this.selectedIdx >= 0) return; // 已选择
    this.selectedIdx = idx;
    const task = this.tasks[idx];

    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    // 确认弹窗
    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.7).setDepth(50);
    const confirmBox = this.add.rectangle(W / 2, H / 2, 300, 120, 0x111122).setDepth(51);
    confirmBox.setStrokeStyle(1, 0x39ff14);

    this.add.text(W / 2, H / 2 - 35, `确认执行: ${task.title}?`, {
      fontSize: '12px', fontFamily: 'monospace', color: '#ffd700', align: 'center',
      wordWrap: { width: 280 },
    }).setOrigin(0.5).setDepth(52);

    this.add.text(W / 2, H / 2 + 5, `CLW +${task.clw}  XP +${task.xp}  匹配 ${task.matchScore.toFixed(2)}x`, {
      fontSize: '10px', fontFamily: 'monospace', color: '#39ff14',
    }).setOrigin(0.5).setDepth(52);

    // 确认/取消
    const yesBtn = this.add.text(W / 2 - 60, H / 2 + 35, '[ 确认 ]', {
      fontSize: '12px', fontFamily: 'monospace', color: '#39ff14',
    }).setOrigin(0.5).setDepth(52).setInteractive({ useHandCursor: true });

    const noBtn = this.add.text(W / 2 + 60, H / 2 + 35, '[ 取消 ]', {
      fontSize: '12px', fontFamily: 'monospace', color: '#ff4444',
    }).setOrigin(0.5).setDepth(52).setInteractive({ useHandCursor: true });

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
      overlay.destroy(); confirmBox.destroy(); yesBtn.destroy(); noBtn.destroy();
      const waitText = this.add.text(W / 2, H / 2, '上链中...', {
        fontSize: '16px', fontFamily: 'monospace', color: '#ffd700',
      }).setOrigin(0.5).setDepth(52);

      // 监听结果
      const unsub = eventBus.on('task:result', (res: unknown) => {
        const result = res as { success: boolean; txHash?: string; error?: string };
        waitText.destroy();
        if (result.success) {
          this.add.text(W / 2, H / 2, `任务完成! TX: ${result.txHash?.slice(0, 10)}...`, {
            fontSize: '12px', fontFamily: 'monospace', color: '#39ff14',
          }).setOrigin(0.5).setDepth(52);
        } else {
          this.add.text(W / 2, H / 2, `失败: ${result.error}`, {
            fontSize: '12px', fontFamily: 'monospace', color: '#ff4444',
          }).setOrigin(0.5).setDepth(52);
        }
        this.time.delayedCall(2000, () => this.goBack());
        unsub();
      });
    });

    noBtn.on('pointerdown', () => {
      overlay.destroy(); confirmBox.destroy(); yesBtn.destroy(); noBtn.destroy();
      this.selectedIdx = -1;
    });
  }

  private generateTasks(): TaskOption[] {
    // MVP 模板任务（后续替换为 AI 生成或链上数据驱动）
    const templates = [
      { type: 0, title: '废墟探索', desc: '穿越 AXIOM 巡逻区域，回收一批电子元件。危险但回报丰厚。', baseClw: 80, baseXp: 40 },
      { type: 1, title: '密码破译', desc: '截获了一段 AXIOM 加密通信，需要分析并破译其中的指令。', baseClw: 60, baseXp: 45 },
      { type: 2, title: '物资谈判', desc: 'SHELTER-04 的商人带来了稀缺零件，但开价很高。', baseClw: 70, baseXp: 35 },
      { type: 3, title: '终端改装', desc: '一台老旧终端机需要创造性改装，提升避难所的通信能力。', baseClw: 65, baseXp: 40 },
      { type: 4, title: '巡逻守卫', desc: '夜间巡逻，确保避难所入口安全。枯燥但必须坚持。', baseClw: 50, baseXp: 50 },
    ];

    // 随机选 3 个不重复类型
    const shuffled = [...templates].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3).map(t => ({
      type: t.type,
      title: t.title,
      desc: t.desc,
      matchScore: 0.3 + Math.random() * 1.4, // 模拟匹配度
      clw: t.baseClw,
      xp: t.baseXp,
    }));
  }

  private goBack() {
    this.scene.start('ShelterScene', { nfaId: this.nfaId, shelter: this.shelter });
  }
}
