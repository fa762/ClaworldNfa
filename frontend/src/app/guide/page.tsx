import { getGuideChapters } from '@/content/guide';
import { GuideContent } from './GuideContent';
import { BookOpen } from 'lucide-react';

export const metadata = {
  title: '游戏指南 - Claw World',
  description: '龙虾文明宇宙玩家手册',
};

export default function GuidePage() {
  const chapters = getGuideChapters();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-tech-blue/10 flex items-center justify-center">
            <BookOpen size={16} className="text-tech-blue" />
          </div>
          <h1 className="font-heading text-3xl text-mythic-white">游戏指南</h1>
        </div>
        <p className="text-gray-500 text-sm ml-11">龙虾文明宇宙 · 玩家手册</p>
      </div>
      <GuideContent chapters={chapters} />
    </div>
  );
}
