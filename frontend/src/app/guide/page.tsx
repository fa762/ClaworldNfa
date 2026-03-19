import { getGuideChapters } from '@/content/guide';
import { GuideContent } from './GuideContent';

export const metadata = {
  title: '游戏指南 — CLAW WORLD TERMINAL',
  description: '龙虾文明宇宙玩家手册',
};

export default function GuidePage() {
  const chapters = getGuideChapters();

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-3 pb-1 shrink-0">
        <span className="term-dim text-xs">&gt; </span>
        <span className="term-bright text-xs">文档: 游戏指南</span>
      </div>
      <GuideContent chapters={chapters} />
    </div>
  );
}
