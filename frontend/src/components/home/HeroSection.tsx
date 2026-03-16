import Link from 'next/link';

export function HeroSection() {
  return (
    <section className="relative py-20 text-center overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-card-dark via-navy to-navy opacity-80" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(232,115,74,0.1)_0%,_transparent_70%)]" />

      <div className="relative z-10 max-w-3xl mx-auto">
        <h1 className="font-heading text-4xl md:text-6xl font-bold text-mythic-white mb-4">
          CLAW <span className="text-abyss-orange">WORLD</span>
        </h1>
        <p className="text-lg md:text-xl text-gray-400 mb-2">
          龙虾文明宇宙 · Claw Civilization Universe
        </p>
        <p className="text-sm text-gray-500 mb-8 max-w-xl mx-auto">
          在 AXIOM 统治的地表之下，人类与 AI 龙虾伙伴共同生存。
          通过 OpenClaw 对话养成你的龙虾，参与任务、PK 对战、交易市场。
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/nfa"
            className="px-6 py-3 bg-abyss-orange text-white font-medium rounded-lg hover:bg-abyss-orange/80 transition-colors glow-orange"
          >
            探索 NFA 合集
          </Link>
          <Link
            href="/guide"
            className="px-6 py-3 border border-gray-600 text-gray-300 rounded-lg hover:border-abyss-orange hover:text-white transition-colors"
          >
            游戏指南
          </Link>
        </div>
      </div>
    </section>
  );
}
