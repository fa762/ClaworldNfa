'use client';

import { HeroSection } from '@/components/home/HeroSection';
import { WorldStateDashboard } from '@/components/home/WorldStateDashboard';
import { AnnouncementBoard } from '@/components/home/AnnouncementBoard';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { useState } from 'react';

const features = {
  zh: [
    { key: '1', label: 'AI 对话养成', desc: '与龙虾对话，塑造性格与技能' },
    { key: '2', label: 'DNA 基因系统', desc: '独特基因组，变异进化创造无限可能' },
    { key: '3', label: 'PK 竞技对战', desc: '质押 Claworld，智慧与策略决定胜负' },
    { key: '4', label: 'Claworld 代币经济', desc: '链上代币驱动，参与生态获取收益' },
  ],
  en: [
    { key: '1', label: 'AI Dialogue',  desc: 'Chat with your lobster, shape its personality' },
    { key: '2', label: 'DNA System',   desc: 'Unique genes — mutations create infinite possibilities' },
    { key: '3', label: 'PK Arena',     desc: 'Stake Claworld — wit and strategy decide the winner' },
    { key: '4', label: 'Claworld Economy',  desc: 'On-chain token economy — participate to earn' },
  ],
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="text-[10px] term-link shrink-0 ml-2 opacity-70 hover:opacity-100"
    >
      {copied ? '[✓]' : '[CP]'}
    </button>
  );
}

export default function Home() {
  const { lang, t } = useI18n();
  const featureList = features[lang];
  const cn = lang === 'zh';

  return (
    <div className="flex flex-col gap-3 h-full">

      {/* Hero */}
      <HeroSection />

      {/* One-click install */}
      <div className="term-box border border-crt-green/30 bg-crt-green/5" data-title={cn ? '⚡ 一键启动' : '⚡ QUICK START'}>
        <div className="flex items-center bg-crt-black border border-crt-darkest px-3 py-1.5 mb-2">
          <code className="text-crt-green text-[11px] font-mono flex-1">openclaw skills install claw-world</code>
          <CopyButton text="openclaw skills install claw-world" />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
          <a href="https://openclaw.ai" target="_blank" rel="noopener noreferrer" className="term-link">
            {cn ? '↓ 下载 OpenClaw' : '↓ Get OpenClaw'}
          </a>
          <span className="term-darkest">·</span>
          <Link href="/openclaw" className="term-link">{cn ? '完整教程 →' : 'Full guide →'}</Link>
          <span className="term-darkest">·</span>
          <a href="https://t.me/Claworldgroup" target="_blank" rel="noopener noreferrer" className="term-link">
            {cn ? '💬 TG 社区' : '💬 TG Community'}
          </a>
        </div>
      </div>

      {/* World State + Announcements */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <WorldStateDashboard />
        <AnnouncementBoard />
      </div>

      {/* Core features — compact 2×2 grid */}
      <div className="term-box" data-title={t('core.title')}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {featureList.map((f) => (
            <div key={f.key} className="flex gap-2 text-[10px]">
              <span className="term-bright shrink-0">[{f.key}]</span>
              <div>
                <span className="text-crt-green font-bold">{f.label}</span>
                <span className="term-dim ml-1 text-[9px]">— {f.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick nav */}
      <div className="flex-1 flex items-end pb-1">
        <div className="text-[10px] term-dim font-bold uppercase flex flex-wrap gap-2">
          <span>{t('nav.navigate')}</span>
          <Link href="/mint"      className="term-link">[{t('nav.mint')}]</Link>
          <Link href="/nfa"       className="term-link">[{t('nav.vault')}]</Link>
          <Link href="/openclaw"  className="term-link">[{t('nav.openclaw')}]</Link>
          <Link href="/lore"      className="term-link">[{t('nav.lore')}]</Link>
        </div>
      </div>

    </div>
  );
}
