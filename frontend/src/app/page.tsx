import { HeroSection } from '@/components/home/HeroSection';
import { WorldStateDashboard } from '@/components/home/WorldStateDashboard';
import { CLWTokenInfo } from '@/components/home/CLWTokenInfo';
import { TerminalBox } from '@/components/terminal/TerminalBox';
import Link from 'next/link';

const features = [
  { key: '1', label: 'AI 对话养成', desc: '通过 OpenClaw 与你的龙虾实时对话，塑造性格与技能' },
  { key: '2', label: 'DNA 基因系统', desc: '每只龙虾拥有独特基因组，变异进化创造无限可能' },
  { key: '3', label: 'PK 竞技对战', desc: '质押 CLW 代币进行对决，智慧与策略决定胜负' },
  { key: '4', label: 'CLW 代币经济', desc: '链上代币驱动的游戏经济，参与生态获取收益' },
];

export default function Home() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <HeroSection />

      {/* Dashboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <WorldStateDashboard />
        <CLWTokenInfo />
      </div>

      {/* Core Systems */}
      <TerminalBox title="核心系统">
        <div className="space-y-2">
          {features.map((f) => (
            <div key={f.key} className="flex gap-3 text-sm">
              <span className="term-bright shrink-0">[{f.key}]</span>
              <div>
                <span className="text-crt-green">{f.label}</span>
                <span className="term-dim ml-2">— {f.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </TerminalBox>

      {/* Quick nav */}
      <div className="text-sm term-dim">
        <span>&gt; 输入指令: </span>
        <Link href="/mint" className="term-link">[创世铸造]</Link>
        <span className="mx-1">│</span>
        <Link href="/nfa" className="term-link">[NFA 合集]</Link>
        <span className="mx-1">│</span>
        <Link href="/guide" className="term-link">[游戏指南]</Link>
        <span className="mx-1">│</span>
        <Link href="/lore" className="term-link">[世界观]</Link>
      </div>
    </div>
  );
}
