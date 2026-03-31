import * as Phaser from 'phaser';

interface DialogueLine {
  speaker: string;
  text: string;
  color?: string;
}

interface DialogueChoice {
  label: string;
  callback: () => void;
}

/**
 * DialogueBox — 通用 NPC 对话框 UI
 * 支持：逐字显示、多行对话、选择分支
 */
export class DialogueBox {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Rectangle;
  private speakerText: Phaser.GameObjects.Text;
  private bodyText: Phaser.GameObjects.Text;
  private promptText: Phaser.GameObjects.Text;
  private choiceTexts: Phaser.GameObjects.Text[] = [];
  private lines: DialogueLine[] = [];
  private lineIdx = 0;
  private typing = false;
  private typingTimer?: Phaser.Time.TimerEvent;
  private onComplete?: () => void;
  private readonly W: number;
  private readonly H: number;
  private readonly BOX_H = 200;
  private readonly PADDING = 24;
  private readonly pointerHandler: () => void;
  private readonly spaceHandler: () => void;
  private choiceKeyCleanups: Array<() => void> = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.W = scene.cameras.main.width;
    this.H = scene.cameras.main.height;

    const boxY = this.H - this.BOX_H;

    this.container = scene.add.container(0, 0).setDepth(200);

    // 半透明背景
    this.bg = scene.add.rectangle(this.W / 2, boxY + this.BOX_H / 2, this.W - 28, this.BOX_H, 0x0a0a1a, 0.94);
    this.bg.setStrokeStyle(1, 0x39ff14, 0.5);

    // 说话者名字
    this.speakerText = scene.add.text(this.PADDING + 10, boxY + 14, '', {
      fontSize: '20px', fontFamily: 'monospace', color: '#ffd700',
    });

    // 正文
    this.bodyText = scene.add.text(this.PADDING + 10, boxY + 46, '', {
      fontSize: '17px', fontFamily: 'monospace', color: '#cccccc',
      wordWrap: { width: this.W - 80 }, lineSpacing: 8,
    });

    // 继续提示
    this.promptText = scene.add.text(this.W - 32, boxY + this.BOX_H - 20, '▼', {
      fontSize: '16px', fontFamily: 'monospace', color: '#39ff14',
    }).setOrigin(0.5).setAlpha(0);

    // 闪烁动画
    scene.tweens.add({
      targets: this.promptText,
      alpha: { from: 0.3, to: 1 },
      duration: 500,
      yoyo: true,
      repeat: -1,
    });

    this.container.add([this.bg, this.speakerText, this.bodyText, this.promptText]);
    this.container.setVisible(false);

    // 点击/空格推进对话
    this.pointerHandler = () => this.advance();
    this.spaceHandler = () => this.advance();

    scene.input.on('pointerdown', this.pointerHandler);
    scene.input.keyboard?.on('keydown-SPACE', this.spaceHandler);
  }

  /**
   * 显示一段对话
   */
  show(lines: DialogueLine[], onComplete?: () => void) {
    this.lines = lines;
    this.lineIdx = 0;
    this.onComplete = onComplete;
    this.container.setVisible(true);
    this.choiceTexts.forEach(t => t.destroy());
    this.choiceTexts = [];
    this.showLine();
  }

  /**
   * 显示选择分支
   */
  showChoices(choices: DialogueChoice[]) {
    this.clearChoiceKeyBindings();
    this.choiceTexts.forEach(t => t.destroy());
    this.choiceTexts = [];

    const boxY = this.H - this.BOX_H;
    choices.forEach((choice, i) => {
      const y = boxY + 68 + i * 36;
      const text = this.scene.add.text(this.PADDING + 20, y, `[${i + 1}] ${choice.label}`, {
        fontSize: '17px', fontFamily: 'monospace', color: '#39ff14',
      }).setInteractive({ useHandCursor: true }).setDepth(201);

      text.on('pointerover', () => text.setColor('#ffffff'));
      text.on('pointerout', () => text.setColor('#39ff14'));
      text.on('pointerdown', () => {
        this.hide();
        choice.callback();
      });

      // 键盘快捷键
      const keyName = `keydown-${['ONE', 'TWO', 'THREE', 'FOUR'][i]}`;
      const keyHandler = () => {
        this.hide();
        choice.callback();
      };
      this.scene.input.keyboard?.on(keyName, keyHandler);
      this.choiceKeyCleanups.push(() => this.scene.input.keyboard?.off(keyName, keyHandler));

      this.choiceTexts.push(text);
      this.container.add(text);
    });

    this.promptText.setAlpha(0);
  }

  hide() {
    this.container.setVisible(false);
    this.choiceTexts.forEach(t => t.destroy());
    this.choiceTexts = [];
    if (this.typingTimer) this.typingTimer.destroy();
    this.clearChoiceKeyBindings();
  }

  isVisible() {
    return this.container.visible;
  }

  private showLine() {
    if (this.lineIdx >= this.lines.length) {
      this.hide();
      this.onComplete?.();
      return;
    }

    const line = this.lines[this.lineIdx];
    this.speakerText.setText(line.speaker);
    if (line.color) this.speakerText.setColor(line.color);
    this.bodyText.setText('');
    this.promptText.setAlpha(0);

    // 逐字打印效果
    this.typing = true;
    let charIdx = 0;
    if (this.typingTimer) this.typingTimer.destroy();

    this.typingTimer = this.scene.time.addEvent({
      delay: 30,
      repeat: line.text.length - 1,
      callback: () => {
        charIdx++;
        this.bodyText.setText(line.text.substring(0, charIdx));
        if (charIdx >= line.text.length) {
          this.typing = false;
          this.promptText.setAlpha(1);
        }
      },
    });
  }

  private advance() {
    if (!this.container.visible) return;
    if (this.choiceTexts.length > 0) return; // 等待选择

    if (this.typing) {
      // 跳过打字动画
      if (this.typingTimer) this.typingTimer.destroy();
      const line = this.lines[this.lineIdx];
      this.bodyText.setText(line.text);
      this.typing = false;
      this.promptText.setAlpha(1);
    } else {
      this.lineIdx++;
      this.showLine();
    }
  }

  destroy() {
    this.clearChoiceKeyBindings();
    this.scene.input.off('pointerdown', this.pointerHandler);
    this.scene.input.keyboard?.off('keydown-SPACE', this.spaceHandler);
    this.container.destroy(true);
  }

  private clearChoiceKeyBindings() {
    this.choiceKeyCleanups.forEach((cleanup) => cleanup());
    this.choiceKeyCleanups = [];
  }
}
