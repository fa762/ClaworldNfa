import * as Phaser from 'phaser';

type MenuOption = {
  label: string;
  description?: string;
  disabled?: boolean;
  onSelect: () => void;
};

type FieldType = 'text' | 'number';

type FormField = {
  name: string;
  label: string;
  type?: FieldType;
  value?: string;
  placeholder?: string;
};

type MenuConfig = {
  title: string;
  subtitle?: string;
  options: MenuOption[];
  cancelLabel?: string;
};

type FormConfig = {
  title: string;
  subtitle?: string;
  fields: FormField[];
  submitLabel?: string;
  cancelLabel?: string;
  onSubmit: (values: Record<string, string>) => void;
};

type ReportSection = {
  title: string;
  lines: string[];
  tone?: 'normal' | 'accent' | 'success' | 'danger';
};

type ReportConfig = {
  title: string;
  subtitle?: string;
  sections: ReportSection[];
  actions?: MenuOption[];
  cancelLabel?: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 游戏内终端面板，统一处理菜单和表单输入
 */
export class TerminalModal {
  private scene: Phaser.Scene;
  private overlay?: Phaser.GameObjects.Rectangle;
  private dom?: Phaser.GameObjects.DOMElement;
  private escHandler: () => void;
  private cleanup: Array<() => void> = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.escHandler = () => {
      if (this.isOpen()) {
        this.close();
      }
    };

    this.scene.input.keyboard?.on('keydown-ESC', this.escHandler);
  }

  isOpen() {
    return Boolean(this.overlay || this.dom);
  }

  showMenu(config: MenuConfig) {
    this.close();

    const W = this.scene.cameras.main.width;
    const H = this.scene.cameras.main.height;

    this.overlay = this.scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.78).setDepth(500);

    const optionsHtml = config.options.map((option, index) => {
      const disabled = option.disabled ? 'disabled' : '';
      return `
        <button data-action="option" data-index="${index}" ${disabled}
          style="width:100%;text-align:left;background:${option.disabled ? '#111111' : '#0f1b10'};border:1px solid rgba(57,255,20,0.28);color:${option.disabled ? 'rgba(57,255,20,0.25)' : '#39ff14'};padding:12px 14px;font:14px monospace;cursor:${option.disabled ? 'not-allowed' : 'pointer'};">
          <div style="font-size:15px;line-height:1.3;">${escapeHtml(option.label)}</div>
          ${option.description ? `<div style="font-size:12px;color:rgba(57,255,20,0.55);margin-top:4px;line-height:1.35;">${escapeHtml(option.description)}</div>` : ''}
        </button>`;
    }).join('');

    const html = `
      <div style="width:min(540px, 82vw); background:rgba(4,7,4,0.98); border:1px solid rgba(57,255,20,0.35); box-shadow:0 0 40px rgba(57,255,20,0.08); color:#39ff14; font-family:monospace; padding:18px;">
        <div style="font-size:20px; margin-bottom:6px; color:#ffffff;">${escapeHtml(config.title)}</div>
        ${config.subtitle ? `<div style="font-size:13px; margin-bottom:14px; color:rgba(57,255,20,0.65); line-height:1.45;">${escapeHtml(config.subtitle)}</div>` : ''}
        <div style="display:flex; flex-direction:column; gap:10px;">${optionsHtml}</div>
        <div style="margin-top:14px; display:flex; justify-content:flex-end; gap:8px; align-items:center;">
          <span style="font-size:12px; color:rgba(57,255,20,0.45); margin-right:auto;">[ESC 关闭]</span>
          <button data-action="cancel" style="background:#1a0a0a;border:1px solid rgba(255,68,68,0.35);color:#ff6666;padding:10px 14px;font:13px monospace;cursor:pointer;">${escapeHtml(config.cancelLabel ?? '取消')}</button>
        </div>
      </div>`;

    this.dom = this.scene.add.dom(W / 2, H / 2).createFromHTML(html).setDepth(501);

    const root = this.dom.node as HTMLDivElement;
    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('button[data-action="option"]'));
    buttons.forEach((button, index) => {
      const option = config.options[index];
      if (!option || option.disabled) return;
      const handler = () => {
        this.close();
        option.onSelect();
      };
      button.addEventListener('click', handler);
      this.cleanup.push(() => button.removeEventListener('click', handler));
    });

    const cancelButton = root.querySelector<HTMLButtonElement>('button[data-action="cancel"]');
    if (cancelButton) {
      const cancelHandler = () => this.close();
      cancelButton.addEventListener('click', cancelHandler);
      this.cleanup.push(() => cancelButton.removeEventListener('click', cancelHandler));
    }
  }

  showForm(config: FormConfig) {
    this.close();

    const W = this.scene.cameras.main.width;
    const H = this.scene.cameras.main.height;

    this.overlay = this.scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.78).setDepth(500);

    const fieldsHtml = config.fields.map((field) => `
      <label style="display:flex;flex-direction:column;gap:6px;">
        <span style="font-size:13px;color:rgba(57,255,20,0.72);">${escapeHtml(field.label)}</span>
        <input
          data-field="${escapeHtml(field.name)}"
          type="${field.type ?? 'text'}"
          value="${escapeHtml(field.value ?? '')}"
          placeholder="${escapeHtml(field.placeholder ?? '')}"
          style="background:#060b06;border:1px solid rgba(57,255,20,0.28);color:#ffffff;padding:10px 12px;font:15px monospace;outline:none;"
        />
      </label>
    `).join('');

    const html = `
      <form style="width:min(520px, 82vw); background:rgba(4,7,4,0.98); border:1px solid rgba(57,255,20,0.35); box-shadow:0 0 40px rgba(57,255,20,0.08); color:#39ff14; font-family:monospace; padding:18px; display:flex; flex-direction:column; gap:14px;">
        <div>
          <div style="font-size:20px; margin-bottom:6px; color:#ffffff;">${escapeHtml(config.title)}</div>
          ${config.subtitle ? `<div style="font-size:13px; color:rgba(57,255,20,0.65); line-height:1.45;">${escapeHtml(config.subtitle)}</div>` : ''}
        </div>
        ${fieldsHtml}
        <div style="display:flex; justify-content:flex-end; gap:8px; align-items:center;">
          <span style="font-size:12px; color:rgba(57,255,20,0.45); margin-right:auto;">[ENTER 提交]  ·  [ESC 关闭]</span>
          <button type="button" data-action="cancel" style="background:#1a0a0a;border:1px solid rgba(255,68,68,0.35);color:#ff6666;padding:10px 14px;font:13px monospace;cursor:pointer;">${escapeHtml(config.cancelLabel ?? '取消')}</button>
          <button type="submit" style="background:#0f1b10;border:1px solid rgba(57,255,20,0.35);color:#39ff14;padding:10px 14px;font:13px monospace;cursor:pointer;">${escapeHtml(config.submitLabel ?? '确认')}</button>
        </div>
      </form>`;

    this.dom = this.scene.add.dom(W / 2, H / 2).createFromHTML(html).setDepth(501);

    const root = this.dom.node as HTMLFormElement;
    const submitHandler = (event: Event) => {
      event.preventDefault();
      const values: Record<string, string> = {};
      for (const field of config.fields) {
        const input = root.querySelector<HTMLInputElement>(`input[data-field="${field.name}"]`);
        values[field.name] = input?.value.trim() ?? '';
      }
      this.close();
      config.onSubmit(values);
    };
    root.addEventListener('submit', submitHandler);
    this.cleanup.push(() => root.removeEventListener('submit', submitHandler));

    const cancelButton = root.querySelector<HTMLButtonElement>('button[data-action="cancel"]');
    if (cancelButton) {
      const cancelHandler = () => this.close();
      cancelButton.addEventListener('click', cancelHandler);
      this.cleanup.push(() => cancelButton.removeEventListener('click', cancelHandler));
    }

    const firstInput = root.querySelector<HTMLInputElement>('input');
    if (firstInput) {
      window.setTimeout(() => firstInput.focus(), 0);
    }
  }

  showReport(config: ReportConfig) {
    this.close();

    const W = this.scene.cameras.main.width;
    const H = this.scene.cameras.main.height;

    this.overlay = this.scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.78).setDepth(500);

    const toneBorder = (tone?: ReportSection['tone']) => {
      if (tone === 'success') return 'rgba(57,255,20,0.35)';
      if (tone === 'danger') return 'rgba(255,102,102,0.35)';
      if (tone === 'accent') return 'rgba(122,215,255,0.35)';
      return 'rgba(57,255,20,0.18)';
    };

    const toneTitle = (tone?: ReportSection['tone']) => {
      if (tone === 'success') return '#39ff14';
      if (tone === 'danger') return '#ff8080';
      if (tone === 'accent') return '#7ad7ff';
      return '#ffffff';
    };

    const sectionsHtml = config.sections.map((section) => `
      <section style="border:1px solid ${toneBorder(section.tone)}; background:rgba(9,14,9,0.88); padding:10px 12px;">
        <div style="font-size:13px; color:${toneTitle(section.tone)}; margin-bottom:6px; letter-spacing:0.04em;">${escapeHtml(section.title)}</div>
        <div style="display:flex; flex-direction:column; gap:4px;">
          ${section.lines.map((line) => `<div style="font-size:11px; color:rgba(255,255,255,0.82); line-height:1.42; word-break:break-word;">${escapeHtml(line)}</div>`).join('')}
        </div>
      </section>
    `).join('');

    const actions = config.actions ?? [];
    const actionsHtml = actions.map((option, index) => {
      const disabled = option.disabled ? 'disabled' : '';
      return `
        <button data-action="report-option" data-index="${index}" ${disabled}
          style="min-width:120px;text-align:left;background:${option.disabled ? '#111111' : '#0f1b10'};border:1px solid rgba(57,255,20,0.28);color:${option.disabled ? 'rgba(57,255,20,0.25)' : '#39ff14'};padding:9px 10px;font:12px monospace;cursor:${option.disabled ? 'not-allowed' : 'pointer'};">
          <div style="font-size:12px;line-height:1.25;">${escapeHtml(option.label)}</div>
          ${option.description ? `<div style="font-size:10px;color:rgba(57,255,20,0.55);margin-top:3px;line-height:1.32;">${escapeHtml(option.description)}</div>` : ''}
        </button>`;
    }).join('');

    const html = `
      <div style="width:min(760px, 92vw); max-height:min(84vh, 860px); background:rgba(4,7,4,0.98); border:1px solid rgba(57,255,20,0.35); box-shadow:0 0 40px rgba(57,255,20,0.08); color:#39ff14; font-family:monospace; padding:16px; display:flex; flex-direction:column; overflow:hidden;">
        <div style="font-size:22px; line-height:1.15; margin-bottom:6px; color:#ffffff;">${escapeHtml(config.title)}</div>
        ${config.subtitle ? `<div style="font-size:12px; margin-bottom:12px; color:rgba(57,255,20,0.65); line-height:1.42; word-break:break-word;">${escapeHtml(config.subtitle)}</div>` : ''}
        <div style="display:flex; flex-direction:column; gap:10px; overflow:auto; max-height:min(62vh, 620px); padding-right:4px;">${sectionsHtml}</div>
        <div style="margin-top:12px; display:flex; flex-wrap:wrap; gap:8px; align-items:flex-start; flex-shrink:0;">
          <span style="font-size:12px; color:rgba(57,255,20,0.45); margin-right:auto;">[ESC 关闭]</span>
          ${actionsHtml}
          <button data-action="cancel" style="background:#1a0a0a;border:1px solid rgba(255,68,68,0.35);color:#ff6666;padding:9px 12px;font:12px monospace;cursor:pointer;">${escapeHtml(config.cancelLabel ?? '关闭')}</button>
        </div>
      </div>`;

    this.dom = this.scene.add.dom(W / 2, H / 2).createFromHTML(html).setDepth(501);

    const root = this.dom.node as HTMLDivElement;
    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('button[data-action="report-option"]'));
    buttons.forEach((button, index) => {
      const option = actions[index];
      if (!option || option.disabled) return;
      const handler = () => {
        this.close();
        option.onSelect();
      };
      button.addEventListener('click', handler);
      this.cleanup.push(() => button.removeEventListener('click', handler));
    });

    const cancelButton = root.querySelector<HTMLButtonElement>('button[data-action="cancel"]');
    if (cancelButton) {
      const cancelHandler = () => this.close();
      cancelButton.addEventListener('click', cancelHandler);
      this.cleanup.push(() => cancelButton.removeEventListener('click', cancelHandler));
    }
  }

  close() {
    this.cleanup.forEach((cleanup) => cleanup());
    this.cleanup = [];
    this.dom?.destroy();
    this.overlay?.destroy();
    this.dom = undefined;
    this.overlay = undefined;
  }

  destroy() {
    this.close();
    this.scene.input.keyboard?.off('keydown-ESC', this.escHandler);
  }
}
