'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Cell,
} from 'recharts';

interface DNABarChartProps {
  str: number;
  def: number;
  spd: number;
  vit: number;
}

const GENE_COLORS: Record<string, string> = {
  STR: '#EF4444',
  DEF: '#3B82F6',
  SPD: '#22C55E',
  VIT: '#F59E0B',
};

export function DNABarChart({ str, def, spd, vit }: DNABarChartProps) {
  const data = [
    { name: 'STR', value: str },
    { name: 'DEF', value: def },
    { name: 'SPD', value: spd },
    { name: 'VIT', value: vit },
  ];

  return (
    <div className="w-full h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tick={{ fill: '#475569', fontSize: 10 }} />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: '#94a3b8', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}
            width={40}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#060D1A',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: '#e2e8f0',
              fontSize: '12px',
            }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={GENE_COLORS[entry.name]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
