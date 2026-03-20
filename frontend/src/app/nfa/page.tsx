import { LobsterGrid } from '@/components/nfa/LobsterGrid';
import { NFAPageTitle } from '@/components/layout/PageTitle';

export const metadata = {
  title: 'NFA 数据库 — CLAW WORLD TERMINAL',
  description: '浏览所有龙虾 NFA',
};

export default function NFACollectionPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <NFAPageTitle />
      <div className="term-line mb-4" />
      <LobsterGrid />
    </div>
  );
}
