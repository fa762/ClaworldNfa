interface TerminalBarProps {
  label: string;
  sublabel?: string;
  value: number;
  max?: number;
  width?: number;
  color?: string;
}

export function TerminalBar({ label, sublabel, value, max = 100, width = 20, color }: TerminalBarProps) {
  const filled = Math.round((value / max) * width);
  const empty = width - filled;

  return (
    <div className="flex items-center gap-2 text-[13px] font-mono">
      <span className="w-8 shrink-0 term-bright text-right text-xs">{label}</span>
      {sublabel && <span className="w-10 shrink-0 term-dim text-xs">{sublabel}</span>}
      <span className="shrink-0" style={{ width: `${width}ch` }}>
        <span className={color || ''}>{'█'.repeat(filled)}</span>
        <span className="term-darkest">{'░'.repeat(empty)}</span>
      </span>
      <span className="term-bright text-xs w-8 text-right shrink-0">{value}</span>
    </div>
  );
}
