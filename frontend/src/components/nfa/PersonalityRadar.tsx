'use client';

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

interface PersonalityRadarProps {
  courage: number;
  wisdom: number;
  social: number;
  create: number;
  grit: number;
}

export function PersonalityRadar({ courage, wisdom, social, create, grit }: PersonalityRadarProps) {
  const data = [
    { subject: '勇气', value: courage, fullMark: 100 },
    { subject: '智慧', value: wisdom, fullMark: 100 },
    { subject: '社交', value: social, fullMark: 100 },
    { subject: '创造', value: create, fullMark: 100 },
    { subject: '韧性', value: grit, fullMark: 100 },
  ];

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="72%">
          <PolarGrid stroke="rgba(255,255,255,0.06)" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'Space Grotesk' }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: '#334155', fontSize: 9 }}
            axisLine={false}
          />
          <Radar
            name="性格"
            dataKey="value"
            stroke="#E8734A"
            strokeWidth={2}
            fill="url(#radarGradient)"
            fillOpacity={0.4}
            dot={{ r: 3, fill: '#E8734A', stroke: '#E8734A', strokeWidth: 1 }}
          />
          <defs>
            <radialGradient id="radarGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#E8734A" stopOpacity={0.6} />
              <stop offset="100%" stopColor="#E8734A" stopOpacity={0.1} />
            </radialGradient>
          </defs>
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(6,13,26,0.95)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '10px',
              color: '#e2e8f0',
              fontSize: '12px',
              fontFamily: 'JetBrains Mono',
              backdropFilter: 'blur(8px)',
              padding: '8px 12px',
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
