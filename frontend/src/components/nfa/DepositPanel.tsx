'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useFundBNB, useDepositCLW, useBuyAndDeposit, useCLWAllowance } from '@/contracts/hooks/useDeposit';
import { parseEther } from 'viem';
import { getBscScanTxUrl } from '@/contracts/addresses';
import { Wallet, ExternalLink, ArrowDownToLine } from 'lucide-react';

type Tab = 'bnb' | 'clw' | 'quick';

const QUICK_AMOUNTS_BNB = ['0.01', '0.05', '0.1', '0.5'];
const QUICK_AMOUNTS_CLW = ['100', '500', '1000', '5000'];

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
      <div className="glass-card rounded-2xl p-8 text-center">
        <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
          <Wallet size={22} className="text-gray-600" />
        </div>
        <p className="text-gray-500 text-sm mb-1">连接钱包以进行充值</p>
        <p className="text-gray-600 text-xs">支持 MetaMask 和 WalletConnect</p>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; disabled?: boolean }[] = [
    { key: 'bnb', label: '充 BNB' },
    { key: 'clw', label: '充 CLW' },
    { key: 'quick', label: 'BNB→CLW', disabled: !buyAndDeposit.graduated },
  ];

  const isPending = fundBNB.isPending || depositCLW.isPending || buyAndDeposit.isPending;
  const isConfirming = fundBNB.isConfirming || depositCLW.isConfirming || buyAndDeposit.isConfirming;
  const hash = fundBNB.hash || depositCLW.hash || buyAndDeposit.hash;

  const quickAmounts = tab === 'clw' ? QUICK_AMOUNTS_CLW : QUICK_AMOUNTS_BNB;

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
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-7 h-7 rounded-lg bg-abyss-orange/10 flex items-center justify-center">
          <ArrowDownToLine size={14} className="text-abyss-orange" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-mythic-white">充值</h3>
          <p className="text-[10px] text-gray-600">Deposit</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-surface/60 rounded-xl p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => { if (!t.disabled) { setTab(t.key); setAmount(''); } }}
            disabled={t.disabled}
            className={`flex-1 text-xs py-2.5 rounded-lg transition-all font-medium ${
              tab === t.key
                ? 'bg-abyss-orange/15 text-abyss-orange shadow-sm'
                : t.disabled
                ? 'text-gray-700 cursor-not-allowed'
                : 'text-gray-500 hover:text-white hover:bg-white/[0.03]'
            }`}
          >
            {t.label}
            {t.disabled && <span className="text-[9px] ml-1 text-gray-700">(待毕业)</span>}
          </button>
        ))}
      </div>

      {/* Quick amount buttons */}
      <div className="flex gap-2 mb-3">
        {quickAmounts.map((qa) => (
          <button
            key={qa}
            onClick={() => setAmount(qa)}
            className={`flex-1 text-[11px] py-1.5 rounded-lg border transition-all ${
              amount === qa
                ? 'border-abyss-orange/40 bg-abyss-orange/10 text-abyss-orange'
                : 'border-white/[0.06] text-gray-500 hover:text-white hover:border-white/10'
            }`}
          >
            {qa}
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
          className="flex-1 bg-surface/60 border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:border-abyss-orange/40 focus:ring-1 focus:ring-abyss-orange/15 outline-none transition-all font-mono"
          min="0"
          step="0.01"
        />
        <button
          onClick={handleSubmit}
          disabled={isPending || isConfirming || !amount || (tab === 'quick' && !buyAndDeposit.graduated)}
          className="px-6 py-3 bg-gradient-to-r from-abyss-orange to-abyss-orange-light text-white text-sm font-semibold rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-all active:scale-[0.97]"
        >
          {isPending ? '签名...' : isConfirming ? '确认...' : '确认'}
        </button>
      </div>

      {/* Hints */}
      {tab === 'clw' && allowance !== undefined && amount && parseEther(amount) > allowance && (
        <p className="text-[11px] text-yellow-500/80 mb-3 flex items-center gap-1">
          <span className="w-1 h-1 rounded-full bg-yellow-500" />
          需要先授权 CLW，点击确认后会弹出两次交易
        </p>
      )}

      {hash && (
        <a
          href={getBscScanTxUrl(hash)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-tech-blue hover:underline"
        >
          查看交易 <ExternalLink size={11} />
        </a>
      )}
    </div>
  );
}
