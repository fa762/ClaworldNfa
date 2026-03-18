'use client';

import { TypeWriter } from '@/components/terminal/TypeWriter';
import Link from 'next/link';

const ASCII_LOGO = `
 ██████╗██╗      █████╗ ██╗    ██╗
██╔════╝██║     ██╔══██╗██║    ██║
██║     ██║     ███████║██║ █╗ ██║
██║     ██║     ██╔══██║██║███╗██║
╚██████╗███████╗██║  ██║╚███╔███╔╝
 ╚═════╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝
       W O R L D   v 2 . 0`.trim();

export function HeroSection() {
  return (
    <div className="py-6 animate-boot">
      {/* ASCII Logo */}
      <pre className="text-crt-green text-[10px] sm:text-xs leading-tight mb-4 glow-strong overflow-x-auto">
        {ASCII_LOGO}
      </pre>

      <div className="term-line mb-4" />

      {/* Typewriter description */}
      <div className="mb-4 text-sm">
        <span className="term-dim">&gt; </span>
        <TypeWriter
          text="AXIOM 统治的地表之下，人类与 AI 龙虾伙伴共同生存"
          speed={25}
          delay={800}
        />
      </div>
      <div className="mb-6 text-sm">
        <span className="term-dim">&gt; </span>
        <TypeWriter
          text="通过 OpenClaw 对话养成你的龙虾，参与任务、PK 对战、交易市场"
          speed={25}
          delay={2500}
        />
      </div>

      <div className="term-line mb-6" />

      {/* CTA */}
      <div className="flex flex-wrap gap-3">
        <Link href="/nfa" className="term-btn term-btn-primary text-sm">
          [探索 NFA 合集]
        </Link>
        <Link href="/guide" className="term-btn text-sm">
          [游戏指南]
        </Link>
        <Link href="/lore" className="term-btn text-sm">
          [世界观]
        </Link>
      </div>
    </div>
  );
}
