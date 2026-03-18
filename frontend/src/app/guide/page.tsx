import { getGuideChapters } from '@/content/guide';
import { GuideContent } from './GuideContent';

export const metadata = {
  title: '游戏指南 — CLAW WORLD TERMINAL',
  description: '龙虾文明宇宙玩家手册',
};

export default function GuidePage() {
  const chapters = getGuideChapters();

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-4">
        <span className="term-dim text-sm">&gt; </span>
        <span className="term-bright text-sm">文档: 游戏指南</span>
        <span className="term-dim text-xs ml-2">— 玩家手册</span>
      </div>
      <div className="term-line mb-4" />
      <GuideContent chapters={chapters} />
    </div>
  );
}
