'use client';

import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { isAddress } from 'viem';
import { contracts } from '@/contracts/addresses';
import { ClawNFAABI } from '@/contracts/abis/ClawNFA';
import { TerminalBox } from '@/components/terminal/TerminalBox';
import { getBscScanTxUrl } from '@/contracts/addresses';
import { useI18n } from '@/lib/i18n';

interface TransferToOpenClawProps {
  tokenId: bigint;
  ownerAddress: string;
}

export function TransferToOpenClaw({ tokenId, ownerAddress }: TransferToOpenClawProps) {
  const { address } = useAccount();
  const { t } = useI18n();
  const [openClawAddress, setOpenClawAddress] = useState('');
  const [step, setStep] = useState<'input' | 'confirm' | 'done'>('input');

  const { data: hash, writeContract, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // Only show to the NFA owner
  const isOwner = address && ownerAddress && address.toLowerCase() === ownerAddress.toLowerCase();
  if (!isOwner) return null;

  const isValidTarget = isAddress(openClawAddress) &&
    openClawAddress.toLowerCase() !== address?.toLowerCase();

  function handleTransfer() {
    if (!isValidTarget || !address) return;
    writeContract({
      address: contracts.clawNFA as `0x${string}`,
      abi: ClawNFAABI,
      functionName: 'transferFrom',
      args: [address, openClawAddress as `0x${string}`, tokenId],
    });
    setStep('confirm');
  }

  if (isSuccess && step === 'confirm') {
    setStep('done');
  }

  return (
    <TerminalBox title={t('transfer.title') || '转移到 OpenClaw'}>
      {step === 'done' ? (
        <div className="space-y-2">
          <div className="text-crt-green text-sm glow">
            {t('transfer.success') || '✅ 龙虾已转移到 OpenClaw！'}
          </div>
          <div className="text-xs term-dim">
            {t('transfer.successHint') || '现在打开 OpenClaw，安装 claw-world skill，开始和你的龙虾对话吧！'}
          </div>
          <div className="text-xs term-dim">
            {t('transfer.openclawInstall') || '安装命令: openclaw skills install claw-world'}
          </div>
          {hash && (
            <a href={getBscScanTxUrl(hash)} target="_blank" rel="noopener noreferrer" className="term-link text-xs">
              [{t('transfer.viewTx') || '查看交易'}]
            </a>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Step 1: Explanation */}
          <div className="text-xs term-dim leading-relaxed">
            {t('transfer.explain') || '将龙虾转移到你的 OpenClaw 本地钱包，让它成为真正的链上智能体。转移后，龙虾将在 OpenClaw 中自主行动——做任务、PK、交易。'}
          </div>

          {/* Step 2: How to get OpenClaw address */}
          <div className="text-xs space-y-1">
            <div className="term-bright">{t('transfer.howTo') || '如何获取 OpenClaw 地址：'}</div>
            <div className="term-dim pl-2">1. {t('transfer.step1') || '安装 OpenClaw: npm install -g openclaw'}</div>
            <div className="term-dim pl-2">2. {t('transfer.step2') || '安装 Skill: openclaw skills install claw-world'}</div>
            <div className="term-dim pl-2">3. {t('transfer.step3') || '在对话中输入 /wallet 查看你的 OpenClaw 钱包地址'}</div>
          </div>

          <div className="term-line my-2" />

          {/* Step 3: Input address */}
          <div className="flex gap-2">
            <span className="term-dim text-sm mt-1">&gt;</span>
            <input
              type="text"
              value={openClawAddress}
              onChange={(e) => setOpenClawAddress(e.target.value)}
              placeholder={t('transfer.placeholder') || 'OpenClaw 钱包地址 (0x...)'}
              className="term-input flex-1 text-xs"
            />
          </div>

          {/* Validation */}
          {openClawAddress && !isValidTarget && (
            <div className="term-danger text-xs">
              {openClawAddress.toLowerCase() === address?.toLowerCase()
                ? (t('transfer.sameAddress') || '不能转给自己')
                : (t('transfer.invalidAddress') || '无效地址')}
            </div>
          )}

          {/* Confirm button */}
          {step === 'input' && (
            <button
              onClick={handleTransfer}
              disabled={!isValidTarget || isPending}
              className="term-btn term-btn-primary text-xs w-full"
            >
              [{isPending
                ? (t('transfer.signing') || '签名中...')
                : (t('transfer.confirm') || `确认转移 NFA #${tokenId} 到 OpenClaw`)}]
            </button>
          )}

          {step === 'confirm' && isConfirming && (
            <div className="text-xs term-dim animate-glow-pulse">
              {t('transfer.confirming') || '链上确认中...'}<span className="animate-blink ml-1">█</span>
            </div>
          )}

          {/* Warning */}
          <div className="text-xs term-warn">
            {t('transfer.warning') || '⚠ 转移后此钱包将失去龙虾所有权。请确认 OpenClaw 地址正确。'}
          </div>
        </div>
      )}
    </TerminalBox>
  );
}
