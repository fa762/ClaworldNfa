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
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="75%">
          <PolarGrid stroke="#1e293b" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: '#475569', fontSize: 10 }}
          />
          <Radar
            name="性格"
            dataKey="value"
            stroke="#E8734A"
            fill="#E8734A"
            fillOpacity={0.3}
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
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
