import { getLoreActs } from '@/content/lore';
import { LoreContent } from './LoreContent';

export const metadata = {
  title: '世界观 — CLAW WORLD TERMINAL',
  description: '龙虾文明宇宙世界观小说',
};

export default function LorePage() {
  const acts = getLoreActs();

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-3 pb-1 shrink-0">
        <span className="term-dim text-xs">&gt; </span>
        <span className="term-bright text-xs">数据库: 龙虾世界</span>
      </div>
      <LoreContent acts={acts} />
    </div>
  );
}
