import { MintPanel } from '@/components/mint/MintPanel';

export const metadata = {
  title: '创世铸造 — CLAW WORLD TERMINAL',
  description: '铸造你的创世龙虾 NFA',
};

export default function MintPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-4">
        <span className="term-dim text-sm">&gt; </span>
        <span className="term-bright text-sm">系统: 创世铸造</span>
        <span className="term-dim text-xs ml-2">— Genesis Mint</span>
      </div>
      <div className="term-line mb-4" />
      <MintPanel />
    </div>
  );
}
