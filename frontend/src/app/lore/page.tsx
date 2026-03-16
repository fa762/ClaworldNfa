import { getLoreActs } from '@/content/lore';
import { LoreContent } from './LoreContent';

export const metadata = {
  title: '世界观 - Claw World',
  description: '龙虾文明宇宙世界观小说',
};

export default function LorePage() {
  const acts = getLoreActs();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1 h-6 rounded-full bg-legend-gold" />
          <h1 className="font-heading text-3xl text-mythic-white">世界观</h1>
        </div>
        <p className="text-gray-500 ml-3">龙虾世界 · 小说全文</p>
      </div>
      <LoreContent acts={acts} />
    </div>
  );
}
