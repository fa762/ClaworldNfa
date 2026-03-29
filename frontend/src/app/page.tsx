'use client';

import { HeroSection } from '@/components/home/HeroSection';
import { WorldStateDashboard } from '@/components/home/WorldStateDashboard';
import { CLWTokenInfo } from '@/components/home/CLWTokenInfo';
import { AnnouncementBoard } from '@/components/home/AnnouncementBoard';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { useState } from 'react';

const features = {
  zh: [
    { key: '1', label: 'AI 对话养成', desc: '通过 OpenClaw 与你的龙虾实时对话，塑造性格与技能' },
    { key: '2', label: 'DNA 基因系统', desc: '每只龙虾拥有独特基因组，变异进化创造无限可能' },
    { key: '3', label: 'PK 竞技对战', desc: '质押 CLW 代币进行对决，智慧与策略决定胜负' },
    { key: '4', label: 'CLW 代币经济', desc: '链上代币驱动的游戏经济，参与生态获取收益' },
  ],
  en: [
    { key: '1', label: 'AI Dialogue', desc: 'Chat with your lobster via OpenClaw, shaping its personality & skills' },
    { key: '2', label: 'DNA System', desc: 'Each lobster has unique genes — mutations create infinite possibilities' },
    { key: '3', label: 'PK Arena', desc: 'Stake CLW tokens in duels — wit and strategy decide the winner' },
    { key: '4', label: 'CLW Economy', desc: 'On-chain token-driven game economy — participate to earn' },
  ],
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      className="text-[10px] term-link shrink-0 ml-2 opacity-70 hover:opacity-100"
    >
      {copied ? '[✓ COPIED]' : '[COPY]'}
    </button>
  );
}

export default function Home() {
  const { lang, t } = useI18n();
  const featureList = features[lang];
  const cn = lang === 'zh';

  return (
    <div className="flex flex-col h-full">
      <HeroSection />

      {/* One-click launch banner */}
      <div className="term-box mt-3 border border-crt-green/30 bg-crt-green/5" data-title={cn ? '⚡ 一键启动' : '⚡ QUICK START'}>
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] term-dim">
            {cn ? '安装 OpenClaw 后，运行以下命令即可启动游戏：' : 'After installing OpenClaw, run this command to start the game:'}
          </p>
          <div className="flex items-center bg-crt-black border border-crt-darkest px-3 py-1.5">
            <code className="text-crt-green text-[11px] font-mono flex-1">openclaw skills install claw-world</code>
            <CopyButton text="openclaw skills install claw-world" />
          </div>
          <div className="flex items-center gap-3 text-[10px]">
            <a href="https://openclaw.ai" target="_blank" rel="noopener noreferrer" className="term-link">
              {cn ? '下载 OpenClaw ↗' : 'Get OpenClaw ↗'}
            </a>
            <span className="term-darkest">|</span>
            <Link href="/openclaw" className="term-link">
              {cn ? '查看完整教程 →' : 'Full guide →'}
            </Link>
            <span className="term-darkest">|</span>
            <a href="https://t.me/Claworldgroup" target="_blank" rel="noopener noreferrer" className="term-link">
              {cn ? '加入 TG 社区 ↗' : 'Join TG ↗'}
            </a>
          </div>
        </div>
      </div>

      {/* Dashboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
        <WorldStateDashboard />
        <CLWTokenInfo />
      </div>

      {/* Announcements + Core Systems */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
        <AnnouncementBoard />
        <div className="term-box" data-title={t('core.title')}>
          <div className="space-y-2">
            {featureList.map((f) => (
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
      </div>

      {/* Quick nav */}
      <div className="flex-1 flex items-end pb-2 mt-4">
        <div className="text-[10px] term-dim font-bold uppercase flex flex-wrap gap-2">
          <span>{t('nav.navigate')}</span>
          <Link href="/mint" className="term-link">[{t('nav.mint')}]</Link>
          <Link href="/nfa" className="term-link">[{t('nav.vault')}]</Link>
          <Link href="/openclaw" className="term-link">[{t('nav.openclaw')}]</Link>
          <Link href="/lore" className="term-link">[{t('nav.lore')}]</Link>
        </div>
      </div>
    </div>
  );
}
