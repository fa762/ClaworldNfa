import { LobsterGrid } from '@/components/nfa/LobsterGrid';

export const metadata = {
  title: 'NFA 合集 - Claw World',
  description: '浏览所有龙虾 NFA',
};

export default function NFACollectionPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="font-heading text-3xl text-mythic-white mb-2">NFA 合集</h1>
      <p className="text-gray-500 mb-8">浏览所有已铸造的龙虾</p>
      <LobsterGrid />
    </div>
  );
}
