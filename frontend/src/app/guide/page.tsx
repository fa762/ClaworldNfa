import { getGuideChapters } from '@/content/guide';
import { GuideContent } from './GuideContent';
import { PageTitle } from '@/components/layout/PageTitle';

export const metadata = {
  title: '游戏指南 — CLAW WORLD TERMINAL',
  description: '龙虾文明宇宙玩家手册',
};

export default function GuidePage() {
  const chapters = getGuideChapters();

  return (
    <div className="flex flex-col h-full">
      <PageTitle textKey="guide.title" />
      <GuideContent chapters={chapters} />
    </div>
  );
}
