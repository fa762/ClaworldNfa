import { getXpForLevel, getXpProgress } from '@/lib/xp';

interface XPProgressBarProps {
  level: number;
  xp: number;
}

export function XPProgressBar({ level, xp }: XPProgressBarProps) {
  const progress = getXpProgress(level, xp);
  const required = getXpForLevel(level);
  const width = 20;
  const filled = Math.round((progress / 100) * width);

  return (
    <div className="text-xs">
      <span className="term-dim">XP </span>
      <span className="text-crt-green">{'█'.repeat(filled)}</span>
      <span className="term-darkest">{'░'.repeat(width - filled)}</span>
      <span className="term-dim ml-2">{xp}/{required}</span>
      <span className="term-darkest ml-1">({progress}%)</span>
    </div>
  );
}
