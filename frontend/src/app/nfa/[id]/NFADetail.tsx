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
import { zeroAddress } from 'viem';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const JOB_CLASSES = ['探索者', '外交官', '创造者', '守护者', '学者', '先驱者'];

const isContractDeployed = !!addresses.clawNFA && addresses.clawNFA !== zeroAddress;

// Mock data for preview
function getMockData(id: number) {
  const seed = id * 7;
  const rarities = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 2, 2, 3, 4];
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

  // Use mock data when contracts not deployed
  const useMock = !isContractDeployed;
  const mock = useMock ? getMockData(numId) : null;

  const loading = !useMock && (l1 || l2 || l3);

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

  // Extract data from contract or mock
  const lob = useMock ? mock : (lobster as any);

  if (!lob && !useMock) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center text-gray-500">
        <p>龙虾 #{tokenId} 不存在或尚未铸造</p>
        <Link href="/nfa" className="text-abyss-orange hover:underline mt-4 inline-block">
          ← 返回合集
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
        <div className="mb-4 px-4 py-2 bg-yellow-900/30 border border-yellow-700/50 rounded-lg text-sm text-yellow-400">
          预览模式 — 显示模拟数据。部署合约并配置 .env.local 后将显示真实链上数据。
        </div>
      )}

      {/* Back link */}
      <Link href="/nfa" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-white mb-6 transition-colors">
        <ArrowLeft size={16} /> 返回合集
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Image + Basic Info */}
        <div className="space-y-6">
          {/* Image */}
          <div className="aspect-square bg-card-dark rounded-xl border border-white/10 overflow-hidden">
            <div className="w-full h-full flex items-center justify-center text-8xl text-gray-700">🦞</div>
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
