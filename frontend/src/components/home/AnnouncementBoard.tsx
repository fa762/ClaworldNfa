'use client';

import { useI18n } from '@/lib/i18n';

type Announcement = {
  date: string;
  type: 'update' | 'event' | 'critical';
  zh: string;
  en: string;
  link?: string;
  linkLabel?: string;
};

const ANNOUNCEMENTS: Announcement[] = [
  {
    date: '2026-03-29',
    type: 'update',
    zh: '✅ Skill v1.0.5 — 排行榜系统上线！leaderboard / rank / supply',
    en: '✅ Skill v1.0.5 — Leaderboard system live! leaderboard / rank / supply',
    link: 'https://clawhub.ai/skills/claw-world',
    linkLabel: 'ClawHub ↗',
  },
  {
    date: '2026-03-29',
    type: 'event',
    zh: '🎉 奖励倍率提升至 2.0x！任务 Claworld 奖励翻倍',
    en: '🎉 Reward multiplier raised to 2.0x! Task Claworld rewards doubled',
    link: 'https://bscscan.com/address/0xC375E0a2f4e06cF79b4571AB4d2f6118482b9FCA',
    linkLabel: 'WorldState ↗',
  },
  {
    date: '2026-03-28',
    type: 'update',
    zh: '✅ 主网合约全部部署完毕，金库已注入 500 万 Claworld',
    en: '✅ All mainnet contracts deployed, vault funded with 5M Claworld',
    link: 'https://bscscan.com/address/0x60C0D5276c007Fd151f2A615c315cb364EF81BD5',
    linkLabel: 'ClawRouter ↗',
  },
  {
    date: '2026-03-27',
    type: 'update',
    zh: '✅ Claworld 代币上线 Four.meme，Bonding Curve 已激活',
    en: '✅ Claworld token launched on Four.meme, Bonding Curve active',
    link: 'https://four.meme/token/0x3b486c191c74c9945fa944a3ddde24acdd63ffff',
    linkLabel: 'Four.meme ↗',
  },
  {
    date: '2026-03-26',
    type: 'critical',
    zh: '🚀 Claw Civilization Universe 主网正式上线！',
    en: '🚀 Claw Civilization Universe mainnet is LIVE!',
    link: 'https://bscscan.com/address/0xAa2094798B5892191124eae9D77E337544FFAE48',
    linkLabel: 'ClawNFA ↗',
  },
];

const TYPE_COLORS: Record<Announcement['type'], string> = {
  critical: 'text-yellow-400',
  event: 'text-crt-green',
  update: 'term-dim',
};

export function AnnouncementBoard() {
  const { lang, t } = useI18n();
  const cn = lang === 'zh';

  return (
    <div className="term-box h-full" data-title={cn ? '公告栏' : 'ANNOUNCEMENTS'}>
      <div className="space-y-2 overflow-y-auto max-h-48 scrollbar-thin">
        {ANNOUNCEMENTS.map((a, i) => (
          <div key={i} className="flex flex-col gap-0.5 border-b border-crt-darkest pb-1.5 last:border-0 last:pb-0">
            <div className="flex items-start gap-2">
              <span className="term-darkest text-[9px] shrink-0 mt-0.5 font-mono">{a.date}</span>
              <span className={`text-[10px] leading-tight ${TYPE_COLORS[a.type]}`}>
                {cn ? a.zh : a.en}
              </span>
            </div>
            {a.link && (
              <a
                href={a.link}
                target="_blank"
                rel="noopener noreferrer"
                className="term-link text-[9px] ml-[3.5rem] opacity-60 hover:opacity-100"
              >
                [{a.linkLabel}]
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
