'use client';

import { useEffect, useMemo, useState } from 'react';
import { type Address } from 'viem';
import { useAccount } from 'wagmi';

import { AutonomyPanel } from '@/components/nfa/AutonomyPanel';
import { ConnectButton } from '@/components/wallet/ConnectButton';
import { TerminalBox } from '@/components/terminal/TerminalBox';
import { useTokensOfOwner } from '@/contracts/hooks/useClawNFA';
import { useClwBalance, useDailyCost, useLobsterState } from '@/contracts/hooks/useClawRouter';
import { formatCLW } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { getLobsterName } from '@/lib/mockData';

function AiAgentWorkspace({
  tokenId,
  ownerAddress,
}: {
  tokenId: bigint;
  ownerAddress: Address;
}) {
  const { lang } = useI18n();
  const zh = lang === 'zh';
  const { data: balance } = useClwBalance(tokenId);
  const { data: dailyCost } = useDailyCost(tokenId);
  const { data: lobster } = useLobsterState(tokenId);

  const lob = lobster as any;
  const level = Number(lob?.level ?? lob?.[13] ?? 0);
  const rarity = Number(lob?.rarity ?? lob?.[0] ?? 0);
  const courage = Number(lob?.courage ?? lob?.[2] ?? 0);
  const wisdom = Number(lob?.wisdom ?? lob?.[3] ?? 0);
  const social = Number(lob?.social ?? lob?.[4] ?? 0);
  const create = Number(lob?.create ?? lob?.[5] ?? 0);
  const grit = Number(lob?.grit ?? lob?.[6] ?? 0);

  return (
    <div className="space-y-3">
      <TerminalBox title={zh ? `当前代理主体 #${tokenId.toString()}` : `Current AI actor #${tokenId.toString()}`} bright>
        <div className="grid gap-2 md:grid-cols-3 text-xs">
          <div className="term-box p-2 space-y-1">
            <div className="term-dim">{zh ? '龙虾名称' : 'Lobster name'}</div>
            <div className="term-bright">{getLobsterName(Number(tokenId))}</div>
          </div>
          <div className="term-box p-2 space-y-1">
            <div className="term-dim">{zh ? '内部余额' : 'Internal balance'}</div>
            <div className="term-bright">{formatCLW(BigInt((balance as bigint | undefined) ?? 0n))} Claworld</div>
          </div>
          <div className="term-box p-2 space-y-1">
            <div className="term-dim">{zh ? '每日成本' : 'Daily cost'}</div>
            <div className="term-bright">{formatCLW(BigInt((dailyCost as bigint | undefined) ?? 0n))} Claworld</div>
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-2 text-xs mt-3">
          <div className="term-box p-2">
            <div className="term-dim mb-1">{zh ? '代理主体说明' : 'Actor semantics'}</div>
            <div>
              {zh
                ? '任务、PK、Battle Royale 的参赛主体都是当前选中的 NFA。owner 钱包只负责交互权限和 2M Claworld 门槛验证。'
                : 'Task, PK, and Battle Royale all execute with the selected NFA as the actor. The owner wallet is only used for interaction permission and the 2M Claworld threshold.'}
            </div>
          </div>
          <div className="term-box p-2">
            <div className="term-dim mb-1">{zh ? '当前人格向量' : 'Current personality vector'}</div>
            <div className="grid grid-cols-5 gap-1 term-bright text-[11px]">
              <span>C {courage}</span>
              <span>W {wisdom}</span>
              <span>S {social}</span>
              <span>Ct {create}</span>
              <span>G {grit}</span>
            </div>
            <div className="term-dim text-[11px] mt-1">
              {zh ? `等级 Lv.${level} / 稀有度 ${rarity}` : `Level Lv.${level} / Rarity ${rarity}`}
            </div>
          </div>
        </div>
      </TerminalBox>

      <AutonomyPanel
        tokenId={tokenId}
        ownerAddress={ownerAddress}
        clwBalance={BigInt((balance as bigint | undefined) ?? 0n)}
        dailyCost={BigInt((dailyCost as bigint | undefined) ?? 0n)}
      />
    </div>
  );
}

export function LoreContent() {
  const { address, isConnected } = useAccount();
  const { lang } = useI18n();
  const zh = lang === 'zh';
  const ownerAddress = address as Address | undefined;
  const { data: ownedTokens, isLoading } = useTokensOfOwner(ownerAddress);
  const tokens = useMemo(
    () =>
      ((ownedTokens as readonly bigint[] | undefined) ?? [])
        .map((value) => BigInt(value))
        .sort((a, b) => Number(a - b)),
    [ownedTokens]
  );
  const [selectedTokenId, setSelectedTokenId] = useState<bigint | null>(null);

  useEffect(() => {
    if (tokens.length === 0) {
      setSelectedTokenId(null);
      return;
    }
    setSelectedTokenId((current) => {
      if (current && tokens.some((tokenId) => tokenId === current)) return current;
      return tokens[0];
    });
  }, [tokens]);

  if (!isConnected || !ownerAddress) {
    return (
      <div className="p-4 space-y-3">
        <TerminalBox title={zh ? '连接钱包进入 AI 代理' : 'Connect wallet to enter AI Agent'} bright>
          <div className="space-y-3 text-xs">
            <div className="term-dim">
              {zh
                ? '这个页面已经替换为独立 AI 代理工作台。连接持有 NFA 的钱包后，可以选择龙虾、验证 2M Claworld 门槛，并开启 Task / PK / Battle Royale 代理。'
                : 'This page is now the dedicated AI agent workspace. Connect the wallet that owns your NFAs to select a lobster, validate the 2M Claworld threshold, and enable Task / PK / Battle Royale autonomy.'}
            </div>
            <div>
              <ConnectButton />
            </div>
          </div>
        </TerminalBox>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <TerminalBox title={zh ? 'AI 代理工作台' : 'AI Agent Workspace'} bright>
        <div className="space-y-3 text-xs">
          <div className="term-dim">
            {zh
              ? '这里是独立的 AI 代理页。你可以切换当前钱包下的龙虾，并分别开启任务、PK 和 Battle Royale 代理。'
              : 'This is the dedicated AI agent page. You can switch between lobsters in your wallet and enable Task, PK, and Battle Royale autonomy individually.'}
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            <div className="term-box p-2 space-y-1">
              <div className="term-dim">{zh ? '当前钱包' : 'Connected wallet'}</div>
              <div className="term-bright break-all">{ownerAddress}</div>
            </div>
            <div className="term-box p-2 space-y-1">
              <div className="term-dim">{zh ? '可控制龙虾' : 'Controllable lobsters'}</div>
              <div className="term-bright">{isLoading ? (zh ? '读取中...' : 'Loading...') : tokens.length}</div>
            </div>
            <div className="term-box p-2 space-y-1">
              <div className="term-dim">{zh ? '当前选中' : 'Current selection'}</div>
              <div className="term-bright">{selectedTokenId ? `#${selectedTokenId.toString()}` : '--'}</div>
            </div>
          </div>
        </div>
      </TerminalBox>

      <TerminalBox title={zh ? '龙虾切换' : 'Lobster switcher'}>
        {tokens.length === 0 ? (
          <div className="term-dim text-xs">
            {zh ? '当前钱包下还没有可控制的 NFA。' : 'This wallet does not currently own any controllable NFA.'}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tokens.map((tokenId) => {
              const selected = tokenId === selectedTokenId;
              return (
                <button
                  key={tokenId.toString()}
                  type="button"
                  onClick={() => setSelectedTokenId(tokenId)}
                  className={`term-btn text-xs ${selected ? 'term-btn-primary' : ''}`}
                >
                  [#{tokenId.toString()}]
                </button>
              );
            })}
          </div>
        )}
      </TerminalBox>

      {selectedTokenId ? <AiAgentWorkspace tokenId={selectedTokenId} ownerAddress={ownerAddress} /> : null}
    </div>
  );
}
