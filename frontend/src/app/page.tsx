import { HeroSection } from '@/components/home/HeroSection';
import { WorldStateDashboard } from '@/components/home/WorldStateDashboard';
import { CLWTokenInfo } from '@/components/home/CLWTokenInfo';
import { Swords, Brain, Dna, Coins, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const features = [
  { icon: Brain, label: 'AI 对话养成', desc: '通过 OpenClaw 与你的龙虾实时对话，塑造性格与技能', color: 'text-abyss-orange', bg: 'bg-abyss-orange/10 group-hover:bg-abyss-orange/20' },
  { icon: Dna, label: 'DNA 基因系统', desc: '每只龙虾拥有独特基因组，变异进化创造无限可能', color: 'text-tech-blue', bg: 'bg-tech-blue/10 group-hover:bg-tech-blue/20' },
  { icon: Swords, label: 'PK 竞技对战', desc: '质押 CLW 代币进行对决，智慧与策略决定胜负', color: 'text-red-400', bg: 'bg-red-400/10 group-hover:bg-red-400/20' },
  { icon: Coins, label: 'CLW 代币经济', desc: '链上代币驱动的游戏经济，参与生态获取收益', color: 'text-legend-gold', bg: 'bg-legend-gold/10 group-hover:bg-legend-gold/20' },
];

export default function Home() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-20">
      <HeroSection />

      {/* Feature Highlights */}
      <section>
        <div className="text-center mb-10">
          <h2 className="font-heading text-2xl md:text-3xl text-mythic-white mb-3">核心玩法</h2>
          <p className="text-sm text-gray-500 max-w-md mx-auto">在龙虾文明宇宙中，每一只龙虾都是独特的 AI 生命体</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f) => (
            <div
              key={f.label}
              className="group glass-card rounded-xl p-5 card-hover cursor-default"
            >
              <div className={`inline-flex items-center justify-center w-11 h-11 rounded-xl ${f.bg} mb-4 transition-colors`}>
                <f.icon size={22} className={f.color} />
              </div>
              <p className="text-sm font-semibold text-mythic-white mb-2">{f.label}</p>
              <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Separator */}
      <div className="separator-glow" />

      {/* Dashboard Grid */}
      <section>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="font-heading text-2xl text-mythic-white mb-1">实时数据</h2>
            <p className="text-sm text-gray-500">世界状态与代币信息</p>
          </div>
          <Link href="/nfa" className="group flex items-center gap-1 text-sm text-gray-500 hover:text-abyss-orange transition-colors">
            查看全部 NFA
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <WorldStateDashboard />
          <CLWTokenInfo />
        </div>
      </section>
    </div>
  );
}
