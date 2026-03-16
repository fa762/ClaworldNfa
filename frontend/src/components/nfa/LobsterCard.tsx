import Link from 'next/link';
import { RarityBadge } from './RarityBadge';
import { ShelterTag } from './ShelterTag';
import { StatusBadge } from './StatusBadge';
import { resolveIpfsUrl } from '@/lib/ipfs';

export interface LobsterCardData {
  tokenId: number;
  rarity: number;
  shelter: number;
  level: number;
  active: boolean;
  vaultURI: string;
  isOwned: boolean;
}

const rarityGlowHover: Record<number, string> = {
  0: 'hover:border-gray-500/20',
  1: 'hover:border-blue-500/30 hover:shadow-[0_0_25px_rgba(59,130,246,0.12)]',
  2: 'hover:border-purple-500/30 hover:shadow-[0_0_25px_rgba(168,85,247,0.15)]',
  3: 'hover:border-yellow-500/30 hover:shadow-[0_0_30px_rgba(184,134,11,0.2)]',
  4: 'hover:border-white/25 hover:shadow-[0_0_35px_rgba(240,248,255,0.15)]',
};

const rarityTopBorder: Record<number, string> = {
  0: 'from-gray-600/20 to-transparent',
  1: 'from-blue-500/40 to-transparent',
  2: 'from-purple-500/40 to-transparent',
  3: 'from-yellow-500/40 to-transparent',
  4: 'from-white/40 to-transparent',
};

export function LobsterCard({ data }: { data: LobsterCardData }) {
  const imageUrl = resolveIpfsUrl(data.vaultURI);

  return (
    <Link href={`/nfa/${data.tokenId}`}>
      <div className={`group relative bg-card-dark rounded-xl border overflow-hidden card-interactive ${
        data.isOwned
          ? 'border-abyss-orange/60 glow-orange'
          : `border-white/[0.06] ${rarityGlowHover[data.rarity] || 'hover:border-white/15'}`
      }`}>
        {/* Rarity accent top border */}
        <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${rarityTopBorder[data.rarity]}`} />

        {/* Image */}
        <div className="aspect-square bg-surface/50 relative overflow-hidden">
          <img
            src={imageUrl}
            alt={`Lobster #${data.tokenId}`}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            loading="lazy"
          />
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-card-dark/80 via-card-dark/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Owner badge */}
          {data.isOwned && (
            <div className="absolute top-2.5 right-2.5 text-[10px] bg-abyss-orange/90 text-white px-2 py-0.5 rounded-md font-semibold shadow-lg backdrop-blur-sm">
              我的
            </div>
          )}

          {/* Hover info overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
            <div className="flex items-center justify-between">
              <StatusBadge active={data.active} />
              <span className="text-xs font-mono bg-black/50 text-tech-blue px-2 py-0.5 rounded-md backdrop-blur-sm">
                Lv.{data.level}
              </span>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm text-white font-semibold">#{data.tokenId}</span>
            <span className="text-xs font-mono text-gray-500">Lv.{data.level}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <RarityBadge rarity={data.rarity} />
            <ShelterTag shelter={data.shelter} />
          </div>
        </div>
      </div>
    </Link>
  );
}
