'use client';

import { useAgentState, useAgentMetadata, useNFAOwner } from '@/contracts/hooks/useClawNFA';
import { useLobsterState, useClwBalance, useDailyCost, useJobClass, useIsActive } from '@/contracts/hooks/useClawRouter';
import { RarityBadge } from '@/components/nfa/RarityBadge';
import { ShelterTag } from '@/components/nfa/ShelterTag';
import { StatusBadge } from '@/components/nfa/StatusBadge';
import { PersonalityRadar } from '@/components/nfa/PersonalityRadar';
import { DNABarChart } from '@/components/nfa/DNABarChart';
import { XPProgressBar } from '@/components/nfa/XPProgressBar';
import { MutationSlots } from '@/components/nfa/MutationSlots';
import { DepositPanel } from '@/components/nfa/DepositPanel';
import { resolveIpfsUrl } from '@/lib/ipfs';
import { formatCLW, truncateAddress } from '@/lib/format';
import { getBscScanAddressUrl } from '@/contracts/addresses';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const JOB_CLASSES = ['探索者', '外交官', '创造者', '守护者', '学者', '先驱者'];

export function NFADetail({ tokenId }: { tokenId: string }) {
  const id = BigInt(tokenId);

  const { data: agentState, isLoading: l1 } = useAgentState(id);
  const { data: agentMeta, isLoading: l2 } = useAgentMetadata(id);
  const { data: lobster, isLoading: l3 } = useLobsterState(id);
  const { data: clwBalance } = useClwBalance(id);
  const { data: dailyCost } = useDailyCost(id);
  const { data: jobClass } = useJobClass(id);
  const { data: isActive } = useIsActive(id);
  const { data: owner } = useNFAOwner(id);

  const loading = l1 || l2 || l3;

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-32 bg-gray-800 rounded" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="aspect-square bg-gray-800 rounded-xl" />
            <div className="space-y-4">
              <div className="h-6 w-48 bg-gray-800 rounded" />
              <div className="h-40 bg-gray-800 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Extract data from tuples/structs
  const state = agentState as any;
  const meta = agentMeta as any;
  const lob = lobster as any;

  if (!lob) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center text-gray-500">
        <p>龙虾 #{tokenId} 不存在或尚未铸造</p>
        <Link href="/nfa" className="text-abyss-orange hover:underline mt-4 inline-block">
          ← 返回合集
        </Link>
      </div>
    );
  }

  const rarity = Number(lob.rarity ?? lob[0] ?? 0);
  const shelter = Number(lob.shelter ?? lob[1] ?? 0);
  const courage = Number(lob.courage ?? lob[2] ?? 0);
  const wisdom = Number(lob.wisdom ?? lob[3] ?? 0);
  const social = Number(lob.social ?? lob[4] ?? 0);
  const create = Number(lob.create ?? lob[5] ?? 0);
  const grit = Number(lob.grit ?? lob[6] ?? 0);
  const str = Number(lob.str ?? lob[7] ?? 0);
  const def = Number(lob.def ?? lob[8] ?? 0);
  const spd = Number(lob.spd ?? lob[9] ?? 0);
  const vit = Number(lob.vit ?? lob[10] ?? 0);
  const level = Number(lob.level ?? lob[13] ?? 0);
  const xp = Number(lob.xp ?? lob[14] ?? 0);
  const mutation1 = lob.mutation1 ?? lob[11] ?? '0x' + '0'.repeat(64);
  const mutation2 = lob.mutation2 ?? lob[12] ?? '0x' + '0'.repeat(64);

  const vaultURI = meta?.vaultURI ?? meta?.[4] ?? '';
  const imageUrl = resolveIpfsUrl(vaultURI);
  const active = isActive ?? Boolean(state?.active ?? state?.[1]);
  const ownerAddress = owner as string || '';
  const balance = clwBalance ? BigInt(clwBalance.toString()) : 0n;
  const cost = dailyCost ? BigInt(dailyCost.toString()) : 0n;
  const daysRemaining = cost > 0n ? Number(balance / cost) : Infinity;
  const jobName = jobClass !== undefined ? JOB_CLASSES[Number(jobClass)] ?? '未知' : '未知';

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Back link */}
      <Link href="/nfa" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-white mb-6 transition-colors">
        <ArrowLeft size={16} /> 返回合集
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Image + Basic Info */}
        <div className="space-y-6">
          {/* Image */}
          <div className="aspect-square bg-card-dark rounded-xl border border-white/10 overflow-hidden">
            {vaultURI ? (
              <img src={imageUrl} alt={`Lobster #${tokenId}`} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-8xl text-gray-700">🦞</div>
            )}
          </div>

          {/* Basic Info */}
          <div className="bg-card-dark rounded-xl border border-white/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h1 className="font-heading text-2xl text-mythic-white">龙虾 #{tokenId}</h1>
              <StatusBadge active={Boolean(active)} />
            </div>
            <div className="flex items-center gap-2">
              <RarityBadge rarity={rarity} />
              <ShelterTag shelter={shelter} />
              <span className="text-sm text-tech-blue font-mono">Lv.{level}</span>
            </div>
            <XPProgressBar level={level} xp={xp} />
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">职业</span>
                <p className="text-white">{jobName}</p>
              </div>
              <div>
                <span className="text-gray-500">CLW 余额</span>
                <p className="text-tech-blue font-mono">{formatCLW(balance)}</p>
              </div>
              <div>
                <span className="text-gray-500">日消耗</span>
                <p className="text-gray-300 font-mono">{formatCLW(cost)} /天</p>
              </div>
              <div>
                <span className="text-gray-500">可维持</span>
                <p className={`font-mono ${daysRemaining <= 3 ? 'text-red-400' : 'text-gray-300'}`}>
                  {daysRemaining === Infinity ? '∞' : `${daysRemaining} 天`}
                </p>
              </div>
            </div>
            {ownerAddress && (
              <div className="text-sm">
                <span className="text-gray-500">Owner: </span>
                <a
                  href={getBscScanAddressUrl(ownerAddress)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-tech-blue hover:underline"
                >
                  {truncateAddress(ownerAddress)}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Right: Charts + Deposit */}
        <div className="space-y-6">
          {/* Personality Radar */}
          <div className="bg-card-dark rounded-xl border border-white/10 p-4">
            <h3 className="text-sm font-medium text-mythic-white mb-2">性格 Personality</h3>
            <PersonalityRadar courage={courage} wisdom={wisdom} social={social} create={create} grit={grit} />
            <div className="grid grid-cols-5 gap-2 text-center text-xs mt-2">
              <div><span className="text-gray-500">勇气</span><p className="font-mono text-white">{courage}</p></div>
              <div><span className="text-gray-500">智慧</span><p className="font-mono text-white">{wisdom}</p></div>
              <div><span className="text-gray-500">社交</span><p className="font-mono text-white">{social}</p></div>
              <div><span className="text-gray-500">创造</span><p className="font-mono text-white">{create}</p></div>
              <div><span className="text-gray-500">韧性</span><p className="font-mono text-white">{grit}</p></div>
            </div>
          </div>

          {/* DNA Bar Chart */}
          <div className="bg-card-dark rounded-xl border border-white/10 p-4">
            <h3 className="text-sm font-medium text-mythic-white mb-2">基因 DNA</h3>
            <DNABarChart str={str} def={def} spd={spd} vit={vit} />
            <div className="mt-3">
              <MutationSlots mutation1={mutation1} mutation2={mutation2} />
            </div>
          </div>

          {/* Deposit Panel */}
          <DepositPanel tokenId={id} />
        </div>
      </div>
    </div>
  );
}
