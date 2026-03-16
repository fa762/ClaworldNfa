import Link from 'next/link';
import { RarityBadge } from './RarityBadge';
import { ShelterTag } from './ShelterTag';
import { StatusBadge } from './StatusBadge';
import { resolveIpfsUrl } from '@/lib/ipfs';
import { getRarityColor } from '@/lib/rarity';

export interface LobsterCardData {
  tokenId: number;
  rarity: number;
  shelter: number;
  level: number;
  active: boolean;
  vaultURI: string;
  isOwned: boolean;
}

const rarityGlow: Record<number, string> = {
  0: '',
  1: 'hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]',
  2: 'hover:shadow-[0_0_20px_rgba(168,85,247,0.2)]',
  3: 'hover:shadow-[0_0_25px_rgba(184,134,11,0.25)]',
  4: 'hover:shadow-[0_0_30px_rgba(240,248,255,0.2)]',
};

const rarityBorderHover: Record<number, string> = {
  0: 'hover:border-white/20',
  1: 'hover:border-blue-500/30',
  2: 'hover:border-purple-500/30',
  3: 'hover:border-yellow-500/30',
  4: 'hover:border-mythic-white/30',
};

export function LobsterCard({ data }: { data: LobsterCardData }) {
  const rarityColors = getRarityColor(data.rarity);
  const imageUrl = resolveIpfsUrl(data.vaultURI);

  return (
    <Link href={`/nfa/${data.tokenId}`}>
      <div className={`group relative bg-card-dark rounded-xl border overflow-hidden transition-all duration-300 hover:translate-y-[-2px] ${
        data.isOwned
          ? 'border-abyss-orange glow-orange'
          : `border-white/10 ${rarityBorderHover[data.rarity] || 'hover:border-white/20'} ${rarityGlow[data.rarity] || ''}`
      }`}>
        {/* Image */}
        <div className="aspect-square bg-navy/50 relative overflow-hidden">
          <img
            src={imageUrl}
            alt={`Lobster #${data.tokenId}`}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
          {/* Overlay gradient on hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-card-dark/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          {data.isOwned && (
            <div className="absolute top-2 right-2 text-xs bg-abyss-orange text-white px-2 py-0.5 rounded-full font-medium shadow-lg">
              我的
            </div>
          )}
          {/* Level badge on hover */}
          <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <span className="text-xs font-mono bg-black/60 text-tech-blue px-2 py-0.5 rounded-md backdrop-blur-sm">
              Lv.{data.level}
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm text-white font-medium">#{data.tokenId}</span>
            <span className="text-sm font-mono text-tech-blue">Lv.{data.level}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <RarityBadge rarity={data.rarity} />
            <ShelterTag shelter={data.shelter} />
            <StatusBadge active={data.active} />
          </div>
        </div>
      </div>
    </Link>
  );
}
