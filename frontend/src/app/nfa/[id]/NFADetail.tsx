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
import { TerminalBox } from '@/components/terminal/TerminalBox';
import { TerminalBar } from '@/components/terminal/TerminalBar';
import { formatCLW, truncateAddress } from '@/lib/format';
import { getBscScanAddressUrl } from '@/contracts/addresses';
import { isDemoMode } from '@/lib/env';
import { getMockLobsterName } from '@/lib/mockData';
import { resolveIpfsUrl } from '@/lib/ipfs';
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
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="term-dim animate-glow-pulse py-16 text-center">
          LOADING NFA #{tokenId}...<span className="animate-blink ml-1">█</span>
        </div>
      </div>
    );
  }

  const lob = useMock ? mock : (lobster as any);
  if (!lob && !useMock) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center">
        <p className="term-dim mb-4">龙虾 #{tokenId} 不存在或尚未铸造</p>
        <Link href="/nfa" className="term-link">[&lt; 返回合集]</Link>
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

  const name = getMockLobsterName(numId);
  const imageUrl = resolveIpfsUrl(useMock ? '' : ((agentMeta as any)?.vaultURI ?? ''));

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {useMock && (
        <div className="text-xs rarity-epic mb-3">[DEMO MODE — 模拟数据]</div>
      )}

      <Link href="/nfa" className="term-link text-sm mb-4 inline-block">[&lt; 返回合集]</Link>

      {/* Header */}
      <div className="mb-4">
        <span className="term-bright text-lg glow-strong">NFA #{tokenId}</span>
        <span className="term-dim ml-3">{name}</span>
      </div>
      <div className="term-line mb-4" />

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* LEFT COLUMN */}
        <div className="space-y-4">
          {/* Image */}
          <div className="aspect-square max-w-sm border border-crt-darkest overflow-hidden relative">
            <img src={imageUrl} alt={`#${tokenId}`} className="w-full h-full object-cover crt-image" />
            <div className="absolute top-2 right-2">
              <StatusBadge active={Boolean(active)} />
            </div>
          </div>

          {/* Basic Info */}
          <TerminalBox title="基础信息">
            <div className="text-sm space-y-1.5">
              <div className="flex justify-between">
                <span className="term-dim">稀有度</span>
                <RarityBadge rarity={rarity} />
              </div>
              <div className="flex justify-between">
                <span className="term-dim">等级</span>
                <span className="term-bright">Lv.{level}</span>
              </div>
              <div className="flex justify-between">
                <span className="term-dim">据点</span>
                <ShelterTag shelter={shelter} />
              </div>
              <div className="flex justify-between">
                <span className="term-dim">状态</span>
                <StatusBadge active={Boolean(active)} />
              </div>
              <div className="flex justify-between">
                <span className="term-dim">职业</span>
                <span>{jobName}</span>
              </div>
              <div className="term-line my-1" />
              <div className="flex justify-between">
                <span className="term-dim">CLW余额</span>
                <span className="term-bright">{formatCLW(balance)}</span>
              </div>
              <div className="flex justify-between">
                <span className="term-dim">日消耗</span>
                <span>{formatCLW(cost)}/天</span>
              </div>
              <div className="flex justify-between">
                <span className="term-dim">可维持</span>
                <span className={daysRemaining <= 3 ? 'term-danger' : ''}>
                  {daysRemaining === Infinity ? '∞' : `${daysRemaining} 天`}
                </span>
              </div>
              <div className="term-line my-1" />
              <XPProgressBar level={level} xp={xp} />
              {ownerAddress && (
                <>
                  <div className="term-line my-1" />
                  <div className="flex justify-between text-xs">
                    <span className="term-dim">Owner</span>
                    <a href={getBscScanAddressUrl(ownerAddress)} target="_blank" rel="noopener noreferrer" className="term-link">
                      {truncateAddress(ownerAddress)}
                    </a>
                  </div>
                </>
              )}
            </div>
          </TerminalBox>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-4">
          {/* Personality - ASCII bars */}
          <TerminalBox title="性格面板">
            <div className="space-y-1">
              <TerminalBar label="勇气" value={courage} />
              <TerminalBar label="智慧" value={wisdom} />
              <TerminalBar label="社交" value={social} />
              <TerminalBar label="创造" value={create} />
              <TerminalBar label="韧性" value={grit} />
            </div>
            <div className="term-line my-3" />
            <PersonalityRadar courage={courage} wisdom={wisdom} social={social} create={create} grit={grit} />
          </TerminalBox>

          {/* DNA */}
          <TerminalBox title="基因组">
            <DNABarChart str={str} def={def} spd={spd} vit={vit} />
            <div className="term-line my-3" />
            <MutationSlots mutation1={mutation1} mutation2={mutation2} />
          </TerminalBox>

          {/* Deposit */}
          <DepositPanel tokenId={id} />
        </div>
      </div>
    </div>
  );
}
