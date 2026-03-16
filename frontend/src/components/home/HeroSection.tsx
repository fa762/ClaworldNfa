'use client';

import Link from 'next/link';
import { Waves, Shield, Zap, ChevronDown } from 'lucide-react';

export function HeroSection() {
  return (
    <section className="relative py-28 md:py-36 text-center overflow-hidden rounded-2xl noise-overlay">
      {/* Multi-layer gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-card-dark via-navy to-navy" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_center,_rgba(232,115,74,0.12)_0%,_transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,_rgba(0,120,212,0.08)_0%,_transparent_40%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(184,134,11,0.06)_0%,_transparent_35%)]" />

      {/* Animated grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: 'linear-gradient(rgba(232,115,74,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(232,115,74,0.2) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }}
      />

      {/* Floating particles */}
      <div className="absolute top-12 left-[12%] w-2 h-2 rounded-full bg-abyss-orange/30 animate-float" />
      <div className="absolute top-24 right-[18%] w-1.5 h-1.5 rounded-full bg-tech-blue/40 animate-float-slow delay-200" />
      <div className="absolute bottom-28 left-[22%] w-1 h-1 rounded-full bg-legend-gold/50 animate-float delay-400" />
      <div className="absolute bottom-20 right-[12%] w-2 h-2 rounded-full bg-abyss-orange/20 animate-float-slow delay-300" />
      <div className="absolute top-[40%] left-[8%] w-1.5 h-1.5 rounded-full bg-tech-blue/20 animate-float delay-500" />
      <div className="absolute top-[35%] right-[8%] w-1 h-1 rounded-full bg-legend-gold/30 animate-float-slow delay-100" />

      {/* Large decorative rings */}
      <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full border border-abyss-orange/5 animate-pulse-glow" />
      <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full border border-tech-blue/5 animate-pulse-glow delay-300" />

      {/* Content */}
      <div className="relative z-10 max-w-3xl mx-auto px-4">
        {/* Eyebrow */}
        <div className="animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-xs text-gray-400 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse-dot" />
            BSC Chain · AI-Powered · Play-to-Earn
          </div>
        </div>

        {/* Title */}
        <div className="animate-fade-in-up delay-100">
          <h1 className="font-heading text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold mb-6 leading-[1.1] tracking-tight">
            <span className="text-mythic-white">CLAW</span>
            <br className="sm:hidden" />
            {' '}
            <span className="text-gradient-orange">WORLD</span>
          </h1>
        </div>

        {/* Subtitle */}
        <div className="animate-fade-in-up delay-200">
          <p className="text-lg md:text-xl text-gray-300 mb-2 font-heading tracking-wider">
            龙虾文明宇宙
          </p>
          <p className="text-sm md:text-base text-gray-500 mb-10 max-w-lg mx-auto leading-relaxed">
            在 AXIOM 统治的地表之下，人类与 AI 龙虾伙伴共同生存。
            通过 OpenClaw 对话养成你的龙虾，参与任务、PK 对战、交易市场。
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 animate-fade-in-up delay-300">
          <Link
            href="/nfa"
            className="group w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-abyss-orange to-abyss-orange-light text-white font-semibold rounded-xl transition-all glow-orange hover:shadow-[0_0_40px_rgba(232,115,74,0.5)] hover:scale-[1.02] active:scale-[0.98]"
          >
            探索 NFA 合集
            <span className="inline-block ml-1.5 transition-transform group-hover:translate-x-1">→</span>
          </Link>
          <Link
            href="/guide"
            className="group w-full sm:w-auto px-8 py-3.5 glass text-gray-300 font-medium rounded-xl hover:text-white hover:bg-white/[0.06] transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            游戏指南
          </Link>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-14 animate-fade-in-up delay-400">
          {[
            { icon: Waves, label: 'BSC 链上运行', color: 'text-tech-blue' },
            { icon: Shield, label: 'AI 驱动养成', color: 'text-abyss-orange' },
            { icon: Zap, label: '去中心化 PK', color: 'text-legend-gold' },
          ].map((f) => (
            <div key={f.label} className="flex items-center gap-2 px-4 py-2 rounded-full glass-card text-xs text-gray-400 hover:text-gray-300 transition-colors">
              <f.icon size={14} className={f.color} />
              {f.label}
            </div>
          ))}
        </div>

        {/* Scroll indicator */}
        <div className="mt-16 animate-fade-in delay-700">
          <ChevronDown size={20} className="mx-auto text-gray-600 animate-float" />
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-navy to-transparent" />
    </section>
  );
}
