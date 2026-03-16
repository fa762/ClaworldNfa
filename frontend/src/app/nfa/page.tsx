import { LobsterGrid } from '@/components/nfa/LobsterGrid';

export const metadata = {
  title: 'NFA 合集 - Claw World',
  description: '浏览所有龙虾 NFA',
};

export default function NFACollectionPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-abyss-orange/10 flex items-center justify-center">
            <span className="text-base">🦞</span>
          </div>
          <h1 className="font-heading text-3xl text-mythic-white">NFA 合集</h1>
        </div>
        <p className="text-gray-500 text-sm ml-11">浏览所有已铸造的龙虾</p>
      </div>
      <LobsterGrid />
    </div>
  );
}
