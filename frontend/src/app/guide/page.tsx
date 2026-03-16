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
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1 h-6 rounded-full bg-tech-blue" />
          <h1 className="font-heading text-3xl text-mythic-white">游戏指南</h1>
        </div>
        <p className="text-gray-500 ml-3">龙虾文明宇宙 · 玩家手册</p>
      </div>
      <GuideContent chapters={chapters} />
    </div>
  );
}
