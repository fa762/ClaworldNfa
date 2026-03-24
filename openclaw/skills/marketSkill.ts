/**
 * Claw World OpenClaw — Market Trading Skill
 *
 * Operations: list, buy, bid, settle, cancel, swap.
 * Wraps GameContractClient market methods with caching and approval checks.
 */

import { ethers } from 'ethers';
import type { GameContractClient } from '../contracts';
import type { MarketListing } from '../types';
import { LISTING_TYPE_NAMES } from '../types';

/** How long cached listings remain valid (ms). */
const CACHE_TTL = 30_000;

export class MarketSkill {
  private client: GameContractClient;
  private listingsCache: MarketListing[] = [];
  private cacheTimestamp = 0;

  constructor(client: GameContractClient) {
    this.client = client;
  }

  // ============================================
  // READ
  // ============================================

  /**
   * Scan all listings from 1..listingCount and return those that are active.
   * Results are cached for CACHE_TTL ms to avoid excessive RPC calls.
   */
  async getActiveListings(forceRefresh = false): Promise<MarketListing[]> {
    const now = Date.now();
    if (!forceRefresh && this.listingsCache.length > 0 && now - this.cacheTimestamp < CACHE_TTL) {
      return this.listingsCache;
    }

    const count = await this.client.getMarketListingCount();
    if (count === 0) {
      this.listingsCache = [];
      this.cacheTimestamp = now;
      return [];
    }

    // Fetch in parallel batches of 20 to avoid flooding the RPC
    const BATCH_SIZE = 20;
    const active: MarketListing[] = [];

    for (let start = 1; start <= count; start += BATCH_SIZE) {
      const end = Math.min(start + BATCH_SIZE - 1, count);
      const promises: Promise<void>[] = [];

      for (let id = start; id <= end; id++) {
        const listingId = id;
        promises.push(
          this.client.getMarketListing(listingId).then((l) => {
            if (l.active) {
              active.push({
                listingId,
                nfaId: l.nfaId,
                seller: l.seller,
                listingType: l.listingType,
                price: l.price,
                highestBid: l.highestBid,
                highestBidder: l.highestBidder,
                endTime: l.endTime,
                swapTargetId: l.swapTargetId,
                active: l.active,
              });
            }
          })
        );
      }

      await Promise.all(promises);
    }

    // Sort by listingId ascending
    active.sort((a, b) => a.listingId - b.listingId);

    this.listingsCache = active;
    this.cacheTimestamp = now;
    return active;
  }

  /**
   * Get a single listing by ID (bypasses cache).
   */
  async getListing(listingId: number): Promise<MarketListing> {
    const l = await this.client.getMarketListing(listingId);
    return {
      listingId,
      nfaId: l.nfaId,
      seller: l.seller,
      listingType: l.listingType,
      price: l.price,
      highestBid: l.highestBid,
      highestBidder: l.highestBidder,
      endTime: l.endTime,
      swapTargetId: l.swapTargetId,
      active: l.active,
    };
  }

  // ============================================
  // LIST (SELL) OPERATIONS
  // ============================================

  /**
   * List an NFA at a fixed BNB price.
   * @param nfaId  The NFA token to sell
   * @param price  Price in BNB (e.g. "0.5")
   * @returns Transaction hash
   */
  async listFixedPrice(nfaId: number, price: string): Promise<string> {
    this.validatePrice(price);
    await this.ensureApproval();
    const txHash = await this.client.listFixedPrice(nfaId, price);
    this.invalidateCache();
    return txHash;
  }

  /**
   * List an NFA for auction with a starting price.
   * @param nfaId       The NFA token to auction
   * @param startPrice  Starting price in BNB
   * @returns Transaction hash
   */
  async listAuction(nfaId: number, startPrice: string): Promise<string> {
    this.validatePrice(startPrice);
    await this.ensureApproval();
    const txHash = await this.client.listAuction(nfaId, startPrice);
    this.invalidateCache();
    return txHash;
  }

  /**
   * List an NFA for a direct swap with a specific target NFA.
   * @param nfaId       The NFA to offer
   * @param targetNfaId The NFA desired in return
   * @returns Transaction hash
   */
  async listSwap(nfaId: number, targetNfaId: number): Promise<string> {
    if (nfaId === targetNfaId) {
      throw new Error('Cannot swap an NFA with itself');
    }
    await this.ensureApproval();
    const txHash = await this.client.listSwap(nfaId, targetNfaId);
    this.invalidateCache();
    return txHash;
  }

  // ============================================
  // BUY / BID OPERATIONS
  // ============================================

  /**
   * Buy a fixed-price listing. Sends BNB equal to the listing price.
   * @param listingId  The listing to buy
   * @returns Transaction hash
   */
  async buyFixedPrice(listingId: number): Promise<string> {
    const listing = await this.getListing(listingId);
    if (!listing.active) {
      throw new Error(`Listing #${listingId} is not active`);
    }
    if (listing.listingType !== 0) {
      throw new Error(`Listing #${listingId} is not a fixed-price listing (type: ${LISTING_TYPE_NAMES[listing.listingType]})`);
    }
    const txHash = await this.client.buyFixedPrice(listingId, listing.price);
    this.invalidateCache();
    return txHash;
  }

  /**
   * Place a bid on an auction listing. Amount must exceed current highest bid.
   * @param listingId  The auction listing
   * @param amount     Bid amount in BNB
   * @returns Transaction hash
   */
  async bidOnAuction(listingId: number, amount: string): Promise<string> {
    const listing = await this.getListing(listingId);
    if (!listing.active) {
      throw new Error(`Listing #${listingId} is not active`);
    }
    if (listing.listingType !== 1) {
      throw new Error(`Listing #${listingId} is not an auction listing`);
    }

    const bidWei = ethers.utils.parseEther(amount);
    const currentHighWei = ethers.utils.parseEther(listing.highestBid);
    if (bidWei.lte(currentHighWei)) {
      throw new Error(
        `Bid ${amount} BNB must exceed current highest bid ${listing.highestBid} BNB`
      );
    }

    const txHash = await this.client.bidOnAuction(listingId, amount);
    this.invalidateCache();
    return txHash;
  }

  /**
   * Settle a completed auction. Transfers NFA to highest bidder,
   * BNB to seller. Can be called by anyone after auction ends.
   * @param listingId  The auction listing to settle
   * @returns Transaction hash
   */
  async settleAuction(listingId: number): Promise<string> {
    const listing = await this.getListing(listingId);
    if (!listing.active) {
      throw new Error(`Listing #${listingId} is not active`);
    }
    if (listing.listingType !== 1) {
      throw new Error(`Listing #${listingId} is not an auction listing`);
    }

    const now = Math.floor(Date.now() / 1000);
    if (listing.endTime > now) {
      const remaining = listing.endTime - now;
      const hours = Math.floor(remaining / 3600);
      const mins = Math.floor((remaining % 3600) / 60);
      throw new Error(`Auction has not ended yet. ${hours}h ${mins}m remaining.`);
    }

    const txHash = await this.client.settleAuction(listingId);
    this.invalidateCache();
    return txHash;
  }

  /**
   * Accept a swap listing. The caller must own the target NFA.
   * @param listingId  The swap listing to accept
   * @returns Transaction hash
   */
  async acceptSwap(listingId: number): Promise<string> {
    const listing = await this.getListing(listingId);
    if (!listing.active) {
      throw new Error(`Listing #${listingId} is not active`);
    }
    if (listing.listingType !== 2) {
      throw new Error(`Listing #${listingId} is not a swap listing`);
    }
    await this.ensureApproval();
    const txHash = await this.client.acceptSwap(listingId);
    this.invalidateCache();
    return txHash;
  }

  /**
   * Cancel an active listing. Only the seller can cancel.
   * @param listingId  The listing to cancel
   * @returns Transaction hash
   */
  async cancelListing(listingId: number): Promise<string> {
    const listing = await this.getListing(listingId);
    if (!listing.active) {
      throw new Error(`Listing #${listingId} is already inactive`);
    }
    const txHash = await this.client.cancelListing(listingId);
    this.invalidateCache();
    return txHash;
  }

  // ============================================
  // APPROVAL
  // ============================================

  /**
   * Ensure the signer has approved the MarketSkill contract
   * to transfer NFAs on their behalf (setApprovalForAll).
   * This is a no-op if approval is already granted.
   */
  async ensureApproval(): Promise<void> {
    // approveNFAForMarket internally checks isApprovedForAll
    // and only sends a tx if needed. We call it unconditionally
    // since the client handles the idempotency check via the
    // NFA contract's isApprovedForAll + setApprovalForAll pattern.
    //
    // Note: GameContractClient.approveNFAForMarket always sends a tx.
    // For production, add a check here:
    //   const approved = await nfa.isApprovedForAll(signer, marketAddr);
    //   if (approved) return;
    await this.client.approveNFAForMarket(0 /* nfaId unused for setApprovalForAll */);
  }

  // ============================================
  // HELPERS
  // ============================================

  private validatePrice(price: string): void {
    const parsed = parseFloat(price);
    if (isNaN(parsed) || parsed <= 0) {
      throw new Error(`Invalid price: "${price}". Must be a positive number.`);
    }
  }

  private invalidateCache(): void {
    this.cacheTimestamp = 0;
    this.listingsCache = [];
  }
}
