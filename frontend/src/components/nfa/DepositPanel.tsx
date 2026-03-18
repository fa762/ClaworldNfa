'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useFundBNB, useDepositCLW, useBuyAndDeposit, useCLWAllowance } from '@/contracts/hooks/useDeposit';
import { parseEther } from 'viem';
import { getBscScanTxUrl } from '@/contracts/addresses';
import { TerminalBox } from '@/components/terminal/TerminalBox';
import { nativeSymbol } from '@/lib/format';

type Tab = 'bnb' | 'clw' | 'quick';

const QUICK_BNB = ['0.01', '0.05', '0.1', '0.5'];
const QUICK_CLW = ['100', '500', '1000', '5000'];

export function DepositPanel({ tokenId }: { tokenId: bigint }) {
  const { address, isConnected } = useAccount();
  const [tab, setTab] = useState<Tab>('bnb');
  const [amount, setAmount] = useState('');

  const fundBNB = useFundBNB();
  const depositCLW = useDepositCLW();
  const buyAndDeposit = useBuyAndDeposit();
  const { data: allowance } = useCLWAllowance(address);

  if (!isConnected) {
    return (
      <TerminalBox title="充值">
        <div className="term-dim text-sm py-4 text-center">
          连接钱包以进行充值
        </div>
      </TerminalBox>
    );
  }

  const tabs: { key: Tab; label: string; disabled?: boolean }[] = [
    { key: 'bnb', label: nativeSymbol },
    { key: 'clw', label: 'CLW' },
    { key: 'quick', label: `${nativeSymbol}→CLW`, disabled: !buyAndDeposit.graduated },
  ];

  const isPending = fundBNB.isPending || depositCLW.isPending || buyAndDeposit.isPending;
  const isConfirming = fundBNB.isConfirming || depositCLW.isConfirming || buyAndDeposit.isConfirming;
  const hash = fundBNB.hash || depositCLW.hash || buyAndDeposit.hash;
  const quickAmounts = tab === 'clw' ? QUICK_CLW : QUICK_BNB;

  function handleSubmit() {
    if (!amount || Number(amount) <= 0) return;
    switch (tab) {
      case 'bnb': fundBNB.fundAgent(tokenId, amount); break;
      case 'clw':
        if (allowance !== undefined && allowance < parseEther(amount)) {
          depositCLW.approveCLW(amount);
        } else {
          depositCLW.depositCLW(tokenId, amount);
        }
        break;
      case 'quick': buyAndDeposit.buyAndDeposit(tokenId, amount); break;
    }
  }

  return (
    <TerminalBox title="充值">
      <div className="space-y-3">
        {/* Mode selector */}
        <div className="flex gap-2 text-xs">
          <span className="term-dim">&gt; 模式:</span>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => { if (!t.disabled) { setTab(t.key); setAmount(''); } }}
              disabled={t.disabled}
              className={
                tab === t.key
                  ? 'term-bright glow'
                  : t.disabled
                  ? 'term-darkest cursor-not-allowed'
                  : 'term-dim hover:text-crt-green'
              }
            >
              [{t.key === tab ? `> ${t.label}` : t.label}]
              {t.disabled && <span className="term-darkest ml-0.5">(待毕业)</span>}
            </button>
          ))}
        </div>

        {/* Quick amounts */}
        <div className="flex gap-2 text-xs">
          <span className="term-dim">&gt; 快选:</span>
          {quickAmounts.map((qa) => (
            <button
              key={qa}
              onClick={() => setAmount(qa)}
              className={amount === qa ? 'term-bright glow' : 'term-link'}
            >
              [{qa}]
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <span className="term-dim text-sm mt-1">&gt;</span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={tab === 'clw' ? 'CLW 数量' : `${nativeSymbol} 数量`}
            className="term-input flex-1 text-sm"
            min="0"
            step="0.01"
          />
          <button
            onClick={handleSubmit}
            disabled={isPending || isConfirming || !amount}
            className="term-btn term-btn-primary text-sm"
          >
            [{isPending ? '签名...' : isConfirming ? '确认中...' : '确认充值'}]
          </button>
        </div>

        {/* Warnings */}
        {tab === 'clw' && allowance !== undefined && amount && parseEther(amount) > allowance && (
          <div className="term-warn text-xs">[!] 需要先授权 CLW，将弹出两次交易</div>
        )}

        {hash && (
          <a href={getBscScanTxUrl(hash)} target="_blank" rel="noopener noreferrer" className="term-link text-xs">
            [查看交易 →]
          </a>
        )}
      </div>
    </TerminalBox>
  );
}
