interface TerminalBarProps {
  label: string;
  sublabel?: string;
  value: number;
  max?: number;
  color?: string;
}

export function TerminalBar({ label, sublabel, value, max = 100, color }: TerminalBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className="flex items-center gap-2 text-[13px] font-mono">
      <span className="w-8 shrink-0 term-bright text-right text-xs">{label}</span>
      {sublabel && <span className="w-10 shrink-0 term-dim text-xs">{sublabel}</span>}
      <div className="flex-1 h-3 bg-[#0a1a0a] border border-[#1a3a1a] relative overflow-hidden">
        <div
          className={`h-full ${color || 'bg-crt-green'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="term-bright text-xs w-8 text-right shrink-0">{value}</span>
    </div>
  );
}
