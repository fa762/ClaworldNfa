import { getLoreActs } from '@/content/lore';
import { LoreContent } from './LoreContent';
import { PageTitle } from '@/components/layout/PageTitle';

export const metadata = {
  title: '世界观 — CLAW WORLD TERMINAL',
  description: '龙虾文明宇宙世界观小说',
};

export default function LorePage() {
  const acts = getLoreActs();

  return (
    <div className="flex flex-col h-full">
      <PageTitle textKey="lore.title" />
      <LoreContent acts={acts} />
    </div>
  );
}
