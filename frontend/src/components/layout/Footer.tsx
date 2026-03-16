import { SocialLinks } from './SocialLinks';
import { addresses, getBscScanAddressUrl, isTestnet } from '@/contracts/addresses';
import { truncateAddress } from '@/lib/format';
import { Shell } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-white/[0.04] bg-card-dark/60">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
          {/* Brand */}
          <div className="text-center md:text-left">
            <div className="flex items-center gap-2 justify-center md:justify-start mb-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-abyss-orange to-abyss-orange-light flex items-center justify-center">
                <Shell size={14} className="text-white" />
              </div>
              <span className="font-heading font-bold text-gradient-orange">CLAW WORLD</span>
            </div>
            <p className="text-xs text-gray-600">龙虾文明宇宙 · Claw Civilization Universe</p>
            {isTestnet && (
              <p className="text-[10px] text-yellow-500/70 mt-1.5">BSC Testnet</p>
            )}
          </div>

          {/* Contract links */}
          <div className="text-center">
            <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-3">合约地址</p>
            <div className="flex flex-wrap gap-3 justify-center">
              {addresses.clawNFA !== '0x0000000000000000000000000000000000000000' && (
                <a
                  href={getBscScanAddressUrl(addresses.clawNFA)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono text-tech-blue/70 hover:text-tech-blue transition-colors"
                >
                  NFA: {truncateAddress(addresses.clawNFA)}
                </a>
              )}
              {addresses.clwToken !== '0x0000000000000000000000000000000000000000' && (
                <a
                  href={getBscScanAddressUrl(addresses.clwToken)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono text-tech-blue/70 hover:text-tech-blue transition-colors"
                >
                  CLW: {truncateAddress(addresses.clwToken)}
                </a>
              )}
            </div>
          </div>

          {/* Social */}
          <div className="flex justify-center md:justify-end">
            <SocialLinks />
          </div>
        </div>

        <div className="separator-glow mt-8 mb-5" />
        <div className="text-center text-[11px] text-gray-700">
          © 2026 Claw Civilization Universe. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
