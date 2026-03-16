import { HeroSection } from '@/components/home/HeroSection';
import { WorldStateDashboard } from '@/components/home/WorldStateDashboard';
import { CLWTokenInfo } from '@/components/home/CLWTokenInfo';
import { Swords, Brain, Dna, Coins } from 'lucide-react';

const features = [
  { icon: Brain, label: 'AI 对话养成', desc: '通过 OpenClaw 与龙虾交流' },
  { icon: Dna, label: 'DNA 基因系统', desc: '独特属性与变异进化' },
  { icon: Swords, label: 'PK 对战', desc: '质押 CLW 进行竞技对决' },
  { icon: Coins, label: 'CLW 经济', desc: '链上代币驱动的游戏经济' },
];

export default function Home() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-16">
      <HeroSection />

      {/* Feature Highlights */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {features.map((f, i) => (
          <div
            key={f.label}
            className="group glass-light rounded-xl p-4 text-center card-hover cursor-default"
          >
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-abyss-orange/10 mb-3 group-hover:bg-abyss-orange/20 transition-colors">
              <f.icon size={20} className="text-abyss-orange" />
            </div>
            <p className="text-sm font-medium text-mythic-white mb-1">{f.label}</p>
            <p className="text-xs text-gray-500">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Separator */}
      <div className="separator-glow" />

      {/* Dashboard Grid */}
      <div>
        <h2 className="font-heading text-xl text-mythic-white mb-6">实时数据</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <WorldStateDashboard />
          <CLWTokenInfo />
        </div>
      </div>
    </div>
  );
}
