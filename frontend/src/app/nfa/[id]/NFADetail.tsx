'use client';

import { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useAgentState, useAgentMetadata, useNFAOwner } from '@/contracts/hooks/useClawNFA';
import { useLobsterState, useClwBalance, useDailyCost, useJobClass, useIsActive } from '@/contracts/hooks/useClawRouter';
import { RarityBadge } from '@/components/nfa/RarityBadge';
import { ShelterTag } from '@/components/nfa/ShelterTag';
import { StatusBadge } from '@/components/nfa/StatusBadge';
import { PipBoyStatList } from '@/components/nfa/PipBoyStatList';
import { XPProgressBar } from '@/components/nfa/XPProgressBar';
import { MutationSlots } from '@/components/nfa/MutationSlots';
import { DepositPanel } from '@/components/nfa/DepositPanel';
import { WithdrawPanel } from '@/components/nfa/WithdrawPanel';
import { TransferToOpenClaw } from '@/components/nfa/TransferToOpenClaw';
import { AutonomyPanel } from '@/components/nfa/AutonomyPanel';
import { TerminalBar } from '@/components/terminal/TerminalBar';
import { formatCLW, truncateAddress } from '@/lib/format';
import { getXpProgress } from '@/lib/xp';
import { addresses, getBscScanAddressUrl } from '@/contracts/addresses';
import { getLobsterName } from '@/lib/mockData';
import { resolveIpfsUrl } from '@/lib/ipfs';
import { useI18n } from '@/lib/i18n';
import { useTaskStats, usePkStats } from '@/contracts/hooks/useNFAStats';
import { formatCompact } from '@/lib/format';
import Link from 'next/link';

export function NFADetail({ tokenId }: { tokenId: string }) {
  const id = BigInt(tokenId);
  const numId = Number(tokenId);
  const { lang, t } = useI18n();
  const cn = lang === 'zh';

  const TABS = [
    { key: 'status' as const, label: t('tab.status') },
    { key: 'special' as const, label: t('tab.special') },
    { key: 'gene' as const, label: t('tab.gene') },
    { key: 'maintain' as const, label: t('tab.maintain') },
  ];
  type TabKey = 'status' | 'special' | 'gene' | 'maintain';

  const [tab, setTab] = useState<TabKey>('special');

  const { data: agentState, isLoading: l1 } = useAgentState(id);
  const { data: agentMeta, isLoading: l2 } = useAgentMetadata(id);
  const { data: lobster, isLoading: l3 } = useLobsterState(id);
  const { data: clwBalance } = useClwBalance(id);
  const { data: dailyCost } = useDailyCost(id);
  const { data: jobClass } = useJobClass(id);
  const { data: isActive } = useIsActive(id);
  const { data: owner } = useNFAOwner(id);
  const { data: taskStats } = useTaskStats(id);
  const { data: pkStats } = usePkStats(id);

  const loading = l1 || l2 || l3;

  if (loading) {
    return (
      <div className="p-6">
        <div className="term-dim animate-glow-pulse py-16 text-center">
          {t('loading')} NFA #{tokenId}...<span className="animate-blink ml-1">█</span>
        </div>
      </div>
    );
  }

  const lob = lobster as any;
  if (!lob) {
    return (
      <div className="p-6 text-center">
        <p className="term-dim mb-4">NFA #{tokenId} {t('nfa.notExist')}</p>
        <Link href="/nfa" className="term-link">[&lt; {t('nfa.backToList')}]</Link>
      </div>
    );
  }

  const state = agentState as any;
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

  const active = isActive ?? Boolean(state?.active ?? state?.[1]);
  const ownerAddress = (owner as string) || '';
  const balance = clwBalance ? BigInt(clwBalance.toString()) : 0n;
  const cost = dailyCost ? BigInt(dailyCost.toString()) : 0n;
  const daysRemaining = cost > 0n ? Number(balance / cost) : Infinity;

  const getJobName = (idx: number) => t(`job.${idx}`) || t('detail.unknown');
  // jobClass from contract returns [uint8, string] tuple — extract the number
  const jobClassNum = jobClass !== undefined ? Number(Array.isArray(jobClass) ? jobClass[0] : jobClass) : NaN;
  const jobName = !isNaN(jobClassNum) ? getJobName(jobClassNum) : t('detail.unknown');

  const name = getLobsterName(numId);
  // wagmi returns getAgentMetadata as Array(2) wrapping the struct — unwrap it
  const metaObj = Array.isArray(agentMeta) ? agentMeta[0] : agentMeta;
  const rawVaultURI = (metaObj as any)?.vaultURI ?? (metaObj as any)?.[4] ?? '';
  const imageUrl = resolveIpfsUrl(rawVaultURI);

  // SPECIAL tab: only personality stats (no DNA — DNA is in gene tab)
  const specialStats = [
    { key: 'courage', label: t('statLabel.courage'), enLabel: t('statEn.courage'), value: courage },
    { key: 'wisdom', label: t('statLabel.wisdom'), enLabel: t('statEn.wisdom'), value: wisdom },
    { key: 'social', label: t('statLabel.social'), enLabel: t('statEn.social'), value: social },
    { key: 'create', label: t('statLabel.create'), enLabel: t('statEn.create'), value: create },
    { key: 'grit', label: t('statLabel.grit'), enLabel: t('statEn.grit'), value: grit },
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
    <div className="px-4 py-3 max-w-5xl mx-auto flex flex-col h-full min-h-0">
      {/* Header: back + name */}
      <div className="flex items-center gap-3 mb-2">
        <Link href="/nfa" className="term-link text-xs">[&lt;]</Link>
        <span className="term-bright text-sm glow-strong">NFA #{tokenId}</span>
        <span className="term-dim text-xs">{name}</span>
      </div>

      {/* Pip-Boy sub-tabs */}
      <div className="flex gap-1 mb-3 border-b border-crt-darkest pb-1">
        {TABS.map((tabItem) => (
          <button
            key={tabItem.key}
            onClick={() => setTab(tabItem.key)}
            className={`pipboy-tab text-xs ${tab === tabItem.key ? 'pipboy-tab-active' : ''}`}
          >
            {tabItem.label}
          </button>
        ))}
      </div>

      {/* Tab content: left panel + persistent right image */}
      <div className="flex flex-col sm:flex-row gap-2 animate-fade-in">
        {/* Left: tab content */}
        <div className="flex-1 min-w-0">
          {tab === 'status' && (
            <div className="space-y-1 text-sm">
              <Row label={t('detail.rarity')}><RarityBadge rarity={rarity} /></Row>
              <Row label={t('detail.level')}><span className="term-bright">Lv.{level}</span></Row>
              <Row label={t('detail.shelter')}><ShelterTag shelter={shelter} /></Row>
              <Row label={t('detail.status')}><StatusBadge active={Boolean(active)} /></Row>
              <Row label={t('detail.job')}><span>{jobName}</span></Row>
              <div className="term-line my-1.5" />
              <Row label={t('detail.balance')}><span className="term-bright">{formatCLW(balance)}</span></Row>
              <Row label={t('detail.dailyCost')}><span>{formatCLW(cost)}{t('detail.perDay')}</span></Row>
              <Row label={t('detail.sustain')}>
                <span className={daysRemaining <= 3 ? 'term-danger' : ''}>
                  {daysRemaining === Infinity ? '∞' : `${daysRemaining} ${t('detail.days')}`}
                </span>
              </Row>
              <div className="term-line my-1.5" />
              <XPProgressBar level={level} xp={xp} />
              {ownerAddress && (
                <Row label={t('detail.owner')}>
                  <a href={getBscScanAddressUrl(ownerAddress)} target="_blank" rel="noopener noreferrer" className="term-link text-xs">
                    {truncateAddress(ownerAddress)}
                  </a>
                </Row>
              )}
              <Row label="NFA">
                <a href={getBscScanAddressUrl(addresses.clawNFA as string) + `#readProxyContract`} target="_blank" rel="noopener noreferrer" className="term-link text-xs">
                  {truncateAddress(addresses.clawNFA as string)}
                </a>
              </Row>
            </div>
          )}

          {tab === 'special' && (
            <div className="space-y-3">
              <PipBoyStatList stats={specialStats} />
              {/* Task Resume */}
              {taskStats && (
                <div className="term-box mt-2" data-title={cn ? '任务履历' : 'TASK RECORD'}>
                  <div className="grid grid-cols-2 gap-1 text-[11px]">
                    <div className="term-dim">{cn ? '总任务' : 'Total Tasks'}</div>
                    <div className="term-bright">{Number((taskStats as any)[0] ?? (taskStats as any).total ?? 0)}</div>
                    <div className="term-dim">{cn ? '累计收益' : 'Claworld Earned'}</div>
                    <div className="term-bright">{formatCompact(Number(BigInt((taskStats as any)[1] ?? 0) / 10n**14n) / 10000)}</div>
                    <div className="term-dim">{cn ? '勇气' : 'Courage'}</div><div className="term-dim">{Number((taskStats as any)[2] ?? 0)}</div>
                    <div className="term-dim">{cn ? '智慧' : 'Wisdom'}</div><div className="term-dim">{Number((taskStats as any)[3] ?? 0)}</div>
                    <div className="term-dim">{cn ? '社交' : 'Social'}</div><div className="term-dim">{Number((taskStats as any)[4] ?? 0)}</div>
                    <div className="term-dim">{cn ? '创造' : 'Create'}</div><div className="term-dim">{Number((taskStats as any)[5] ?? 0)}</div>
                    <div className="term-dim">{cn ? '毅力' : 'Grit'}</div><div className="term-dim">{Number((taskStats as any)[6] ?? 0)}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'gene' && (
            <div className="space-y-4 p-2">
              <div className="text-xs term-dim mb-1">{t('gene.title')}</div>
              <div className="space-y-3">
                <TerminalBar label="STR" sublabel={t('gene.str')} value={str} color="bg-red-500" />
                <TerminalBar label="DEF" sublabel={t('gene.def')} value={def} color="bg-cyan-400" />
                <TerminalBar label="SPD" sublabel={t('gene.spd')} value={spd} color="bg-green-400" />
                <TerminalBar label="VIT" sublabel={t('gene.vit')} value={vit} color="bg-amber-400" />
              </div>
              <div className="term-line my-3" />
              <MutationSlots mutation1={mutation1} mutation2={mutation2} />

              {/* PK Resume */}
              {pkStats && (
                <>
                  <div className="term-line my-3" />
                  <div className="term-box" data-title={cn ? '战斗履历' : 'PK RECORD'}>
                    <div className="grid grid-cols-2 gap-1 text-[11px]">
                      {(() => {
                        const wins = Number((pkStats as any)[0] ?? (pkStats as any).wins ?? 0);
                        const losses = Number((pkStats as any)[1] ?? (pkStats as any).losses ?? 0);
                        const total = wins + losses;
                        const winRate = total > 0 ? Math.round(wins / total * 100) : 0;
                        const clwWon = Number(BigInt((pkStats as any)[2] ?? 0) / 10n**14n) / 10000;
                        const clwLost = Number(BigInt((pkStats as any)[3] ?? 0) / 10n**14n) / 10000;
                        return (
                          <>
                            <div className="term-dim">{cn ? '总场次' : 'Battles'}</div><div className="term-bright">{total}</div>
                            <div className="term-dim">{cn ? '胜 / 负' : 'W / L'}</div><div className="term-bright">{wins} / {losses}</div>
                            <div className="term-dim">{cn ? '胜率' : 'Win Rate'}</div><div className={winRate >= 50 ? 'text-crt-green' : 'term-danger'}>{winRate}%</div>
                            <div className="term-dim">{cn ? '赢得 Claworld' : 'Claworld Won'}</div><div className="text-crt-green">{formatCompact(clwWon)}</div>
                            <div className="term-dim">{cn ? '损失 Claworld' : 'Claworld Lost'}</div><div className="term-danger">{formatCompact(clwLost)}</div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {tab === 'maintain' && (
            <div className="space-y-4">
              <UpkeepButton tokenId={id} />
              <DepositPanel tokenId={id} />
              <WithdrawPanel tokenId={id} ownerAddress={ownerAddress} />
              <AutonomyPanel tokenId={id} ownerAddress={ownerAddress} clwBalance={balance} dailyCost={cost} />
              <TransferToOpenClaw tokenId={id} ownerAddress={ownerAddress} />
            </div>
          )}
        </div>

        {/* Right: persistent lobster image */}
        <div className="w-full sm:w-64 shrink-0">
          {lobsterImage}
        </div>
      </div>

      {/* Bottom mini status bar — sticky at page bottom */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-crt-darkest text-xs sticky bottom-0 bg-crt-black pb-1">
        <span className="term-dim">Claworld <span className="term-bright">{formatCLW(balance)}</span></span>
        <span className="term-dim">
          Lv.<span className="term-bright">{level}</span>
          {(() => {
            const pct = getXpProgress(level, xp);
            const filled = Math.min(10, Math.max(0, Math.round(pct / 10)));
            return (
              <>
                <span className="ml-2 text-crt-green">{'█'.repeat(filled)}</span>
                <span className="term-darkest">{'░'.repeat(10 - filled)}</span>
              </>
            );
          })()}
          <span className="term-dim ml-1 text-[10px]">{xp}xp</span>
        </span>
        <StatusBadge active={Boolean(active)} />
      </div>
    </div>
  );
}

/** Simple key-value row */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center pipboy-stat-row">
      <span className="term-dim text-xs">{label}</span>
      {children}
    </div>
  );
}

/** Process upkeep button */
function UpkeepButton({ tokenId }: { tokenId: bigint }) {
  const { t } = useI18n();
  const { data: hash, writeContract, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function handleUpkeep() {
    writeContract({
      address: addresses.clawRouter as `0x${string}`,
      abi: [{ name: 'processUpkeep', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'nfaId', type: 'uint256' }], outputs: [] }],
      functionName: 'processUpkeep',
      args: [tokenId],
    });
  }

  return (
    <div className="flex items-center gap-3 text-xs p-2 border border-crt-darkest">
      <span className="term-dim">{t('upkeep.label') || 'Daily Upkeep'}</span>
      <button
        onClick={handleUpkeep}
        disabled={isPending || isConfirming}
        className="term-btn text-xs"
      >
        [{isPending ? (t('upkeep.signing') || 'Signing...') : isConfirming ? (t('upkeep.confirming') || 'Confirming...') : (t('upkeep.process') || 'Process')}]
      </button>
      {isSuccess && <span className="text-crt-green text-xs">{t('upkeep.done') || 'Done'}</span>}
    </div>
  );
}
