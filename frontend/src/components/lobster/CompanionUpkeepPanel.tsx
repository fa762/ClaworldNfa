'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Coins, Flame, Shield, Wallet } from 'lucide-react';
import { parseEther } from 'viem';
import { usePublicClient } from 'wagmi';

import {
  useBuyAndDeposit,
  useCLWAllowance,
  useCLWBalance,
  useDepositCLW,
  useProcessUpkeep,
} from '@/contracts/hooks/useDeposit';
import { ERC20ABI } from '@/contracts/abis/ERC20';
import { addresses, chainId as appChainId, getBscScanTxUrl } from '@/contracts/addresses';
import { formatCLW } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

type DepositMode = 'clw' | 'quick';

const QUICK_CLW = ['50', '100', '250', '500'];
const QUICK_BNB = ['0.01', '0.03', '0.05', '0.1'];

function parseInputAmount(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return parseEther(trimmed);
  } catch {
    return null;
  }
}

function maxBigInt(left: bigint, right: bigint) {
  return left >= right ? left : right;
}

export function CompanionUpkeepPanel({
  tokenId,
  ownerAddress,
  reserve,
  dailyCost,
  upkeepDays,
}: {
  tokenId: bigint;
  ownerAddress?: `0x${string}`;
  reserve: bigint;
  dailyCost: bigint;
  upkeepDays: number | null;
}) {
  const { pick } = useI18n();
  const [mode, setMode] = useState<DepositMode>('clw');
  const [amount, setAmount] = useState('');
  const [walletBalanceOverride, setWalletBalanceOverride] = useState<bigint | null>(null);
  const [walletBalanceOverrideError, setWalletBalanceOverrideError] = useState(false);

  const clwBalanceQuery = useCLWBalance(ownerAddress);
  const publicClient = usePublicClient({ chainId: appChainId });
  const allowanceQuery = useCLWAllowance(ownerAddress);
  const deposit = useDepositCLW();
  const quick = useBuyAndDeposit();
  const upkeep = useProcessUpkeep();

  const inputAmount = useMemo(() => parseInputAmount(amount), [amount]);
  useEffect(() => {
    let cancelled = false;

    async function loadWalletBalance() {
      if (!publicClient || !ownerAddress) {
        setWalletBalanceOverride(null);
        setWalletBalanceOverrideError(false);
        return;
      }

      try {
        const balance = await publicClient.readContract({
          address: addresses.clwToken,
          abi: ERC20ABI,
          functionName: 'balanceOf',
          args: [ownerAddress],
        });

        if (!cancelled) {
          setWalletBalanceOverride(BigInt(balance.toString()));
          setWalletBalanceOverrideError(false);
        }
      } catch (error) {
        if (!cancelled) {
          setWalletBalanceOverride(null);
          setWalletBalanceOverrideError(true);
        }
      }
    }

    void loadWalletBalance();
    return () => {
      cancelled = true;
    };
  }, [ownerAddress, publicClient]);

  const clwBalance = maxBigInt(
    BigInt((clwBalanceQuery.data as bigint | undefined) ?? 0n),
    walletBalanceOverride ?? 0n,
  );
  const allowance = BigInt(allowanceQuery.data?.toString() ?? '0');
  const needsApproval = mode === 'clw' && inputAmount !== null && allowance < inputAmount;
  const balanceReadFailed = Boolean(clwBalanceQuery.error) && walletBalanceOverrideError;
  const hasBalanceRead =
    walletBalanceOverride !== null ||
    (!clwBalanceQuery.isLoading && !balanceReadFailed);
  const hasEnoughClw =
    inputAmount === null || (hasBalanceRead && clwBalance >= inputAmount);
  const txHash = upkeep.hash || deposit.hash || quick.hash;

  const clwBalanceText = clwBalanceQuery.isLoading && walletBalanceOverride === null
    ? pick('读取中', 'Loading')
    : balanceReadFailed
      ? pick('读取失败', 'Read failed')
      : formatCLW(clwBalance);

  const modeItems: Array<{ key: DepositMode; label: string; disabled?: boolean }> = [
    { key: 'clw', label: pick('充入 Clawworld', 'Deposit Clawworld') },
    { key: 'quick', label: pick('BNB 快充', 'Quick buy+deposit'), disabled: !quick.routeReady },
  ];

  const quickPills = mode === 'clw' ? QUICK_CLW : QUICK_BNB;

  function handleSubmit() {
    if (inputAmount === null) return;

    if (mode === 'clw') {
      if (needsApproval) {
        deposit.approveCLW();
        return;
      }
      deposit.depositCLW(tokenId, amount);
      return;
    }

    if (quick.routeReady) {
      quick.buyAndDeposit(tokenId, amount);
    }
  }

  const busy = deposit.isPending || deposit.isConfirming || quick.isPending || quick.isConfirming;
  const upkeepBusy = upkeep.isPending || upkeep.isConfirming;

  return (
    <section className="cw-panel cw-panel--warm">
      <div className="cw-section-head">
        <div>
          <span className="cw-label">{pick('维护', 'Upkeep')}</span>
          <h3>{pick('补储备', 'Top up reserve')}</h3>
        </div>
        <span className={`cw-chip ${upkeepDays !== null && upkeepDays <= 1 ? 'cw-chip--alert' : 'cw-chip--warm'}`}>
          <Flame size={14} />
          {upkeepDays === null ? pick('未知', 'n/a') : pick(`续航 ${upkeepDays} 天`, `${upkeepDays}d runway`)}
        </span>
      </div>

      <div className="cw-state-grid">
        <div className="cw-state-card">
          <span className="cw-label">{pick('储备', 'Reserve')}</span>
          <strong>{formatCLW(reserve)}</strong>
        </div>
        <div className="cw-state-card">
          <span className="cw-label">{pick('日维护', 'Daily upkeep')}</span>
          <strong>{formatCLW(dailyCost)}</strong>
        </div>
        <div className="cw-state-card">
          <span className="cw-label">{pick('钱包 Claworld', 'Wallet Claworld')}</span>
          <strong>{clwBalanceText}</strong>
        </div>
      </div>

      <div className="cw-segmented">
        {modeItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`cw-segmented-btn ${mode === item.key ? 'cw-segmented-btn--active' : ''}`}
            disabled={Boolean(item.disabled) || busy}
            onClick={() => {
              setMode(item.key);
              setAmount('');
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="cw-pill-row">
        {quickPills.map((pill) => (
          <button
            key={pill}
            type="button"
            className="cw-chip cw-chip--cool"
            onClick={() => setAmount(pill)}
            disabled={busy}
          >
            {pill}
          </button>
        ))}
      </div>

      <div className="cw-inline-form">
        <label className="cw-field cw-field--inline">
          <span className="cw-label">
            {mode === 'clw' ? pick('充值数量', 'Deposit amount') : pick('花费 BNB', 'Spend BNB')}
          </span>
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="cw-input"
            inputMode="decimal"
            placeholder={mode === 'clw' ? '100' : '0.03'}
          />
        </label>

        <button
          type="button"
          className="cw-button cw-button--primary"
          disabled={
            busy ||
            inputAmount === null ||
            (mode === 'clw' && (!hasBalanceRead || !hasEnoughClw)) ||
            (mode === 'quick' && !quick.routeReady)
          }
          onClick={handleSubmit}
        >
          <Coins size={16} />
          {deposit.isPending || quick.isPending
            ? pick('等钱包签名', 'Waiting for signature')
            : deposit.isConfirming || quick.isConfirming
              ? pick('链上确认中', 'Confirming')
              : needsApproval
                ? pick('先授权', 'Approve first')
                : pick('补储备', 'Top up')}
        </button>
      </div>

      <div className="cw-button-row">
        <button
          type="button"
          className="cw-button cw-button--secondary"
          disabled={upkeepBusy}
          onClick={() => upkeep.processUpkeep(tokenId)}
        >
          <Shield size={16} />
          {upkeep.isPending
            ? pick('等钱包签名', 'Waiting for signature')
            : upkeep.isConfirming
              ? pick('处理中', 'Processing')
              : pick('结算维护', 'Process upkeep')}
        </button>
      </div>

      {((mode === 'clw' && (clwBalanceQuery.isLoading || balanceReadFailed || !hasEnoughClw)) ||
        txHash ||
        quick.error ||
        deposit.error ||
        upkeep.error) ? (
        <div className="cw-list">
          {clwBalanceQuery.isLoading && walletBalanceOverride === null ? (
            <div className="cw-list-item cw-list-item--cool">
              <Wallet size={16} />
              <span>{pick('正在读取钱包里的 Clawworld。', 'Reading wallet Claworld.')}</span>
            </div>
          ) : null}
          {balanceReadFailed ? (
            <div className="cw-list-item cw-list-item--alert">
              <Wallet size={16} />
              <span>{pick('钱包 Clawworld 读取失败，先别提交。', 'Wallet Claworld read failed. Hold before submitting.')}</span>
            </div>
          ) : null}
          {!hasEnoughClw && hasBalanceRead ? (
            <div className="cw-list-item cw-list-item--cool">
              <Wallet size={16} />
              <span>
                {pick(
                  `钱包里只有 ${formatCLW(clwBalance)} Claworld，不足 ${amount || '0'}。`,
                  `Wallet balance ${formatCLW(clwBalance)} Claworld is below ${amount || '0'}.`,
                )}
              </span>
            </div>
          ) : null}
          {txHash ? (
            <div className="cw-list-item cw-list-item--warm">
              <ArrowUpRight size={16} />
              <a href={getBscScanTxUrl(txHash)} target="_blank" rel="noreferrer" className="cw-inline-link">
                {pick('查看交易', 'View transaction')}
              </a>
            </div>
          ) : null}
          {quick.error ? <p className="cw-muted">{quick.error.message}</p> : null}
          {deposit.error ? <p className="cw-muted">{deposit.error.message}</p> : null}
          {upkeep.error ? <p className="cw-muted">{upkeep.error.message}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
