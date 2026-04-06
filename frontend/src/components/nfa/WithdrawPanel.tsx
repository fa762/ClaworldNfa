'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { formatEther, parseEther } from 'viem';

import { addresses, getBscScanTxUrl } from '@/contracts/addresses';
import { ClawRouterABI } from '@/contracts/abis/ClawRouter';
import { useClwBalance, useWithdrawCooldown, useWithdrawRequest } from '@/contracts/hooks/useClawRouter';
import { TerminalBox } from '@/components/terminal/TerminalBox';
import { useI18n } from '@/lib/i18n';

interface WithdrawPanelProps {
  tokenId: bigint;
  ownerAddress: string;
}

export function WithdrawPanel({ tokenId, ownerAddress }: WithdrawPanelProps) {
  const { address } = useAccount();
  const { lang } = useI18n();
  const cn = lang === 'zh';
  const [amount, setAmount] = useState('');
  const [now, setNow] = useState(Date.now());

  const { data: clwBalance } = useClwBalance(tokenId);
  const { data: withdrawRequest } = useWithdrawRequest(tokenId);
  const { data: cooldown } = useWithdrawCooldown();

  const { data: hash, writeContract, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const isOwner = !!address && !!ownerAddress && address.toLowerCase() === ownerAddress.toLowerCase();
  if (!isOwner) return null;

  const balance = clwBalance ? Number(formatEther(clwBalance)) : 0;
  const reqAmount = withdrawRequest ? Number(formatEther((withdrawRequest as any).amount ?? withdrawRequest[0] ?? 0n)) : 0;
  const reqTime = withdrawRequest ? Number((withdrawRequest as any).requestTime ?? withdrawRequest[1] ?? 0n) * 1000 : 0;
  const cooldownMs = cooldown ? Number(cooldown) * 1000 : 6 * 60 * 60 * 1000;
  const unlockAt = reqTime > 0 ? reqTime + cooldownMs : 0;
  const remainingMs = unlockAt > now ? unlockAt - now : 0;
  const hasPending = reqAmount > 0;

  const validAmount = useMemo(() => {
    const num = Number(amount);
    return !!amount && !Number.isNaN(num) && num > 0 && num <= balance;
  }, [amount, balance]);

  useEffect(() => {
    if (!hasPending) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [hasPending]);

  function requestWithdraw() {
    if (!validAmount) return;
    writeContract({
      address: addresses.clawRouter,
      abi: ClawRouterABI,
      functionName: 'requestWithdrawCLW',
      args: [tokenId, parseEther(amount)],
      gas: 180000n,
    });
  }

  function claimWithdraw() {
    writeContract({
      address: addresses.clawRouter,
      abi: ClawRouterABI,
      functionName: 'claimWithdrawCLW',
      args: [tokenId],
      gas: 180000n,
    });
  }

  function cancelWithdraw() {
    writeContract({
      address: addresses.clawRouter,
      abi: ClawRouterABI,
      functionName: 'cancelWithdraw',
      args: [tokenId],
      gas: 160000n,
    });
  }

  const remainingLabel = remainingMs > 0
    ? `${Math.floor(remainingMs / 3600000)}h ${Math.floor((remainingMs % 3600000) / 60000)}m ${Math.floor((remainingMs % 60000) / 1000)}s`
    : (cn ? '可领取' : 'Claim ready');

  return (
    <TerminalBox title={cn ? '提现' : 'Withdraw'}>
      <div className="space-y-3 text-sm">
        <div className="text-xs term-dim">
          {cn ? '只允许当前 NFA 拥有者提现。提现会先锁定额度，6 小时后才能领取真实 Clawworld。' : 'Only the current NFA owner can withdraw. Withdrawal locks the amount first, then releases real Clawworld after 6 hours.'}
        </div>

        <div className="text-xs term-dim">
          {cn ? '当前可提现余额' : 'Withdrawable balance'}: <span className="term-bright">{balance.toFixed(2)} Clawworld</span>
        </div>

        {!hasPending ? (
          <>
            <div className="flex gap-2">
              <span className="term-dim text-sm mt-1">&gt;</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={cn ? '提现数量' : 'Withdraw amount'}
                className="term-input flex-1 text-sm"
                min="0"
                step="0.01"
              />
              <button
                onClick={requestWithdraw}
                disabled={!validAmount || isPending || isConfirming}
                className="term-btn term-btn-primary text-sm"
              >
                [{isPending ? (cn ? '签名...' : 'Signing...') : isConfirming ? (cn ? '确认中...' : 'Confirming...') : (cn ? '发起提现' : 'Request')}]
              </button>
            </div>
            {!!amount && !validAmount && (
              <div className="term-warn text-xs">
                {cn ? '请输入有效数量，且不能超过当前可提现余额。' : 'Enter a valid amount not exceeding the current withdrawable balance.'}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-2 border border-crt-darkest p-3">
            <div className="text-xs term-dim">
              {cn ? '待提现申请' : 'Pending withdrawal'}: <span className="term-bright">{reqAmount.toFixed(2)} Clawworld</span>
            </div>
            <div className="text-xs term-dim">
              {cn ? '冷却剩余' : 'Cooldown remaining'}: <span className={remainingMs > 0 ? 'term-warn' : 'text-crt-green'}>{remainingLabel}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={claimWithdraw}
                disabled={remainingMs > 0 || isPending || isConfirming}
                className="term-btn term-btn-primary text-sm"
              >
                [{cn ? '领取' : 'Claim'}]
              </button>
              <button
                onClick={cancelWithdraw}
                disabled={isPending || isConfirming}
                className="term-btn text-sm"
              >
                [{cn ? '取消申请' : 'Cancel'}]
              </button>
            </div>
          </div>
        )}

        {hash && (
          <a href={getBscScanTxUrl(hash)} target="_blank" rel="noopener noreferrer" className="term-link text-xs">
            [{cn ? '查看交易' : 'View Transaction'}]
          </a>
        )}

        {isSuccess && (
          <div className="text-xs text-crt-green">
            {cn ? '交易已确认。状态将在几秒内刷新。' : 'Transaction confirmed. Status will refresh shortly.'}
          </div>
        )}
      </div>
    </TerminalBox>
  );
}
