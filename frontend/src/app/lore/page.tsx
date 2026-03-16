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
      <h1 className="font-heading text-3xl text-mythic-white mb-2">世界观</h1>
      <p className="text-gray-500 mb-8">龙虾世界 · 小说全文</p>
      <LoreContent acts={acts} />
    </div>
  );
}
