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
import { ArrowLeft, ExternalLink, Briefcase, Wallet, Clock, Zap } from 'lucide-react';
import Link from 'next/link';

const JOB_CLASSES = ['探索者', '外交官', '创造者', '守护者', '学者', '先驱者'];

function getMockData(id: number) {
  const seed = id * 7;
  const rarity = id <= 1 ? 4 : id <= 5 ? 3 : id <= 11 ? 2 : id <= 28 ? 1 : 0;
  return {
    rarity, shelter: id % 8,
    courage: 20 + ((seed * 3) % 60), wisdom: 25 + ((seed * 5) % 55),
    social: 30 + ((seed * 7) % 50), create: 15 + ((seed * 11) % 65),
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

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`glass-card rounded-2xl p-5 ${className}`}>
      {children}
    </div>
  );
}

function SectionTitle({ title, subtitle, icon: Icon }: { title: string; subtitle?: string; icon?: React.ElementType }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      {Icon && (
        <div className="w-7 h-7 rounded-lg bg-abyss-orange/10 flex items-center justify-center">
          <Icon size={14} className="text-abyss-orange" />
        </div>
      )}
      <div>
        <h3 className="text-sm font-semibold text-mythic-white">{title}</h3>
        {subtitle && <p className="text-[10px] text-gray-600">{subtitle}</p>}
      </div>
    </div>
  );
}

function StatItem({ label, value, icon: Icon, color }: {
  label: string; value: string; icon: React.ElementType; color?: string;
}) {
  return (
    <div className="bg-surface/50 rounded-xl px-3.5 py-3 border border-white/[0.04] hover:border-white/[0.08] transition-colors">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon size={11} className="text-gray-500" />
        <span className="text-[10px] text-gray-500">{label}</span>
      </div>
      <p className={`font-mono text-sm font-semibold ${color || 'text-white'}`}>{value}</p>
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

  const useMock = isDemoMode;
  const mock = useMock ? getMockData(numId) : null;
  const loading = !useMock && (l1 || l2 || l3);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-5 w-24 bg-gray-800/50 rounded" />
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="aspect-square bg-gray-800/30 rounded-2xl" />
              <div className="h-56 bg-gray-800/30 rounded-2xl" />
            </div>
            <div className="lg:col-span-3 space-y-6">
              <div className="h-72 bg-gray-800/30 rounded-2xl" />
              <div className="h-56 bg-gray-800/30 rounded-2xl" />
              <div className="h-40 bg-gray-800/30 rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const lob = useMock ? mock : (lobster as any);

  if (!lob && !useMock) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-24 text-center">
        <p className="text-gray-500 text-lg mb-4">龙虾 #{tokenId} 不存在或尚未铸造</p>
        <Link href="/nfa" className="text-abyss-orange hover:underline inline-flex items-center gap-1.5 text-sm">
          <ArrowLeft size={14} /> 返回合集
        </Link>
      </div>
    );
  }

  const state = useMock ? mock : (agentState as any);

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
      {useMock && (
        <div className="mb-4 px-4 py-2.5 bg-purple-500/[0.06] border border-purple-500/15 rounded-xl text-sm text-purple-400">
          演示模式 — 显示模拟数据
        </div>
      )}

      {/* Back link */}
      <Link href="/nfa" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-white mb-6 transition-colors group">
        <ArrowLeft size={15} className="transition-transform group-hover:-translate-x-1" /> 返回合集
      </Link>

      {/* 5-column grid: 2 left, 3 right */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* LEFT: Image + Info (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Image */}
          <div className="aspect-square glass-card rounded-2xl overflow-hidden relative group">
            <img src="/placeholder-nft.svg" alt={`Lobster #${tokenId}`} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
            {/* Status overlay */}
            <div className="absolute top-3 right-3">
              <StatusBadge active={Boolean(active)} />
            </div>
          </div>

          {/* Identity Card */}
          <SectionCard>
            <div className="flex items-center justify-between mb-4">
              <h1 className="font-heading text-2xl text-mythic-white tracking-tight">龙虾 #{tokenId}</h1>
              <span className="text-sm font-mono text-tech-blue bg-tech-blue/10 px-2.5 py-1 rounded-lg">
                Lv.{level}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap mb-5">
              <RarityBadge rarity={rarity} size="md" />
              <ShelterTag shelter={shelter} />
            </div>

            <XPProgressBar level={level} xp={xp} />

            <div className="grid grid-cols-2 gap-2.5 mt-5">
              <StatItem label="职业" value={jobName} icon={Briefcase} />
              <StatItem label="CLW 余额" value={formatCLW(balance)} icon={Wallet} color="text-tech-blue" />
              <StatItem label="日消耗" value={`${formatCLW(cost)} /天`} icon={Zap} />
              <StatItem
                label="可维持"
                value={daysRemaining === Infinity ? '∞' : `${daysRemaining} 天`}
                icon={Clock}
                color={daysRemaining <= 3 ? 'text-red-400' : undefined}
              />
            </div>

            {ownerAddress && (
              <div className="flex items-center justify-between pt-4 mt-4 border-t border-white/[0.04] text-sm">
                <span className="text-gray-500 text-xs">Owner</span>
                <a
                  href={getBscScanAddressUrl(ownerAddress)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-mono text-xs text-tech-blue hover:underline"
                >
                  {truncateAddress(ownerAddress)}
                  <ExternalLink size={11} />
                </a>
              </div>
            )}
          </SectionCard>
        </div>

        {/* RIGHT: Charts + Deposit (3 cols) */}
        <div className="lg:col-span-3 space-y-6">
          {/* Personality Radar */}
          <SectionCard>
            <SectionTitle title="性格面板" subtitle="Personality" />
            <PersonalityRadar courage={courage} wisdom={wisdom} social={social} create={create} grit={grit} />
            <div className="grid grid-cols-5 gap-2 text-center mt-2">
              {[
                { label: '勇气', val: courage },
                { label: '智慧', val: wisdom },
                { label: '社交', val: social },
                { label: '创造', val: create },
                { label: '韧性', val: grit },
              ].map((t) => (
                <div key={t.label}>
                  <span className="text-[10px] text-gray-500">{t.label}</span>
                  <p className="font-mono text-xs font-bold text-white mt-0.5">{t.val}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* DNA + Mutations */}
          <SectionCard>
            <SectionTitle title="基因组" subtitle="DNA Genome" />
            <DNABarChart str={str} def={def} spd={spd} vit={vit} />
            <div className="separator-glow my-5" />
            <SectionTitle title="变异槽位" subtitle="Mutation Slots" />
            <MutationSlots mutation1={mutation1} mutation2={mutation2} />
          </SectionCard>

          {/* Deposit Panel */}
          <DepositPanel tokenId={id} />
        </div>
      </div>
    </div>
  );
}
