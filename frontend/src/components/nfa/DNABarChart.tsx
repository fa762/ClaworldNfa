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

const GENE_LABELS: Record<string, string> = {
  STR: '力量',
  DEF: '防御',
  SPD: '速度',
  VIT: '生命',
};

export function DNABarChart({ str, def, spd, vit }: DNABarChartProps) {
  const data = [
    { name: 'STR', value: str },
    { name: 'DEF', value: def },
    { name: 'SPD', value: spd },
    { name: 'VIT', value: vit },
  ];

  return (
    <div className="space-y-4">
      <div className="w-full h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 5, right: 15 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fill: '#334155', fontSize: 9 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.04)' }}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
              width={36}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(6,13,26,0.95)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '10px',
                color: '#e2e8f0',
                fontSize: '12px',
                fontFamily: 'JetBrains Mono',
                padding: '8px 12px',
              }}
              formatter={(value, name) => [`${value}`, GENE_LABELS[name as string] || name]}
            />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={14}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={GENE_COLORS[entry.name]} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Stat legend */}
      <div className="grid grid-cols-4 gap-2">
        {data.map((d) => (
          <div key={d.name} className="text-center">
            <div className="text-[10px] text-gray-500 mb-0.5">{GENE_LABELS[d.name]}</div>
            <div className="text-xs font-mono font-bold" style={{ color: GENE_COLORS[d.name] }}>{d.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
