import { getLoreActs } from '@/content/lore';
import { LoreContent } from './LoreContent';
import { BookText } from 'lucide-react';

export const metadata = {
  title: '世界观 - Claw World',
  description: '龙虾文明宇宙世界观小说',
};

export default function LorePage() {
  const acts = getLoreActs();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-legend-gold/10 flex items-center justify-center">
            <BookText size={16} className="text-legend-gold" />
          </div>
          <h1 className="font-heading text-3xl text-mythic-white">世界观</h1>
        </div>
        <p className="text-gray-500 text-sm ml-11">龙虾世界 · 小说全文</p>
      </div>
      <LoreContent acts={acts} />
    </div>
  );
}
