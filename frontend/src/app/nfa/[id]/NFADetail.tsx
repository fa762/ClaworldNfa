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
import { formatCLW, truncateAddress } from '@/lib/format';
import { addresses, getBscScanAddressUrl } from '@/contracts/addresses';
import { isDemoMode } from '@/lib/env';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import Link from 'next/link';

const JOB_CLASSES = ['探索者', '外交官', '创造者', '守护者', '学者', '先驱者'];

// Mock data for preview
function getMockData(id: number) {
  const seed = id * 7;
  const rarity = id <= 1 ? 4 : id <= 5 ? 3 : id <= 11 ? 2 : id <= 28 ? 1 : 0;
  return {
    rarity,
    shelter: id % 8,
    courage: 20 + ((seed * 3) % 60),
    wisdom: 25 + ((seed * 5) % 55),
    social: 30 + ((seed * 7) % 50),
    create: 15 + ((seed * 11) % 65),
    grit: 20 + ((seed * 13) % 60),
    str: rarity === 4 ? 85 : rarity === 3 ? 70 : 20 + ((seed * 17) % 60),
    def: rarity === 4 ? 80 : rarity === 3 ? 65 : 15 + ((seed * 19) % 60),
    spd: rarity === 4 ? 90 : rarity === 3 ? 60 : 20 + ((seed * 23) % 55),
    vit: rarity === 4 ? 75 : rarity === 3 ? 68 : 25 + ((seed * 29) % 50),
    level: rarity === 4 ? 50 : rarity === 3 ? 35 : rarity === 2 ? 20 : 5 + (id % 15),
    xp: (seed * 31) % 100,
    mutation1: rarity >= 3 ? '0x' + 'ab'.repeat(32) : '0x' + '00'.repeat(32),
    mutation2: rarity >= 4 ? '0x' + 'cd'.repeat(32) : '0x' + '00'.repeat(32),
    active: id % 5 !== 0,
    balance: BigInt(rarity === 4 ? 500000 : rarity === 3 ? 100000 : 5000 + id * 200) * 10n ** 18n,
    cost: BigInt(rarity >= 3 ? 200 : rarity >= 1 ? 50 : 10) * 10n ** 18n,
    jobClass: id % 6,
    owner: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD3e',
  };
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-0.5 h-4 rounded-full bg-abyss-orange" />
      <h3 className="text-sm font-medium text-mythic-white">{title}</h3>
      {subtitle && <span className="text-xs text-gray-600">{subtitle}</span>}
    </div>
  );
}

function StatItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-navy/50 rounded-lg px-3 py-2.5">
      <span className="text-xs text-gray-500 block mb-0.5">{label}</span>
      <p className={`font-mono text-sm ${color || 'text-white'}`}>{value}</p>
    </div>
  );
}

export function NFADetail({ tokenId }: { tokenId: string }) {
  const id = BigInt(tokenId);
  const numId = Number(tokenId);

  const { data: agentState, isLoading: l1 } = useAgentState(id);
  const { data: agentMeta, isLoading: l2 } = useAgentMetadata(id);
  const { data: lobster, isLoading: l3 } = useLobsterState(id);
  const { data: clwBalance } = useClwBalance(id);
  const { data: dailyCost } = useDailyCost(id);
  const { data: jobClass } = useJobClass(id);
  const { data: isActive } = useIsActive(id);
  const { data: owner } = useNFAOwner(id);

  // Use mock data in demo mode
  const useMock = isDemoMode;
  const mock = useMock ? getMockData(numId) : null;

  const loading = !useMock && (l1 || l2 || l3);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-20 bg-gray-800 rounded" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="aspect-square bg-gray-800/50 rounded-xl" />
              <div className="h-48 bg-gray-800/50 rounded-xl" />
            </div>
            <div className="space-y-4">
              <div className="h-64 bg-gray-800/50 rounded-xl" />
              <div className="h-48 bg-gray-800/50 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Extract data from contract or mock
  const lob = useMock ? mock : (lobster as any);

  if (!lob && !useMock) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <p className="text-gray-500 mb-4">龙虾 #{tokenId} 不存在或尚未铸造</p>
        <Link href="/nfa" className="text-abyss-orange hover:underline inline-flex items-center gap-1">
          <ArrowLeft size={14} /> 返回合集
        </Link>
      </div>
    );
  }

  const state = useMock ? mock : (agentState as any);
  const meta = useMock ? null : (agentMeta as any);

  const rarity = useMock ? mock!.rarity : Number(lob.rarity ?? lob[0] ?? 0);
  const shelter = useMock ? mock!.shelter : Number(lob.shelter ?? lob[1] ?? 0);
  const courage = useMock ? mock!.courage : Number(lob.courage ?? lob[2] ?? 0);
  const wisdom = useMock ? mock!.wisdom : Number(lob.wisdom ?? lob[3] ?? 0);
  const social = useMock ? mock!.social : Number(lob.social ?? lob[4] ?? 0);
  const create = useMock ? mock!.create : Number(lob.create ?? lob[5] ?? 0);
  const grit = useMock ? mock!.grit : Number(lob.grit ?? lob[6] ?? 0);
  const str = useMock ? mock!.str : Number(lob.str ?? lob[7] ?? 0);
  const def = useMock ? mock!.def : Number(lob.def ?? lob[8] ?? 0);
  const spd = useMock ? mock!.spd : Number(lob.spd ?? lob[9] ?? 0);
  const vit = useMock ? mock!.vit : Number(lob.vit ?? lob[10] ?? 0);
  const level = useMock ? mock!.level : Number(lob.level ?? lob[13] ?? 0);
  const xp = useMock ? mock!.xp : Number(lob.xp ?? lob[14] ?? 0);
  const mutation1 = useMock ? mock!.mutation1 : (lob.mutation1 ?? lob[11] ?? '0x' + '0'.repeat(64));
  const mutation2 = useMock ? mock!.mutation2 : (lob.mutation2 ?? lob[12] ?? '0x' + '0'.repeat(64));

  const active = useMock ? mock!.active : (isActive ?? Boolean(state?.active ?? state?.[1]));
  const ownerAddress = useMock ? mock!.owner : (owner as string || '');
  const balance = useMock ? mock!.balance : (clwBalance ? BigInt(clwBalance.toString()) : 0n);
  const cost = useMock ? mock!.cost : (dailyCost ? BigInt(dailyCost.toString()) : 0n);
  const daysRemaining = cost > 0n ? Number(balance / cost) : Infinity;
  const jobName = useMock
    ? JOB_CLASSES[mock!.jobClass] ?? '未知'
    : (jobClass !== undefined ? JOB_CLASSES[Number(jobClass)] ?? '未知' : '未知');

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Mock banner */}
      {useMock && (
        <div className="mb-4 px-4 py-2 bg-purple-900/30 border border-purple-700/50 rounded-lg text-sm text-purple-300">
          演示模式 — 显示模拟数据。切换到测试网或主网环境可连接真实链上数据。
        </div>
      )}

      {/* Back link */}
      <Link href="/nfa" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-white mb-6 transition-colors group">
        <ArrowLeft size={15} className="transition-transform group-hover:-translate-x-0.5" /> 返回合集
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Image + Basic Info */}
        <div className="space-y-6">
          {/* Image */}
          <div className="aspect-square glass rounded-xl overflow-hidden">
            <img src="/placeholder-nft.svg" alt={`Lobster #${tokenId}`} className="w-full h-full object-cover" />
          </div>

          {/* Basic Info Card */}
          <div className="glass rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="font-heading text-2xl text-mythic-white">龙虾 #{tokenId}</h1>
              <StatusBadge active={Boolean(active)} />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <RarityBadge rarity={rarity} />
              <ShelterTag shelter={shelter} />
              <span className="text-sm text-tech-blue font-mono bg-tech-blue/10 px-2 py-0.5 rounded">
                Lv.{level}
              </span>
            </div>

            <XPProgressBar level={level} xp={xp} />

            <div className="grid grid-cols-2 gap-2">
              <StatItem label="职业" value={jobName} />
              <StatItem label="CLW 余额" value={formatCLW(balance)} color="text-tech-blue" />
              <StatItem label="日消耗" value={`${formatCLW(cost)} /天`} />
              <StatItem
                label="可维持"
                value={daysRemaining === Infinity ? '∞' : `${daysRemaining} 天`}
                color={daysRemaining <= 3 ? 'text-red-400' : undefined}
              />
            </div>

            {ownerAddress && (
              <div className="flex items-center justify-between pt-3 border-t border-white/5 text-sm">
                <span className="text-gray-500">Owner</span>
                <a
                  href={getBscScanAddressUrl(ownerAddress)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-tech-blue hover:underline"
                >
                  {truncateAddress(ownerAddress)}
                  <ExternalLink size={12} />
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Right: Charts + Deposit */}
        <div className="space-y-6">
          {/* Personality Radar */}
          <div className="glass rounded-xl p-5">
            <SectionHeader title="性格" subtitle="Personality" />
            <PersonalityRadar courage={courage} wisdom={wisdom} social={social} create={create} grit={grit} />
            <div className="grid grid-cols-5 gap-2 text-center text-xs mt-3">
              <div><span className="text-gray-500">勇气</span><p className="font-mono text-white mt-0.5">{courage}</p></div>
              <div><span className="text-gray-500">智慧</span><p className="font-mono text-white mt-0.5">{wisdom}</p></div>
              <div><span className="text-gray-500">社交</span><p className="font-mono text-white mt-0.5">{social}</p></div>
              <div><span className="text-gray-500">创造</span><p className="font-mono text-white mt-0.5">{create}</p></div>
              <div><span className="text-gray-500">韧性</span><p className="font-mono text-white mt-0.5">{grit}</p></div>
            </div>
          </div>

          {/* DNA Bar Chart */}
          <div className="glass rounded-xl p-5">
            <SectionHeader title="基因" subtitle="DNA" />
            <DNABarChart str={str} def={def} spd={spd} vit={vit} />
            <div className="mt-4 pt-4 border-t border-white/5">
              <SectionHeader title="变异槽位" subtitle="Mutations" />
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
