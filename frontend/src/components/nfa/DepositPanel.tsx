'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useFundBNB, useDepositCLW, useBuyAndDeposit, useCLWAllowance } from '@/contracts/hooks/useDeposit';
import { parseEther } from 'viem';
import { getBscScanTxUrl } from '@/contracts/addresses';

type Tab = 'bnb' | 'clw' | 'quick';

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
      <div className="bg-card-dark rounded-xl border border-white/10 p-6 text-center text-gray-500">
        连接钱包后可进行充值操作
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'bnb', label: '充 BNB' },
    { key: 'clw', label: '充 CLW' },
    { key: 'quick', label: `一键 BNB→CLW${buyAndDeposit.graduated ? '' : ' (待毕业)'}` },
  ];

  const isPending = fundBNB.isPending || depositCLW.isPending || buyAndDeposit.isPending;
  const isConfirming = fundBNB.isConfirming || depositCLW.isConfirming || buyAndDeposit.isConfirming;
  const hash = fundBNB.hash || depositCLW.hash || buyAndDeposit.hash;

  function handleSubmit() {
    if (!amount || Number(amount) <= 0) return;

    switch (tab) {
      case 'bnb':
        fundBNB.fundAgent(tokenId, amount);
        break;
      case 'clw':
        if (allowance !== undefined && allowance < parseEther(amount)) {
          depositCLW.approveCLW(amount);
        } else {
          depositCLW.depositCLW(tokenId, amount);
        }
        break;
      case 'quick':
        buyAndDeposit.buyAndDeposit(tokenId, amount);
        break;
    }
  }

  return (
    <div className="bg-card-dark rounded-xl border border-white/10 p-6">
      <h3 className="text-sm font-medium text-mythic-white mb-4">充值</h3>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-navy rounded-lg p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setAmount(''); }}
            className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${
              tab === t.key
                ? 'bg-abyss-orange/20 text-abyss-orange'
                : 'text-gray-500 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Amount input */}
      <div className="flex gap-2 mb-4">
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={tab === 'clw' ? 'CLW 数量' : 'BNB 数量'}
          className="flex-1 bg-navy border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-abyss-orange outline-none"
          min="0"
          step="0.01"
        />
        <button
          onClick={handleSubmit}
          disabled={isPending || isConfirming || !amount || (tab === 'quick' && !buyAndDeposit.graduated)}
          className="px-4 py-2 bg-abyss-orange text-white text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-abyss-orange/80 transition-colors"
        >
          {isPending ? '签名中...' : isConfirming ? '确认中...' : '确认'}
        </button>
      </div>

      {/* CLW approve hint */}
      {tab === 'clw' && allowance !== undefined && amount && parseEther(amount) > allowance && (
        <p className="text-xs text-yellow-500 mb-2">
          需要先授权 CLW，点击确认后会弹出两次交易
        </p>
      )}

      {/* Transaction link */}
      {hash && (
        <a
          href={getBscScanTxUrl(hash)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-tech-blue hover:underline"
        >
          查看交易 →
        </a>
      )}
    </div>
  );
}
