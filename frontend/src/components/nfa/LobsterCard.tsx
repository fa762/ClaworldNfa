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

export function LobsterCard({ data }: { data: LobsterCardData }) {
  const rarityColors = getRarityColor(data.rarity);
  const imageUrl = resolveIpfsUrl(data.vaultURI);

  return (
    <Link href={`/nfa/${data.tokenId}`}>
      <div className={`group relative bg-card-dark rounded-xl border overflow-hidden transition-all hover:scale-[1.02] hover:shadow-lg ${
        data.isOwned ? 'border-abyss-orange glow-orange' : 'border-white/10 hover:border-white/20'
      }`}>
        {/* Image */}
        <div className="aspect-square bg-navy/50 relative overflow-hidden">
          {data.vaultURI ? (
            <img
              src={imageUrl}
              alt={`Lobster #${data.tokenId}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl text-gray-700">
              🦞
            </div>
          )}
          {data.isOwned && (
            <div className="absolute top-2 right-2 text-xs bg-abyss-orange text-white px-2 py-0.5 rounded-full">
              我的
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm text-white">#{data.tokenId}</span>
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
