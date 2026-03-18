interface TerminalBarProps {
  label: string;
  value: number;
  max?: number;
  width?: number;
  color?: string;
}

export function TerminalBar({ label, value, max = 100, width = 20, color }: TerminalBarProps) {
  const filled = Math.round((value / max) * width);
  const empty = width - filled;
  const blocks = '█'.repeat(filled) + '░'.repeat(empty);

  return (
    <div className="flex items-center gap-2 text-[13px]">
      <span className="w-14 shrink-0 term-dim text-right">{label}</span>
      <span className={color || ''}>{blocks.slice(0, filled)}</span>
      <span className="term-darkest">{blocks.slice(filled)}</span>
      <span className="term-bright text-xs w-8 text-right">{value}</span>
    </div>
  );
}
