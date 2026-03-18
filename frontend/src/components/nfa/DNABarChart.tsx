import { TerminalBar } from '@/components/terminal/TerminalBar';

interface DNABarChartProps {
  str: number;
  def: number;
  spd: number;
  vit: number;
}

const GENE_COLORS: Record<string, string> = {
  STR: 'term-danger',
  DEF: 'rarity-rare',
  SPD: 'text-crt-green',
  VIT: 'term-warn',
};

export function DNABarChart({ str, def, spd, vit }: DNABarChartProps) {
  const data = [
    { name: 'STR', label: '力量', value: str },
    { name: 'DEF', label: '防御', value: def },
    { name: 'SPD', label: '速度', value: spd },
    { name: 'VIT', label: '生命', value: vit },
  ];

  return (
    <div className="space-y-1">
      {data.map((d) => (
        <TerminalBar
          key={d.name}
          label={d.label}
          value={d.value}
          max={100}
          width={20}
          color={GENE_COLORS[d.name]}
        />
      ))}
    </div>
  );
}
