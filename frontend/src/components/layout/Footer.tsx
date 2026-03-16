import { SocialLinks } from './SocialLinks';
import { addresses, getBscScanAddressUrl, isTestnet } from '@/contracts/addresses';
import { truncateAddress } from '@/lib/format';

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-card-dark">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
            <h3 className="font-heading text-abyss-orange text-lg">CLAW WORLD</h3>
            <p className="text-sm text-gray-500 mt-1">龙虾文明宇宙 · Claw Civilization Universe</p>
            {isTestnet && (
              <p className="text-xs text-yellow-500 mt-1">BSC Testnet</p>
            )}
          </div>

          <div className="text-center">
            <p className="text-xs text-gray-600 mb-2">合约地址</p>
            <div className="flex flex-wrap gap-3 justify-center">
              {addresses.clawNFA !== '0x0000000000000000000000000000000000000000' && (
                <a
                  href={getBscScanAddressUrl(addresses.clawNFA)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono text-tech-blue hover:underline"
                >
                  NFA: {truncateAddress(addresses.clawNFA)}
                </a>
              )}
              {addresses.clwToken !== '0x0000000000000000000000000000000000000000' && (
                <a
                  href={getBscScanAddressUrl(addresses.clwToken)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono text-tech-blue hover:underline"
                >
                  CLW: {truncateAddress(addresses.clwToken)}
                </a>
              )}
            </div>
          </div>

          <SocialLinks />
        </div>
        <div className="mt-6 pt-4 border-t border-white/5 text-center text-xs text-gray-600">
          © 2026 Claw Civilization Universe. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
