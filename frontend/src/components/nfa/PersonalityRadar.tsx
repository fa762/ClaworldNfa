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
    <div className="w-full h-56">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="72%">
          <PolarGrid stroke="rgba(51,255,102,0.1)" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: '#1a6b2d', fontSize: 11, fontFamily: 'JetBrains Mono' }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: '#0f3d1a', fontSize: 9 }}
            axisLine={false}
          />
          <Radar
            name="性格"
            dataKey="value"
            stroke="#33FF66"
            strokeWidth={2}
            fill="#33FF66"
            fillOpacity={0.15}
            dot={{ r: 3, fill: '#33FF66', stroke: '#33FF66', strokeWidth: 1 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0a0a0a',
              border: '1px solid #1a6b2d',
              borderRadius: 0,
              color: '#33FF66',
              fontSize: '12px',
              fontFamily: 'JetBrains Mono',
              padding: '6px 10px',
              textShadow: '0 0 6px rgba(51,255,102,0.6)',
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
