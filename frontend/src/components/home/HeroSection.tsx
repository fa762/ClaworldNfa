import Link from 'next/link';
import { Waves, Shield, Zap } from 'lucide-react';

export function HeroSection() {
  return (
    <section className="relative py-24 md:py-32 text-center overflow-hidden rounded-2xl">
      {/* Layered background */}
      <div className="absolute inset-0 bg-gradient-to-b from-card-dark via-navy to-navy" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(232,115,74,0.12)_0%,_transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(0,120,212,0.08)_0%,_transparent_50%)]" />

      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Floating decorative orbs */}
      <div className="absolute top-16 left-[15%] w-2 h-2 rounded-full bg-abyss-orange/40 animate-float" />
      <div className="absolute top-32 right-[20%] w-1.5 h-1.5 rounded-full bg-tech-blue/40 animate-float delay-200" />
      <div className="absolute bottom-20 left-[25%] w-1 h-1 rounded-full bg-legend-gold/50 animate-float delay-400" />
      <div className="absolute bottom-16 right-[15%] w-2.5 h-2.5 rounded-full bg-abyss-orange/20 animate-float delay-300" />

      {/* Content */}
      <div className="relative z-10 max-w-3xl mx-auto px-4">
        <div className="animate-fade-in-up">
          <p className="text-xs tracking-[0.3em] uppercase text-abyss-orange/70 mb-4 font-sans">
            Claw Civilization Universe
          </p>
          <h1 className="font-heading text-5xl md:text-7xl font-bold mb-6 leading-tight">
            <span className="text-mythic-white">CLAW</span>{' '}
            <span className="text-gradient-orange">WORLD</span>
          </h1>
        </div>

        <div className="animate-fade-in-up delay-100">
          <p className="text-base md:text-lg text-gray-400 mb-2 font-sans">
            龙虾文明宇宙
          </p>
          <p className="text-sm text-gray-500 mb-10 max-w-lg mx-auto leading-relaxed">
            在 AXIOM 统治的地表之下，人类与 AI 龙虾伙伴共同生存。
            通过 OpenClaw 对话养成你的龙虾，参与任务、PK 对战、交易市场。
          </p>
        </div>

        <div className="flex items-center justify-center gap-4 animate-fade-in-up delay-200">
          <Link
            href="/nfa"
            className="group px-7 py-3.5 bg-abyss-orange text-white font-medium rounded-xl hover:bg-abyss-orange/90 transition-all glow-orange hover:shadow-[0_0_30px_rgba(232,115,74,0.4)]"
          >
            探索 NFA 合集
            <span className="inline-block ml-1 transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
          <Link
            href="/guide"
            className="px-7 py-3.5 border border-white/15 text-gray-300 rounded-xl hover:border-abyss-orange/50 hover:text-white hover:bg-white/[0.03] transition-all"
          >
            游戏指南
          </Link>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-12 animate-fade-in-up delay-300">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs text-gray-400">
            <Waves size={14} className="text-tech-blue" />
            BSC 链上运行
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs text-gray-400">
            <Shield size={14} className="text-abyss-orange" />
            AI 驱动养成
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs text-gray-400">
            <Zap size={14} className="text-legend-gold" />
            去中心化 PK
          </div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-navy to-transparent" />
    </section>
  );
}
