'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Coins, RefreshCw, ShoppingCart, Tag, Wallet } from 'lucide-react';
import { formatEther, parseEther } from 'viem';
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';

import type { ActiveCompanionValue } from '@/components/lobster/useActiveCompanion';
import { ClawNFAABI } from '@/contracts/abis/ClawNFA';
import { addresses, getBscScanTxUrl } from '@/contracts/addresses';
import { marketBuyArgs, marketCancelArgs, marketListArgs, marketSettleAuctionArgs, nfaApproveArgs } from '@/game/chain/contracts';
import { loadMarketListings, type MarketListing } from '@/game/chain/wallet';
import type { TerminalCard } from '@/lib/terminal-cards';

import styles from './TerminalHome.module.css';

function listingMode(type: number) {
  if (type === 0) return '固定价';
  if (type === 1) return '拍卖';
  return '互换';
}

function listingValue(listing: MarketListing) {
  if (listing.listingType === 1 && listing.highestBid > 0n) {
    return `${Number(formatEther(listing.highestBid)).toFixed(3)} BNB`;
  }
  if (listing.listingType === 2) {
    return `换 #${listing.swapTargetId}`;
  }
  return `${Number(formatEther(listing.price)).toFixed(3)} BNB`;
}

function parsePrice(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return parseEther(trimmed);
  } catch {
    return null;
  }
}

export function TerminalMarketPanel({
  companion,
  onClose,
  onReceipt,
}: {
  companion: ActiveCompanionValue;
  onClose: () => void;
  onReceipt: (card: TerminalCard) => void;
}) {
  const { address } = useAccount();
  const [priceInput, setPriceInput] = useState('');
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingLabel, setPendingLabel] = useState('');

  const { data: hash, error: writeError, isPending, writeContract } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });
  const handledTxsRef = useRef<Set<string>>(new Set());

  const approvedNfaQuery = useReadContract({
    address: addresses.clawNFA,
    abi: ClawNFAABI,
    functionName: 'getApproved',
    args: [companion.tokenId],
    query: { enabled: companion.hasToken },
  });

  const isApproved = useMemo(() => {
    const approved = approvedNfaQuery.data;
    if (!approved || typeof approved !== 'string') return false;
    return approved.toLowerCase() === addresses.marketSkill.toLowerCase();
  }, [approvedNfaQuery.data]);

  const myListings = useMemo(() => {
    if (!address) return [];
    return listings.filter((item) => item.seller.toLowerCase() === address.toLowerCase());
  }, [address, listings]);

  async function refreshListings() {
    setLoading(true);
    setError(null);
    try {
      const next = await loadMarketListings();
      setListings(next.slice(0, 12));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '市场读取失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshListings();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshListings();
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!receipt.isSuccess || !hash || handledTxsRef.current.has(hash)) return;
    handledTxsRef.current.add(hash);
    void refreshListings();
    onReceipt({
      id: `market-${hash}`,
      type: 'receipt',
      label: '市场回执',
      title: pendingLabel || '市场动作已确认',
      body: '市场动作已经上链，列表也刷新了。',
      details: [
        { label: '当前 NFA', value: `#${companion.tokenNumber}` },
        { label: '动作', value: pendingLabel || '市场操作', tone: 'warm' },
        { label: '交易', value: getBscScanTxUrl(hash) },
      ],
    });
  }, [companion.tokenNumber, hash, onReceipt, pendingLabel, receipt.isSuccess]);

  const priceValue = useMemo(() => parsePrice(priceInput), [priceInput]);

  return (
    <section className={styles.inlinePanel}>
      <div className={styles.inlineHead}>
        <div className={styles.inlineHeadActions}>
          <button type="button" className={styles.panelButton} onClick={onClose}>
            返回
          </button>
        </div>
        <div>
          <span>市场</span>
          <strong>浏览挂单、挂卖当前 NFA、买入固定价</strong>
        </div>
      </div>

      <div className={styles.inlineSummary}>
        <div>
          <span>挂单</span>
          <strong>{loading ? '读取中' : `${listings.length} 条`}</strong>
        </div>
        <div>
          <span>我的挂单</span>
          <strong>{myListings.length} 条</strong>
        </div>
        <div>
          <span>当前 NFA</span>
          <strong>#{companion.tokenNumber}</strong>
        </div>
        <div>
          <span>结算币种</span>
          <strong>BNB</strong>
        </div>
      </div>

      <div className={styles.inlineActions}>
        <button type="button" className={styles.panelButton} onClick={() => void refreshListings()} disabled={loading}>
          <RefreshCw size={16} />
          {loading ? '刷新中' : '刷新市场'}
        </button>
        <button
          type="button"
          className={isApproved ? styles.panelButton : styles.primaryPanelButton}
          onClick={() => {
            setPendingLabel('授权当前 NFA');
            writeContract(nfaApproveArgs(companion.tokenNumber));
          }}
          disabled={isPending || isApproved}
        >
          <Tag size={16} />
          {isApproved ? '已授权上架' : '授权当前 NFA'}
        </button>
      </div>

      <label className={styles.compactField}>
        <span>挂卖当前 NFA（固定价 BNB）</span>
        <input
          className={styles.compactInput}
          inputMode="decimal"
          placeholder="0.05"
          value={priceInput}
          onChange={(event) => setPriceInput(event.target.value)}
        />
      </label>

      <div className={styles.inlineActions}>
        <button
          type="button"
          className={styles.primaryPanelButton}
          disabled={isPending || !isApproved || priceValue === null}
          onClick={() => {
            if (priceValue === null) return;
            setPendingLabel(`挂卖 #${companion.tokenNumber}`);
            writeContract(marketListArgs(companion.tokenNumber, priceValue));
          }}
        >
          <Coins size={16} />
          {isPending ? '等待签名' : receipt.isLoading ? '确认中' : '挂卖当前 NFA'}
        </button>
      </div>

      {error ? <p className={styles.panelError}>{error}</p> : null}
      {writeError ? <p className={styles.panelError}>{writeError.message}</p> : null}

      <div className={styles.resultList}>
        {listings.map((listing) => {
          const mine = address ? listing.seller.toLowerCase() === address.toLowerCase() : false;
          const ended = listing.listingType === 1 && listing.endTime > 0 && listing.endTime * 1000 <= Date.now();
          const canBuy = !mine && listing.listingType === 0;
          const canCancel = mine && (listing.listingType !== 1 || listing.highestBid === 0n);
          const canSettle = mine && listing.listingType === 1 && ended && listing.highestBid > 0n;

          return (
            <article key={listing.listingId} className={styles.directiveEditor}>
              <div className={styles.inlineHead}>
                <div>
                  <span>挂单 #{listing.listingId}</span>
                  <strong>NFA #{listing.nfaId}</strong>
                </div>
                <span className={styles.heroMetaLine}>{listingMode(listing.listingType)}</span>
              </div>
              <div className={styles.inlineSummary}>
                <div>
                  <span>状态</span>
                  <strong>{mine ? '我的挂单' : '可操作'}</strong>
                </div>
                <div>
                  <span>价格</span>
                  <strong>{listingValue(listing)}</strong>
                </div>
                <div>
                  <span>卖家</span>
                  <strong>{mine ? '我' : `${listing.seller.slice(0, 6)}...${listing.seller.slice(-4)}`}</strong>
                </div>
                <div>
                  <span>模式</span>
                  <strong>{listingMode(listing.listingType)}</strong>
                </div>
              </div>
              <div className={styles.inlineActions}>
                {canBuy ? (
                  <button
                    type="button"
                    className={styles.primaryPanelButton}
                    onClick={() => {
                      setPendingLabel(`买入挂单 #${listing.listingId}`);
                      writeContract(marketBuyArgs(listing.listingId, listing.price));
                    }}
                    disabled={isPending}
                  >
                    <ShoppingCart size={16} />
                    买入
                  </button>
                ) : null}
                {canCancel ? (
                  <button
                    type="button"
                    className={styles.panelButton}
                    onClick={() => {
                      setPendingLabel(`取消挂单 #${listing.listingId}`);
                      writeContract(marketCancelArgs(listing.listingId));
                    }}
                    disabled={isPending}
                  >
                    撤单
                  </button>
                ) : null}
                {canSettle ? (
                  <button
                    type="button"
                    className={styles.panelButton}
                    onClick={() => {
                      setPendingLabel(`结算拍卖 #${listing.listingId}`);
                      writeContract(marketSettleAuctionArgs(listing.listingId));
                    }}
                    disabled={isPending}
                  >
                    结算
                  </button>
                ) : null}
                {!canBuy && !canCancel && !canSettle ? (
                  <span className={styles.heroMetaLine}>{listing.listingType === 1 ? '拍卖和互换先做浏览' : '当前无可执行动作'}</span>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
