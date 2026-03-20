'use client';

import { TypeWriter } from '@/components/terminal/TypeWriter';

const ASCII_LOGO = ` ██████╗██╗      █████╗ ██╗    ██╗    ██╗ ██████╗ ██████╗ ██╗     ██████╗
██╔════╝██║     ██╔══██╗██║    ██║    ██║██╔═══██╗██╔══██╗██║     ██╔══██╗
██║     ██║     ███████║██║ █╗ ██║    ██║██║   ██║██████╔╝██║     ██║  ██║
██║     ██║     ██╔══██║██║███╗██║    ██║██║   ██║██╔══██╗██║     ██║  ██║
╚██████╗███████╗██║  ██║╚███╔███╔╝    ╚██████╔╝██║  ██║███████╗██████╔╝
 ╚═════╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝      ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═════╝`;

export function HeroSection() {
  return (
    <div className="animate-boot">
      {/* ASCII Logo */}
      <pre className="text-[8px] sm:text-[10px] leading-[1.1] font-bold glow-strong overflow-x-auto whitespace-pre">
        {ASCII_LOGO}
      </pre>

      {/* Terminal Access header */}
      <div className="mt-4 flex justify-between items-baseline border-t border-crt-green/20 pt-3">
        <div className="text-xl sm:text-2xl font-extrabold uppercase tracking-widest">
          TERMINAL ACCESS
        </div>
        <div className="text-[10px] font-bold opacity-70">
          STATUS: <span className="text-crt-green">NOMINAL</span>
          <span className="animate-blink ml-1">█</span>
        </div>
      </div>

      {/* Typewriter description */}
      <div className="mt-4 text-[11px] opacity-80">
        <span className="opacity-40">&gt; </span>
        <TypeWriter
          text="AXIOM 统治的地表之下，人类与 AI 龙虾伙伴共同生存..."
          speed={25}
          delay={800}
        />
      </div>
    </div>
  );
}
