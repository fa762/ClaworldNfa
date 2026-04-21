'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Coins, Flame, Wallet } from 'lucide-react';
import { parseEther } from 'viem';

import type { ActiveCompanionValue } from '@/components/lobster/useActiveCompanion';
import { useWithdrawCooldown, useWithdrawRequest } from '@/contracts/hooks/useClawRouter';
import {
  useBuyAndDeposit,
  useCLWAllowance,
  useCLWBalance,
  useDepositCLW,
  useProcessUpkeep,
  useWithdrawCLW,
} from '@/contracts/hooks/useDeposit';
import { getBscScanTxUrl } from '@/contracts/addresses';
import { formatCLW } from '@/lib/format';
import type { TerminalCard } from '@/lib/terminal-cards';

import styles from './TerminalHome.module.css';

type BalanceMode = 'deposit' | 'withdraw';
type DepositMode = 'clw' | 'quick';

function parseAmount(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return parseEther(trimmed);
  } catch {
    return null;
  }
}

function readWithdrawAmount(value: readonly [bigint, bigint] | { amount?: bigint; requestTime?: bigint } | undefined) {
  if (!value) return 0n;
  if (Array.isArray(value)) return value[0] ?? 0n;
  return (value as { amount?: bigint }).amount ?? 0n;
}

function readWithdrawRequestTime(value: readonly [bigint, bigint] | { amount?: bigint; requestTime?: bigint } | undefined) {
  if (!value) return 0;
  if (Array.isArray(value)) return Number(value[1] ?? 0n);
  return Number((value as { requestTime?: bigint }).requestTime ?? 0n);
}

function formatCooldown(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}小时 ${minutes}分`;
  if (minutes > 0) return `${minutes}分 ${seconds}秒`;
  return `${seconds}秒`;
}

export function TerminalFinancePanel({
  companion,
  onClose,
  onReceipt,
}: {
  companion: ActiveCompanionValue;
  onClose: () => void;
  onReceipt: (card: TerminalCard) => void;
}) {
  const [balanceMode, setBalanceMode] = useState<BalanceMode>('deposit');
  const [depositMode, setDepositMode] = useState<DepositMode>('clw');
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [now, setNow] = useState(Date.now());

  const allowanceQuery = useCLWAllowance(companion.ownerAddress);
  const walletBalanceQuery = useCLWBalance(companion.ownerAddress);
  const deposit = useDepositCLW();
  const quick = useBuyAndDeposit();
  const upkeep = useProcessUpkeep();
  const withdraw = useWithdrawCLW();
  const withdrawRequestQuery = useWithdrawRequest(companion.tokenId);
  const withdrawCooldownQuery = useWithdrawCooldown();

  const depositInput = useMemo(() => parseAmount(depositAmount), [depositAmount]);
  const withdrawInput = useMemo(() => parseAmount(withdrawAmount), [withdrawAmount]);
  const allowance = BigInt(allowanceQuery.data?.toString() ?? '0');
  const walletBalance = BigInt(walletBalanceQuery.data?.toString() ?? '0');
  const needsApproval = depositMode === 'clw' && depositInput !== null && allowance < depositInput;
  const hasEnoughWallet = depositInput === null || walletBalance >= depositInput;
  const hasEnoughReserve = withdrawInput === null || withdrawInput <= companion.routerClaworld;

  const withdrawRequest = withdrawRequestQuery.data as readonly [bigint, bigint] | { amount?: bigint; requestTime?: bigint } | undefined;
  const pendingWithdrawAmount = readWithdrawAmount(withdrawRequest);
  const withdrawRequestTime = readWithdrawRequestTime(withdrawRequest);
  const withdrawCooldownSeconds = Number(withdrawCooldownQuery.data ?? 0n);
  const withdrawUnlockAt =
    pendingWithdrawAmount > 0n && withdrawRequestTime > 0 && withdrawCooldownSeconds > 0
      ? (withdrawRequestTime + withdrawCooldownSeconds) * 1000
      : 0;
  const withdrawRemainingMs = withdrawUnlockAt > now ? withdrawUnlockAt - now : 0;
  const withdrawReady = pendingWithdrawAmount > 0n && withdrawRemainingMs <= 0;

  const handledTxsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (pendingWithdrawAmount <= 0n) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [pendingWithdrawAmount]);

  useEffect(() => {
    const items = [
      {
        ok: deposit.isSuccess,
        hash: deposit.hash,
        card: {
          id: `finance-deposit-${deposit.hash}`,
          type: 'receipt' as const,
          label: '资金回执',
          title: '充值已确认',
          body: `已把 ${depositAmount || '这一笔 Claworld'} 充进 #${companion.tokenNumber} 的记账账户。`,
          details: [
            { label: '模式', value: depositMode === 'quick' ? 'BNB 快充' : 'Claworld 充值', tone: 'cool' as const },
            { label: 'NFA', value: `#${companion.tokenNumber}` },
            { label: '交易', value: deposit.hash ? getBscScanTxUrl(deposit.hash) : '--' },
          ],
        },
      },
      {
        ok: quick.isSuccess,
        hash: quick.hash,
        card: {
          id: `finance-quick-${quick.hash}`,
          type: 'receipt' as const,
          label: '资金回执',
          title: '快充已确认',
          body: `BNB 已换成 Claworld，并充进 #${companion.tokenNumber} 的记账账户。`,
          details: [
            { label: '模式', value: 'BNB 快充', tone: 'warm' as const },
            { label: '花费', value: depositAmount || '--' },
            { label: '交易', value: quick.hash ? getBscScanTxUrl(quick.hash) : '--' },
          ],
        },
      },
      {
        ok: upkeep.isSuccess,
        hash: upkeep.hash,
        card: {
          id: `finance-upkeep-${upkeep.hash}`,
          type: 'receipt' as const,
          label: '资金回执',
          title: '维护已结算',
          body: `#${companion.tokenNumber} 的日维护已经处理完成。`,
          details: [
            { label: '储备', value: companion.routerClaworldText, tone: 'warm' as const },
            { label: '日维护', value: companion.dailyCostText },
            { label: '交易', value: upkeep.hash ? getBscScanTxUrl(upkeep.hash) : '--' },
          ],
        },
      },
      {
        ok: withdraw.isSuccess,
        hash: withdraw.hash,
        card: {
          id: `finance-withdraw-${withdraw.hash}`,
          type: 'receipt' as const,
          label: '资金回执',
          title: withdrawReady ? '提现已领取' : '提现请求已发起',
          body: withdrawReady ? '这笔提现已经回到主钱包。' : '提现请求已经锁定，倒计时结束后就能领取。',
          details: [
            { label: 'NFA', value: `#${companion.tokenNumber}` },
            { label: '金额', value: withdrawAmount || (pendingWithdrawAmount > 0n ? formatCLW(pendingWithdrawAmount) : '--'), tone: 'growth' as const },
            { label: '交易', value: withdraw.hash ? getBscScanTxUrl(withdraw.hash) : '--' },
          ],
        },
      },
    ];

    for (const item of items) {
      if (!item.ok || !item.hash || handledTxsRef.current.has(item.hash)) continue;
      handledTxsRef.current.add(item.hash);
      onReceipt(item.card);
    }
  }, [
    companion.dailyCostText,
    companion.routerClaworldText,
    companion.tokenNumber,
    deposit.hash,
    deposit.isSuccess,
    depositAmount,
    depositMode,
    onReceipt,
    pendingWithdrawAmount,
    quick.hash,
    quick.isSuccess,
    upkeep.hash,
    upkeep.isSuccess,
    withdraw.hash,
    withdraw.isSuccess,
    withdrawAmount,
    withdrawReady,
  ]);

  return (
    <section className={styles.inlinePanel}>
      <div className={styles.inlineHead}>
        <div className={styles.inlineHeadActions}>
          <button type="button" className={styles.panelButton} onClick={onClose}>
            返回
          </button>
        </div>
        <div>
          <span>资金</span>
          <strong>充值、提现、维护都在这里</strong>
        </div>
      </div>

      <div className={styles.inlineSummary}>
        <div>
          <span>储备</span>
          <strong>{companion.routerClaworldText}</strong>
        </div>
        <div>
          <span>钱包</span>
          <strong>{formatCLW(walletBalance)} Claworld</strong>
        </div>
        <div>
          <span>日维护</span>
          <strong>{companion.dailyCostText}</strong>
        </div>
        <div>
          <span>续航</span>
          <strong>{companion.upkeepDays === null ? '--' : `${companion.upkeepDays} 天`}</strong>
        </div>
      </div>

      <div className={styles.inlineActions}>
        <button
          type="button"
          className={balanceMode === 'deposit' ? styles.primaryPanelButton : styles.panelButton}
          onClick={() => setBalanceMode('deposit')}
        >
          <ArrowUpRight size={16} />
          充值
        </button>
        <button
          type="button"
          className={balanceMode === 'withdraw' ? styles.primaryPanelButton : styles.panelButton}
          onClick={() => setBalanceMode('withdraw')}
        >
          <ArrowDownLeft size={16} />
          提现
        </button>
        <button type="button" className={styles.panelButton} onClick={() => upkeep.processUpkeep(companion.tokenId)} disabled={upkeep.isPending || upkeep.isConfirming}>
          <Flame size={16} />
          {upkeep.isPending ? '等待签名' : upkeep.isConfirming ? '确认中' : '结算维护'}
        </button>
      </div>

      {balanceMode === 'deposit' ? (
        <>
          <div className={styles.inlineActions}>
            <button
              type="button"
              className={depositMode === 'clw' ? styles.primaryPanelButton : styles.panelButton}
              onClick={() => setDepositMode('clw')}
            >
              <Coins size={16} />
              Claworld
            </button>
            <button
              type="button"
              className={depositMode === 'quick' ? styles.primaryPanelButton : styles.panelButton}
              onClick={() => setDepositMode('quick')}
            >
              <Wallet size={16} />
              BNB 快充
            </button>
          </div>

          <label className={styles.compactField}>
            <span>{depositMode === 'quick' ? '输入花费 BNB' : '输入充值 Claworld'}</span>
            <input
              className={styles.compactInput}
              inputMode="decimal"
              placeholder={depositMode === 'quick' ? '0.03' : '100'}
              value={depositAmount}
              onChange={(event) => setDepositAmount(event.target.value)}
            />
          </label>

          <div className={styles.inlineSummary}>
            <div>
              <span>模式</span>
              <strong>{depositMode === 'quick' ? 'BNB 快充' : 'Claworld 直充'}</strong>
            </div>
            <div>
              <span>授权</span>
              <strong>{depositMode === 'quick' ? '不需要' : needsApproval ? '需要先授权' : '已经就绪'}</strong>
            </div>
            <div>
              <span>钱包余额</span>
              <strong>{formatCLW(walletBalance)} Claworld</strong>
            </div>
            <div>
              <span>结果</span>
              <strong>回执会直接回到底部</strong>
            </div>
          </div>

          <div className={styles.inlineActions}>
            <button
              type="button"
              className={styles.primaryPanelButton}
              disabled={
                depositMode === 'quick'
                  ? quick.isPending || quick.isConfirming || depositInput === null || !quick.routeReady
                  : deposit.isPending || deposit.isConfirming || depositInput === null || !hasEnoughWallet
              }
              onClick={() => {
                if (depositInput === null) return;
                if (depositMode === 'quick') {
                  quick.buyAndDeposit(companion.tokenId, depositAmount);
                  return;
                }
                if (needsApproval) {
                  deposit.approveCLW();
                  return;
                }
                deposit.depositCLW(companion.tokenId, depositAmount);
              }}
            >
              {depositMode === 'quick'
                ? quick.isPending
                  ? '等待签名'
                  : quick.isConfirming
                    ? '确认中'
                    : '充值到 NFA'
                : deposit.isPending
                  ? '等待签名'
                  : deposit.isConfirming
                    ? '确认中'
                    : needsApproval
                      ? '先授权 Claworld'
                      : '充值到 NFA'}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className={styles.inlineSummary}>
            <div>
              <span>可提现</span>
              <strong>{formatCLW(companion.routerClaworld)} Claworld</strong>
            </div>
            <div>
              <span>待提现</span>
              <strong>{pendingWithdrawAmount > 0n ? `${formatCLW(pendingWithdrawAmount)} Claworld` : '--'}</strong>
            </div>
            <div>
              <span>状态</span>
              <strong>{pendingWithdrawAmount > 0n ? (withdrawReady ? '可以领取' : formatCooldown(withdrawRemainingMs)) : '先发起提现'}</strong>
            </div>
            <div>
              <span>去向</span>
              <strong>主钱包</strong>
            </div>
          </div>

          {pendingWithdrawAmount > 0n ? (
            <div className={styles.inlineActions}>
              <button
                type="button"
                className={styles.primaryPanelButton}
                disabled={!withdrawReady || withdraw.isPending || withdraw.isConfirming}
                onClick={() => withdraw.claimWithdraw(companion.tokenId)}
              >
                {withdraw.isPending ? '等待签名' : withdraw.isConfirming ? '确认中' : '领取提现'}
              </button>
              <button type="button" className={styles.panelButton} disabled={withdraw.isPending || withdraw.isConfirming} onClick={() => withdraw.cancelWithdraw(companion.tokenId)}>
                取消提现
              </button>
            </div>
          ) : (
            <>
              <label className={styles.compactField}>
                <span>输入提现数量</span>
                <input
                  className={styles.compactInput}
                  inputMode="decimal"
                  placeholder="100"
                  value={withdrawAmount}
                  onChange={(event) => setWithdrawAmount(event.target.value)}
                />
              </label>

              <div className={styles.inlineActions}>
                <button
                  type="button"
                  className={styles.primaryPanelButton}
                  disabled={withdraw.isPending || withdraw.isConfirming || withdrawInput === null || !hasEnoughReserve}
                  onClick={() => withdraw.requestWithdraw(companion.tokenId, withdrawAmount)}
                >
                  {withdraw.isPending ? '等待签名' : withdraw.isConfirming ? '确认中' : '发起提现'}
                </button>
              </div>
            </>
          )}
        </>
      )}

      {deposit.error ? <p className={styles.panelError}>{deposit.error.message}</p> : null}
      {quick.error ? <p className={styles.panelError}>{quick.error.message}</p> : null}
      {upkeep.error ? <p className={styles.panelError}>{upkeep.error.message}</p> : null}
      {withdraw.error ? <p className={styles.panelError}>{withdraw.error.message}</p> : null}
      {!hasEnoughWallet && balanceMode === 'deposit' && depositMode === 'clw' && depositInput !== null ? (
        <p className={styles.panelError}>钱包里的 Claworld 不够这次充值。</p>
      ) : null}
      {!hasEnoughReserve && balanceMode === 'withdraw' && withdrawInput !== null ? (
        <p className={styles.panelError}>NFA 储备不够这次提现。</p>
      ) : null}
      {depositMode === 'quick' && !quick.routeReady ? (
        <p className={styles.inlineNote}>当前还没开通 BNB 快充路由，先用 Claworld 直充更稳。</p>
      ) : null}
    </section>
  );
}
