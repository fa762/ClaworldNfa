'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useFundBNB, useDepositCLW, useBuyAndDeposit, useCLWAllowance } from '@/contracts/hooks/useDeposit';
import { parseEther } from 'viem';
import { getBscScanTxUrl } from '@/contracts/addresses';
import { TerminalBox } from '@/components/terminal/TerminalBox';
import { nativeSymbol } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

type Tab = 'bnb' | 'clw' | 'quick';

const QUICK_BNB = ['0.01', '0.05', '0.1', '0.5'];
const QUICK_CLW = ['100', '500', '1000', '5000'];

export function DepositPanel({ tokenId }: { tokenId: bigint }) {
  const { address, isConnected } = useAccount();
  const [tab, setTab] = useState<Tab>('bnb');
  const [amount, setAmount] = useState('');
  const { t } = useI18n();

  const fundBNB = useFundBNB();
  const depositCLW = useDepositCLW();
  const buyAndDeposit = useBuyAndDeposit();
  const { data: allowance } = useCLWAllowance(address);

  if (!isConnected) {
    return (
      <TerminalBox title={t('deposit.title')}>
        <div className="term-dim text-sm py-4 text-center">
          {t('deposit.connectWallet')}
        </div>
      </TerminalBox>
    );
  }

  const isPending = fundBNB.isPending || depositCLW.isPending || buyAndDeposit.isPending;
  const isConfirming = fundBNB.isConfirming || depositCLW.isConfirming || buyAndDeposit.isConfirming;
  const hash = fundBNB.hash || depositCLW.hash || buyAndDeposit.hash;
  const quickAmounts = tab === 'clw' ? QUICK_CLW : QUICK_BNB;
  const needsClwApproval =
    tab === 'clw' &&
    !!amount &&
    Number(amount) > 0 &&
    (allowance === undefined || allowance < parseEther(amount));

  const tabs: { key: Tab; label: string; disabled?: boolean }[] = [
    { key: 'bnb', label: nativeSymbol },
    { key: 'clw', label: 'Claworld' },
    { key: 'quick', label: `${nativeSymbol}?Claworld`, disabled: !buyAndDeposit.routeReady },
  ];

  function handleSubmit() {
    const num = Number(amount);
    if (!amount || isNaN(num) || num <= 0) return;
    switch (tab) {
      case 'bnb': fundBNB.fundAgent(tokenId, amount); break;
      case 'clw':
        if (allowance === undefined || allowance < parseEther(amount)) {
          depositCLW.approveCLW(amount);
        } else {
          depositCLW.depositCLW(tokenId, amount);
        }
        break;
      case 'quick':
        if (buyAndDeposit.routeReady) buyAndDeposit.buyAndDeposit(tokenId, amount);
        break;
    }
  }

  return (
    <TerminalBox title={t('deposit.title')}>
      <div className="space-y-3">
        {/* Mode selector */}
        <div className="flex gap-2 text-xs">
          <span className="term-dim">{t('deposit.mode')}</span>
          {tabs.map((tabItem) => (
            <button
              key={tabItem.key}
              onClick={() => { if (!tabItem.disabled) { setTab(tabItem.key); setAmount(''); } }}
              disabled={tabItem.disabled}
              className={
                tab === tabItem.key
                  ? 'term-bright glow'
                  : tabItem.disabled
                  ? 'term-darkest cursor-not-allowed'
                  : 'term-dim hover:text-crt-green'
              }
            >
              [{tabItem.key === tab ? `> ${tabItem.label}` : tabItem.label}]
              {tabItem.disabled && <span className="term-darkest ml-0.5">{t('deposit.unavailable')}</span>}
            </button>
          ))}
        </div>

        {/* Quick amounts */}
        <div className="flex gap-2 text-xs">
          <span className="term-dim">{t('deposit.quick')}</span>
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
            placeholder={tab === 'clw' ? t('deposit.clwAmount') : `${nativeSymbol}${t('deposit.bnbAmount')}`}
            className="term-input flex-1 text-sm"
            min="0"
            step="0.01"
          />
          <button
            onClick={handleSubmit}
            disabled={isPending || isConfirming || !amount}
            className="term-btn term-btn-primary text-sm"
          >
            [{isPending
              ? t('deposit.signing')
              : isConfirming
              ? t('deposit.confirming')
              : needsClwApproval
              ? t('deposit.approve')
              : t('deposit.confirm')}]
          </button>
        </div>

        {/* Warnings */}
        {tab === 'clw' && allowance !== undefined && amount && parseEther(amount) > allowance && (
          <div className="term-warn text-xs">{t('deposit.needApprove')}</div>
        )}

        {tab === 'quick' && !buyAndDeposit.routeReady && (
          <div className="term-warn text-xs">{t('deposit.quickUnavailable')}</div>
        )}

        {hash && (
          <a href={getBscScanTxUrl(hash)} target="_blank" rel="noopener noreferrer" className="term-link text-xs">
            [{t('deposit.viewTx')}]
          </a>
        )}
      </div>
    </TerminalBox>
  );
}
