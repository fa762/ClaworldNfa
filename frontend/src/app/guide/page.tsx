import { getGuideChapters } from '@/content/guide';
import { GuideContent } from './GuideContent';

export const metadata = {
  title: '游戏指南 - Claw World',
  description: '龙虾文明宇宙玩家手册',
};

export default function GuidePage() {
  const chapters = getGuideChapters();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="font-heading text-3xl text-mythic-white mb-2">游戏指南</h1>
      <p className="text-gray-500 mb-8">龙虾文明宇宙 · 玩家手册</p>
      <GuideContent chapters={chapters} />
    </div>
  );
}
