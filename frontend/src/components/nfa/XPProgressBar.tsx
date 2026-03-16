import { getXpForLevel, getXpProgress } from '@/lib/xp';

interface XPProgressBarProps {
  level: number;
  xp: number;
}

export function XPProgressBar({ level, xp }: XPProgressBarProps) {
  const progress = getXpProgress(level, xp);
  const required = getXpForLevel(level);

  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-500">XP</span>
        <span className="text-gray-400 font-mono">{xp} / {required}</span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-tech-blue to-abyss-orange rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
