'use client';

import { TypeWriter } from '@/components/terminal/TypeWriter';
import { useI18n } from '@/lib/i18n';

const ASCII_LOGO = ` ██████╗██╗      █████╗ ██╗    ██╗
██╔════╝██║     ██╔══██╗██║    ██║
██║     ██║     ███████║██║ █╗ ██║
██║     ██║     ██╔══██║██║███╗██║
╚██████╗███████╗██║  ██║╚███╔███╔╝
 ╚═════╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝

██╗    ██╗ ██████╗ ██████╗ ██╗     ██████╗
██║    ██║██╔═══██╗██╔══██╗██║     ██╔══██╗
██║ █╗ ██║██║   ██║██████╔╝██║     ██║  ██║
██║███╗██║██║   ██║██╔══██╗██║     ██║  ██║
╚███╔███╔╝╚██████╔╝██║  ██║███████╗██████╔╝
 ╚══╝╚══╝  ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═════╝`;

export function HeroSection() {
  const { t } = useI18n();

  return (
    <div className="animate-boot">
      {/* ASCII Logo */}
      <pre className="text-[6px] sm:text-[9px] md:text-[10px] leading-[1.1] font-bold glow-strong overflow-hidden whitespace-pre">
        {ASCII_LOGO}
      </pre>

      {/* Terminal Access header */}
      <div className="mt-4 flex justify-between items-baseline border-t border-crt-green/20 pt-3">
        <div className="text-xl sm:text-2xl font-extrabold uppercase tracking-widest">
          {t('hero.title')}
        </div>
        <div className="text-[10px] font-bold opacity-70">
          {t('hero.status')}: <span className="text-crt-green">{t('hero.nominal')}</span>
          <span className="animate-blink ml-1">█</span>
        </div>
      </div>

      {/* Typewriter description */}
      <div className="mt-4 text-[11px] opacity-80">
        <span className="opacity-40">&gt; </span>
        <TypeWriter
          text={t('hero.desc')}
          speed={25}
          delay={800}
        />
      </div>
    </div>
  );
}
