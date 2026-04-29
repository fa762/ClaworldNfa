'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Coins, RefreshCw, ShoppingCart, Tag, Wallet } from 'lucide-react';
import { formatEther, parseEther } from 'viem';
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';

import type { ActiveCompanionValue } from '@/components/lobster/useActiveCompanion';
import { ClawNFAABI } from '@/contracts/abis/ClawNFA';
import { addresses, getBscScanTxUrl } from '@/contracts/addresses';
import { marketBuyArgs, marketCancelArgs, marketListArgs, marketSettleAuctionArgs, nfaApproveArgs } from '@/game/chain/contracts';
import { loadMarketListings, type MarketListing } from '@/game/chain/wallet';
import { useI18n } from '@/lib/i18n';
import type { TerminalCard } from '@/lib/terminal-cards';

import styles from './TerminalHome.module.css';

type PickFn = <T,>(zh: T, en: T) => T;

function listingMode(type: number, pick: PickFn) {
  if (type === 0) return pick('固定价', 'Fixed price');
  if (type === 1) return pick('拍卖', 'Auction');
  return pick('互换', 'Swap');
}

function listingValue(listing: MarketListing, pick: PickFn) {
  if (listing.listingType === 1 && listing.highestBid > 0n) {
    return `${Number(formatEther(listing.highestBid)).toFixed(3)} BNB`;
  }
  if (listing.listingType === 2) {
    return pick(`换 #${listing.swapTargetId}`, `Swap for #${listing.swapTargetId}`);
  }
  return `${Number(formatEther(listing.price)).toFixed(3)} BNB`;
}

function visibleMarketListings(items: MarketListing[], address?: string) {
  const head = items.slice(0, 12);
  const mine = address ? items.filter((item) => item.seller.toLowerCase() === address.toLowerCase()) : [];
  const seen = new Set<number>();
  return [...head, ...mine].filter((item) => {
    if (seen.has(item.listingId)) return false;
    seen.add(item.listingId);
    return true;
  });
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
  const { pick } = useI18n();
  const [priceInput, setPriceInput] = useState('');
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [totalListingCount, setTotalListingCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingLabel, setPendingLabel] = useState('');
  const hasCurrentNfa = companion.hasToken && companion.tokenNumber > 0;

  const { data: hash, error: writeError, isPending, writeContract } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });
  const handledTxsRef = useRef<Set<string>>(new Set());

  const approvedNfaQuery = useReadContract({
    address: addresses.clawNFA,
    abi: ClawNFAABI,
    functionName: 'getApproved',
    args: [companion.tokenId],
    query: { enabled: hasCurrentNfa },
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

  const refreshListings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await loadMarketListings();
      setTotalListingCount(next.length);
      setListings(visibleMarketListings(next, address));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : pick('市场读取失败', 'Market read failed'));
    } finally {
      setLoading(false);
    }
  }, [address, pick]);

  useEffect(() => {
    void refreshListings();
  }, [refreshListings]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshListings();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [refreshListings]);

  useEffect(() => {
    if (!receipt.isSuccess || !hash || handledTxsRef.current.has(hash)) return;
    handledTxsRef.current.add(hash);
    void refreshListings();
    onReceipt({
      id: `market-${hash}`,
      type: 'receipt',
      label: pick('市场回执', 'Market receipt'),
      title: pendingLabel || pick('市场动作已确认', 'Market action confirmed'),
      body: pick('市场动作已经上链，列表也刷新了。', 'The market action is on-chain and the list has refreshed.'),
      details: [
        { label: pick('当前 NFA', 'Current NFA'), value: hasCurrentNfa ? `#${companion.tokenNumber}` : pick('当前无 NFA', 'No NFA in wallet') },
        { label: pick('动作', 'Action'), value: pendingLabel || pick('市场操作', 'Market action'), tone: 'warm' },
        { label: pick('交易', 'Tx'), value: getBscScanTxUrl(hash) },
      ],
    });
  }, [companion.tokenNumber, hash, hasCurrentNfa, onReceipt, pendingLabel, pick, receipt.isSuccess]);

  const priceValue = useMemo(() => parsePrice(priceInput), [priceInput]);

  return (
    <section className={styles.inlinePanel}>
      <div className={styles.inlineHead}>
        <div className={styles.inlineHeadActions}>
          <button type="button" className={styles.panelButton} onClick={onClose}>
            {pick('返回', 'Back')}
          </button>
        </div>
        <div>
          <span>{pick('市场', 'Market')}</span>
          <strong>{pick('买入、撤单、挂卖当前 NFA', 'Buy, cancel, or list the current NFA')}</strong>
        </div>
      </div>

      <div className={styles.inlineSummary}>
        <div>
          <span>{pick('挂单', 'Listings')}</span>
          <strong>{loading ? pick('读取中', 'Loading') : `${listings.length}/${totalListingCount} ${pick('条', 'shown')}`}</strong>
        </div>
        <div>
          <span>{pick('我的挂单', 'My listings')}</span>
          <strong>{myListings.length} {pick('条', 'shown')}</strong>
        </div>
        <div>
          <span>{pick('当前 NFA', 'Current NFA')}</span>
          <strong>{hasCurrentNfa ? `#${companion.tokenNumber}` : pick('当前无 NFA', 'No NFA')}</strong>
        </div>
        <div>
          <span>{pick('结算币种', 'Settlement')}</span>
          <strong>BNB</strong>
        </div>
      </div>

      <div className={styles.inlineActions}>
        <button
          type="button"
          className={styles.panelButton}
          onClick={() => void refreshListings()}
          disabled={loading}
        >
          <RefreshCw size={16} />
          {loading ? pick('刷新中', 'Refreshing') : pick('刷新市场', 'Refresh market')}
        </button>
        {hasCurrentNfa ? (
          <button
            type="button"
            className={isApproved ? styles.panelButton : styles.primaryPanelButton}
            onClick={() => {
              setPendingLabel(pick('授权当前 NFA', 'Approve current NFA'));
              writeContract(nfaApproveArgs(companion.tokenNumber));
            }}
            disabled={isPending || isApproved}
          >
            <Tag size={16} />
            {isApproved ? pick('已授权上架', 'Approved') : pick('授权当前 NFA', 'Approve current NFA')}
          </button>
        ) : null}
      </div>

      {hasCurrentNfa ? (
        <>
          <label className={styles.compactField}>
            <span>{pick('挂卖当前 NFA（固定价 BNB）', 'List current NFA, fixed price in BNB')}</span>
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
                setPendingLabel(pick(`挂卖 #${companion.tokenNumber}`, `List #${companion.tokenNumber}`));
                writeContract(marketListArgs(companion.tokenNumber, priceValue));
              }}
            >
              <Coins size={16} />
              {isPending ? pick('等待签名', 'Waiting for wallet') : receipt.isLoading ? pick('确认中', 'Confirming') : pick('挂卖当前 NFA', 'List current NFA')}
            </button>
          </div>
        </>
      ) : (
        <p className={styles.heroMetaLine}>{pick('当前钱包没有可挂卖的 NFA。你仍然可以购买挂单，或者取消你自己的挂单。', 'No NFA is in this wallet. You can still buy listings or cancel your own listings.')}</p>
      )}

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
                <span className={styles.heroMetaLine}>{listingMode(listing.listingType, pick)}</span>
              </div>
              <div className={styles.inlineSummary}>
                <div>
                  <span>{pick('状态', 'Status')}</span>
                  <strong>{mine ? pick('我的挂单', 'My listing') : pick('可操作', 'Available')}</strong>
                </div>
                <div>
                  <span>{pick('价格', 'Price')}</span>
                  <strong>{listingValue(listing, pick)}</strong>
                </div>
                <div>
                  <span>{pick('卖家', 'Seller')}</span>
                  <strong>{mine ? pick('我', 'Me') : `${listing.seller.slice(0, 6)}...${listing.seller.slice(-4)}`}</strong>
                </div>
                <div>
                  <span>{pick('模式', 'Mode')}</span>
                  <strong>{listingMode(listing.listingType, pick)}</strong>
                </div>
              </div>
              <div className={styles.inlineActions}>
                {canBuy ? (
                  <button
                    type="button"
                    className={styles.primaryPanelButton}
                    onClick={() => {
                      setPendingLabel(pick(`买入挂单 #${listing.listingId}`, `Buy listing #${listing.listingId}`));
                      writeContract(marketBuyArgs(listing.listingId, listing.price));
                    }}
                    disabled={isPending}
                  >
                    <ShoppingCart size={16} />
                    {pick('买入', 'Buy')}
                  </button>
                ) : null}
                {canCancel ? (
                  <button
                    type="button"
                    className={styles.panelButton}
                    onClick={() => {
                      setPendingLabel(pick(`取消挂单 #${listing.listingId}`, `Cancel listing #${listing.listingId}`));
                      writeContract(marketCancelArgs(listing.listingId));
                    }}
                    disabled={isPending}
                  >
                    {pick('撤单', 'Cancel')}
                  </button>
                ) : null}
                {canSettle ? (
                  <button
                    type="button"
                    className={styles.panelButton}
                    onClick={() => {
                      setPendingLabel(pick(`结算拍卖 #${listing.listingId}`, `Settle auction #${listing.listingId}`));
                      writeContract(marketSettleAuctionArgs(listing.listingId));
                    }}
                    disabled={isPending}
                  >
                    {pick('结算', 'Settle')}
                  </button>
                ) : null}
                {!canBuy && !canCancel && !canSettle ? (
                  <span className={styles.heroMetaLine}>{listing.listingType === 1 ? pick('拍卖和互换先做浏览', 'Auctions and swaps are browse-only for now') : pick('当前无可执行动作', 'No available action')}</span>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
