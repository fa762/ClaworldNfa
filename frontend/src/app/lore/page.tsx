import { PageTitle } from '@/components/layout/PageTitle';
import { LoreContent } from './LoreContent';

export const metadata = {
  title: 'AI Agent - CLAW WORLD TERMINAL',
  description: 'AI agent workspace for Task, PK, and Battle Royale autonomy.',
};

export default function LorePage() {
  return (
    <div className="flex flex-col h-full">
      <PageTitle textKey="lore.title" />
      <LoreContent />
    </div>
  );
}
