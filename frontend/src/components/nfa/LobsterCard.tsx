'use client';

import Link from 'next/link';
import { RarityBadge } from './RarityBadge';
import { ShelterTag } from './ShelterTag';
import { resolveIpfsUrl } from '@/lib/ipfs';
import { getMockLobsterName } from '@/lib/mockData';
import { useI18n } from '@/lib/i18n';

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
  const imageUrl = resolveIpfsUrl(data.vaultURI);
  const name = getMockLobsterName(data.tokenId);
  const { t } = useI18n();

  return (
    <Link href={`/nfa/${data.tokenId}`}>
      <div className={`border p-2 transition-all hover:border-crt-green hover:bg-crt-green/[0.02] ${
        data.isOwned ? 'border-crt-green bg-crt-green/[0.03]' : 'border-crt-darkest'
      }`}>
        {/* Image */}
        <div className="aspect-square bg-crt-bg mb-2 overflow-hidden relative">
          <img
            src={imageUrl}
            alt={`#${data.tokenId}`}
            className="w-full h-full object-cover crt-image"
            loading="lazy"
          />
          {data.isOwned && (
            <span className="absolute top-1 right-1 text-[10px] text-crt-bright glow-strong">[{t('nfa.myTag')}]</span>
          )}
        </div>

        {/* Info */}
        <div className="text-xs space-y-0.5">
          <div className="flex justify-between">
            <span className="term-bright">#{data.tokenId} {name}</span>
            <span className="term-dim">Lv.{data.level}</span>
          </div>
          <div className="flex justify-between">
            <RarityBadge rarity={data.rarity} />
            <ShelterTag shelter={data.shelter} />
          </div>
          <div className={data.active ? 'status-alive' : 'status-dormant'}>
            {data.active ? t('status.alive') : t('status.dormant')}
          </div>
        </div>
      </div>
    </Link>
  );
}
