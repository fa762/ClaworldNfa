'use client';

import { useState } from 'react';
import { useAgentState, useAgentMetadata, useNFAOwner } from '@/contracts/hooks/useClawNFA';
import { useLobsterState, useClwBalance, useDailyCost, useJobClass, useIsActive } from '@/contracts/hooks/useClawRouter';
import { RarityBadge } from '@/components/nfa/RarityBadge';
import { ShelterTag } from '@/components/nfa/ShelterTag';
import { StatusBadge } from '@/components/nfa/StatusBadge';
import { PipBoyStatList } from '@/components/nfa/PipBoyStatList';
import { XPProgressBar } from '@/components/nfa/XPProgressBar';
import { MutationSlots } from '@/components/nfa/MutationSlots';
import { DepositPanel } from '@/components/nfa/DepositPanel';
import { TerminalBar } from '@/components/terminal/TerminalBar';
import { formatCLW, truncateAddress } from '@/lib/format';
import { getBscScanAddressUrl } from '@/contracts/addresses';
import { isDemoMode } from '@/lib/env';
import { getMockLobsterName } from '@/lib/mockData';
import { resolveIpfsUrl } from '@/lib/ipfs';
import Link from 'next/link';

const JOB_CLASSES = ['探索者', '外交官', '创造者', '守护者', '学者', '先驱者'];

const TABS = [
  { key: 'status', label: '状态' },
  { key: 'special', label: 'SPECIAL' },
  { key: 'gene', label: '基因' },
  { key: 'maintain', label: '维护' },
] as const;
type TabKey = typeof TABS[number]['key'];

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
  const [tab, setTab] = useState<TabKey>('special');

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
      <div className="p-6">
        <div className="term-dim animate-glow-pulse py-16 text-center">
          LOADING NFA #{tokenId}...<span className="animate-blink ml-1">█</span>
        </div>
      </div>
    );
  }

  const lob = useMock ? mock : (lobster as any);
  if (!lob && !useMock) {
    return (
      <div className="p-6 text-center">
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

  // SPECIAL stats for PipBoyStatList
  const specialStats = [
    { key: 'STR', label: '力量', enLabel: 'Strength', value: str },
    { key: 'DEF', label: '防御', enLabel: 'Defense', value: def },
    { key: 'SPD', label: '速度', enLabel: 'Speed', value: spd },
    { key: 'VIT', label: '生命', enLabel: 'Vitality', value: vit },
    { key: 'courage', label: '勇气', enLabel: 'Courage', value: courage },
    { key: 'wisdom', label: '智慧', enLabel: 'Wisdom', value: wisdom },
    { key: 'social', label: '社交', enLabel: 'Social', value: social },
    { key: 'create', label: '创造', enLabel: 'Create', value: create },
    { key: 'grit', label: '韧性', enLabel: 'Grit', value: grit },
  ];

  const lobsterImage = (
    <div className="aspect-square w-full border border-crt-darkest overflow-hidden relative">
      <img src={imageUrl} alt={`#${tokenId}`} className="w-full h-full object-cover crt-image" />
      <div className="absolute top-1 right-1">
        <StatusBadge active={Boolean(active)} />
      </div>
    </div>
  );

  return (
    <div className="px-4 py-3 max-w-5xl mx-auto">
      {useMock && (
        <div className="text-[10px] rarity-epic mb-2">[DEMO]</div>
      )}

      {/* Header: back + name */}
      <div className="flex items-center gap-3 mb-2">
        <Link href="/nfa" className="term-link text-xs">[&lt;]</Link>
        <span className="term-bright text-sm glow-strong">NFA #{tokenId}</span>
        <span className="term-dim text-xs">{name}</span>
      </div>

      {/* Pip-Boy sub-tabs */}
      <div className="flex gap-1 mb-3 border-b border-crt-darkest pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`pipboy-tab text-xs ${tab === t.key ? 'pipboy-tab-active' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="animate-fade-in">
        {tab === 'status' && (
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Left: info list */}
            <div className="flex-1 space-y-1 text-sm">
              <Row label="稀有度"><RarityBadge rarity={rarity} /></Row>
              <Row label="等级"><span className="term-bright">Lv.{level}</span></Row>
              <Row label="据点"><ShelterTag shelter={shelter} /></Row>
              <Row label="状态"><StatusBadge active={Boolean(active)} /></Row>
              <Row label="职业"><span>{jobName}</span></Row>
              <div className="term-line my-1.5" />
              <Row label="CLW余额"><span className="term-bright">{formatCLW(balance)}</span></Row>
              <Row label="日消耗"><span>{formatCLW(cost)}/天</span></Row>
              <Row label="可维持">
                <span className={daysRemaining <= 3 ? 'term-danger' : ''}>
                  {daysRemaining === Infinity ? '∞' : `${daysRemaining} 天`}
                </span>
              </Row>
              <div className="term-line my-1.5" />
              <XPProgressBar level={level} xp={xp} />
              {ownerAddress && (
                <Row label="Owner">
                  <a href={getBscScanAddressUrl(ownerAddress)} target="_blank" rel="noopener noreferrer" className="term-link text-xs">
                    {truncateAddress(ownerAddress)}
                  </a>
                </Row>
              )}
            </div>
            {/* Right: image */}
            <div className="w-full sm:w-48 shrink-0">
              {lobsterImage}
            </div>
          </div>
        )}

        {tab === 'special' && (
          <PipBoyStatList stats={specialStats} sideContent={lobsterImage} />
        )}

        {tab === 'gene' && (
          <div className="space-y-3 p-2">
            <div className="text-xs term-dim mb-2">基因组 / DNA</div>
            <div className="space-y-1">
              <TerminalBar label="力量" value={str} color="term-danger" />
              <TerminalBar label="防御" value={def} color="rarity-rare" />
              <TerminalBar label="速度" value={spd} color="text-crt-green" />
              <TerminalBar label="生命" value={vit} color="term-warn" />
            </div>
            <div className="term-line my-2" />
            <MutationSlots mutation1={mutation1} mutation2={mutation2} />
          </div>
        )}

        {tab === 'maintain' && (
          <DepositPanel tokenId={id} />
        )}
      </div>

      {/* Bottom mini status bar (Pip-Boy style) */}
      <div className="flex items-center justify-between mt-4 pt-2 border-t border-crt-darkest text-xs">
        <span className="term-dim">CLW <span className="term-bright">{formatCLW(balance)}</span></span>
        <span className="term-dim">
          Lv.<span className="term-bright">{level}</span>
          <span className="ml-2 text-crt-green">{'█'.repeat(Math.round(xp / 10))}</span>
          <span className="term-darkest">{'░'.repeat(10 - Math.round(xp / 10))}</span>
        </span>
        <StatusBadge active={Boolean(active)} />
      </div>
    </div>
  );
}

/** 简单的键值行 */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center pipboy-stat-row">
      <span className="term-dim text-xs">{label}</span>
      {children}
    </div>
  );
}
