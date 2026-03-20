import { HeroSection } from '@/components/home/HeroSection';
import { WorldStateDashboard } from '@/components/home/WorldStateDashboard';
import { CLWTokenInfo } from '@/components/home/CLWTokenInfo';
import { SystemLogs } from '@/components/home/SystemLogs';
import Link from 'next/link';

const features = [
  { key: '1', label: 'AI 对话养成', desc: '通过 OpenClaw 与你的龙虾实时对话，塑造性格与技能' },
  { key: '2', label: 'DNA 基因系统', desc: '每只龙虾拥有独特基因组，变异进化创造无限可能' },
  { key: '3', label: 'PK 竞技对战', desc: '质押 CLW 代币进行对决，智慧与策略决定胜负' },
  { key: '4', label: 'CLW 代币经济', desc: '链上代币驱动的游戏经济，参与生态获取收益' },
];

export default function Home() {
  return (
    <div className="space-y-6">
      <HeroSection />

      {/* Dashboard Grid — Stitch 2-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <WorldStateDashboard />
        <CLWTokenInfo />
      </div>

      {/* Core Systems */}
      <div className="term-box" data-title="CORE SYSTEMS">
        <div className="space-y-2">
          {features.map((f) => (
            <div key={f.key} className="flex gap-3 text-[11px]">
              <span className="term-bright shrink-0 font-bold">[{f.key}]</span>
              <div>
                <span className="text-crt-green font-bold">{f.label}</span>
                <span className="term-dim ml-2">— {f.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* System Logs */}
      <SystemLogs />

      {/* Quick nav */}
      <div className="text-[10px] term-dim font-bold uppercase flex flex-wrap gap-2">
        <span>&gt; NAVIGATE:</span>
        <Link href="/mint" className="term-link">[MINT]</Link>
        <Link href="/nfa" className="term-link">[VAULT]</Link>
        <Link href="/guide" className="term-link">[DATA]</Link>
        <Link href="/lore" className="term-link">[LORE]</Link>
      </div>
    </div>
  );
}
