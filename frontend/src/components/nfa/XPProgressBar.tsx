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
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-gray-500">经验值</span>
        <span className="text-gray-400 font-mono text-[11px]">{xp} / {required} XP</span>
      </div>
      <div className="h-2.5 bg-white/[0.04] rounded-full overflow-hidden relative">
        <div
          className="h-full bg-gradient-to-r from-tech-blue via-abyss-orange to-abyss-orange-light rounded-full animate-bar-fill relative"
          style={{ width: `${progress}%` }}
        >
          {/* Shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
        </div>
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-gray-600">Lv.{level}</span>
        <span className="text-[10px] text-gray-600">Lv.{level + 1}</span>
      </div>
    </div>
  );
}
