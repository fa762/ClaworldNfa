import { getLoreActs } from '@/content/lore';
import { LoreContent } from './LoreContent';

export const metadata = {
  title: '世界观 — CLAW WORLD TERMINAL',
  description: '龙虾文明宇宙世界观小说',
};

export default function LorePage() {
  const acts = getLoreActs();

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-4">
        <span className="term-dim text-sm">&gt; </span>
        <span className="term-bright text-sm">数据库: 龙虾世界</span>
        <span className="term-dim text-xs ml-2">— 小说全文</span>
      </div>
      <div className="term-line mb-4" />
      <LoreContent acts={acts} />
    </div>
  );
}
