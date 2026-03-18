import { LobsterGrid } from '@/components/nfa/LobsterGrid';

export const metadata = {
  title: 'NFA 数据库 — CLAW WORLD TERMINAL',
  description: '浏览所有龙虾 NFA',
};

export default function NFACollectionPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-4">
        <span className="term-dim text-sm">&gt; </span>
        <span className="term-bright text-sm">NFA 数据库</span>
        <span className="term-dim text-xs ml-2">— 已铸造龙虾合集</span>
      </div>
      <div className="term-line mb-4" />
      <LobsterGrid />
    </div>
  );
}
