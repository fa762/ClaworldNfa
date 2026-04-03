import * as Phaser from 'phaser';

interface DialogueLine {
  speaker: string;
  text: string;
  color?: string;
  portraitKey?: string;
}

interface DialogueChoice {
  label: string;
  callback: () => void;
}

type GameLang = 'zh' | 'en';

/**
 * DialogueBox — 通用 NPC 对话框 UI
 * 支持：逐字显示、多行对话、选择分支
 */
export class DialogueBox {
  private readonly DEPTH = 2000;
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Rectangle;
  private speakerText: Phaser.GameObjects.Text;
  private bodyText: Phaser.GameObjects.Text;
  private promptText: Phaser.GameObjects.Text;
  private hintText: Phaser.GameObjects.Text;
  private portraitFrame: Phaser.GameObjects.Rectangle;
  private portraitImage: Phaser.GameObjects.Image;
  private choiceTexts: Phaser.GameObjects.Text[] = [];
  private lines: DialogueLine[] = [];
  private lineIdx = 0;
  private typing = false;
  private typingTimer?: Phaser.Time.TimerEvent;
  private onComplete?: () => void;
  private readonly W: number;
  private readonly H: number;
  private readonly isCompact: boolean;
  private readonly BOX_H: number;
  private readonly PADDING: number;
  private readonly bodyWidth: number;
  private readonly bodyHeight: number;
  private readonly bodyX: number;
  private readonly portraitX: number;
  private readonly portraitY: number;
  private readonly portraitFrameWidth: number;
  private readonly portraitFrameHeight: number;
  private readonly pointerHandler: (pointer: Phaser.Input.Pointer) => void;
  private readonly spaceHandler: () => void;
  private readonly escHandler: () => void;
  private choiceKeyCleanups: Array<() => void> = [];
  private lang: GameLang;

  constructor(scene: Phaser.Scene, lang: GameLang = 'zh') {
    this.scene = scene;
    this.lang = lang;
    this.W = scene.cameras.main.width;
    this.H = scene.cameras.main.height;
    this.isCompact = this.W < 820 || this.H < 640;
    this.BOX_H = this.isCompact ? Math.min(320, Math.max(248, Math.floor(this.H * 0.38))) : 264;
    this.PADDING = this.isCompact ? 16 : 24;
    this.portraitFrameWidth = this.isCompact ? 88 : 124;
    this.portraitFrameHeight = this.isCompact ? 74 : 96;
    this.portraitX = this.PADDING + this.portraitFrameWidth / 2;
    this.portraitY = this.H - this.BOX_H + (this.isCompact ? 62 : 78);
    this.bodyX = this.isCompact ? this.PADDING : this.PADDING + 146;
    this.bodyWidth = this.isCompact ? this.W - this.PADDING * 2 : this.W - 230;
    this.bodyHeight = this.isCompact ? 132 : 92;

    const boxY = this.H - this.BOX_H;

    this.container = scene.add.container(0, 0).setDepth(this.DEPTH).setScrollFactor(0);

    this.bg = scene.add.rectangle(this.W / 2, boxY + this.BOX_H / 2, this.W - (this.isCompact ? 16 : 28), this.BOX_H, 0x0a0a1a, 0.96);
    this.bg.setStrokeStyle(1, 0x39ff14, 0.5).setScrollFactor(0);

    this.portraitFrame = scene.add.rectangle(this.portraitX, this.portraitY, this.portraitFrameWidth, this.portraitFrameHeight, 0x111418, 0.92)
      .setStrokeStyle(1, 0x39ff14, 0.28)
      .setVisible(false)
      .setScrollFactor(0);
    this.portraitImage = scene.add.image(this.portraitX, this.portraitY, 'player')
      .setOrigin(0.5)
      .setVisible(false)
      .setScrollFactor(0);

    this.speakerText = scene.add.text(this.bodyX, boxY + 14, '', {
      fontSize: this.isCompact ? '18px' : '20px', fontFamily: 'monospace', color: '#ffd700',
    }).setScrollFactor(0);

    this.bodyText = scene.add.text(this.bodyX, boxY + (this.isCompact ? 42 : 44), '', {
      fontSize: this.isCompact ? '15px' : '17px', fontFamily: 'monospace', color: '#cccccc',
      wordWrap: { width: this.bodyWidth, useAdvancedWrap: true }, lineSpacing: this.isCompact ? 6 : 8,
    }).setScrollFactor(0);
    this.bodyText.setFixedSize(this.bodyWidth, this.bodyHeight);

    this.promptText = scene.add.text(this.W - 32, boxY + this.BOX_H - 20, '▼', {
      fontSize: '16px', fontFamily: 'monospace', color: '#39ff14',
    }).setOrigin(0.5).setAlpha(0).setScrollFactor(0);

    this.hintText = scene.add.text(this.PADDING, boxY + this.BOX_H - 22, '', {
      fontSize: this.isCompact ? '12px' : '13px', fontFamily: 'monospace', color: '#39ff14',
      wordWrap: { width: this.W - this.PADDING * 2, useAdvancedWrap: true },
    }).setAlpha(0).setScrollFactor(0);

    // 闪烁动画
    scene.tweens.add({
      targets: this.promptText,
      alpha: { from: 0.3, to: 1 },
      duration: 500,
      yoyo: true,
      repeat: -1,
    });

    this.container.add([this.bg, this.portraitFrame, this.portraitImage, this.speakerText, this.bodyText, this.promptText, this.hintText]);
    this.container.setVisible(false);

    // 点击/空格推进对话，ESC 直接关闭
    this.pointerHandler = (pointer: Phaser.Input.Pointer) => {
      if (!this.container.visible) return;
      if (this.isChoicePointer(pointer)) return;
      if (this.isPointerInsideBox(pointer)) {
        this.advance();
        return;
      }
      this.hide();
    };
    this.spaceHandler = () => this.advance();
    this.escHandler = () => { if (this.container.visible) this.hide(); };

    scene.input.on('pointerdown', this.pointerHandler);
    scene.input.keyboard?.on('keydown-SPACE', this.spaceHandler);
    scene.input.keyboard?.on('keydown-ESC', this.escHandler);
  }

  /**
   * 显示一段对话
   */
  show(lines: DialogueLine[], onComplete?: () => void) {
    this.lines = this.paginateLines(lines);
    this.lineIdx = 0;
    this.onComplete = onComplete;
    this.container.setVisible(true);
    this.choiceTexts.forEach(t => t.destroy());
    this.choiceTexts = [];
    this.hintText.setAlpha(0);
    this.showLine();
  }

  /**
   * 显示选择分支
   */
  showChoices(choices: DialogueChoice[]) {
    this.clearChoiceKeyBindings();
    this.choiceTexts.forEach(t => t.destroy());
    this.choiceTexts = [];
    this.container.setVisible(true);
    this.promptText.setAlpha(0);
    this.hintText.setAlpha(0);

    const boxY = this.H - this.BOX_H;
    const baseY = this.isCompact ? boxY + 136 : boxY + 124;
    const spacing = this.isCompact ? 34 : 22;
    choices.forEach((choice, i) => {
      const y = baseY + i * spacing;
      const text = this.scene.add.text(this.PADDING + 20, y, `[${i + 1}] ${choice.label}`, {
        fontSize: this.isCompact ? '15px' : '14px', fontFamily: 'monospace', color: '#39ff14',
        wordWrap: { width: this.W - 64, useAdvancedWrap: true },
      }).setInteractive({ useHandCursor: true }).setDepth(this.DEPTH + 1).setScrollFactor(0);

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
    this.hintText.setText(this.lang === 'zh' ? `[1-${choices.length}] 选择  ·  ESC 关闭` : `[1-${choices.length}] Select  ·  ESC Close`).setAlpha(0.7);
  }

  hide() {
    this.container.setVisible(false);
    this.choiceTexts.forEach(t => t.destroy());
    this.choiceTexts = [];
    if (this.typingTimer) this.typingTimer.destroy();
    this.clearChoiceKeyBindings();
    this.hintText.setAlpha(0);
    this.promptText.setAlpha(0);
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
    if (line.portraitKey && this.scene.textures.exists(line.portraitKey) && !this.isCompact) {
      this.portraitImage.setTexture(line.portraitKey);
      const frame = this.scene.textures.get(line.portraitKey).getSourceImage() as { width: number; height: number };
      const maxW = 112;
      const maxH = 86;
      const scale = Math.min(maxW / frame.width, maxH / frame.height);
      this.portraitImage.setDisplaySize(frame.width * scale, frame.height * scale).setVisible(true);
      this.portraitFrame.setVisible(true);
    } else {
      this.portraitImage.setVisible(false);
      this.portraitFrame.setVisible(false);
    }
    this.bodyText.setText('');
    this.promptText.setAlpha(0);
    this.hintText.setAlpha(0);

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
          this.hintText.setText(this.lang === 'zh' ? '[SPACE/点击继续]  ·  [ESC 关闭]' : '[SPACE/Click Next]  ·  [ESC Close]').setAlpha(0.7);
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
      this.hintText.setText(this.lang === 'zh' ? '[SPACE/点击继续]  ·  [ESC 关闭]' : '[SPACE/Click Next]  ·  [ESC Close]').setAlpha(0.7);
    } else {
      this.lineIdx++;
      this.showLine();
    }
  }

  destroy() {
    this.clearChoiceKeyBindings();
    this.scene.input.off('pointerdown', this.pointerHandler);
    this.scene.input.keyboard?.off('keydown-SPACE', this.spaceHandler);
    this.scene.input.keyboard?.off('keydown-ESC', this.escHandler);
    this.container.destroy(true);
  }

  private clearChoiceKeyBindings() {
    this.choiceKeyCleanups.forEach((cleanup) => cleanup());
    this.choiceKeyCleanups = [];
  }

  private isPointerInsideBox(pointer: Phaser.Input.Pointer) {
    const boxTop = this.H - this.BOX_H;
    const boxLeft = (this.W - this.bg.width) / 2;
    const boxRight = boxLeft + this.bg.width;
    const boxBottom = boxTop + this.BOX_H;

    return pointer.x >= boxLeft && pointer.x <= boxRight && pointer.y >= boxTop && pointer.y <= boxBottom;
  }

  private isChoicePointer(pointer: Phaser.Input.Pointer) {
    return this.choiceTexts.some((choice) => choice.getBounds().contains(pointer.x, pointer.y));
  }

  private paginateLines(lines: DialogueLine[]) {
    const maxChars = this.isCompact ? 88 : 140;
    const paginated: DialogueLine[] = [];

    lines.forEach((line) => {
      if (line.text.length <= maxChars) {
        paginated.push(line);
        return;
      }

      const chunks = line.text.match(new RegExp(`.{1,${maxChars}}`, 'g')) ?? [line.text];
      chunks.forEach((chunk, index) => {
        paginated.push({
          ...line,
          text: chunk,
          speaker: chunks.length > 1 ? `${line.speaker} ${index + 1}/${chunks.length}` : line.speaker,
        });
      });
    });

    return paginated;
  }
}
