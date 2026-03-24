/**
 * Claw World OpenClaw — AI Oracle Skill
 *
 * Background event listener that monitors ReasoningRequested events,
 * runs AI inference, uploads reasoning to IPFS, and submits fulfillment on-chain.
 */

import { ethers } from 'ethers';
import type { GameContractClient } from '../contracts';
import type { AIProvider, LobsterState } from '../types';
import { RARITY_NAMES_CN, SHELTER_NAMES } from '../types';
import { buildOracleReasoningPrompt } from '../dialogue';

// ============================================
// IPFS UPLOADER INTERFACE
// ============================================

export interface IPFSUploader {
  /** Upload UTF-8 content to IPFS and return the CID. */
  upload(content: string): Promise<string>;
}

/**
 * Mock IPFS uploader for testing. Returns a deterministic fake CID
 * based on content hash.
 */
export class MockIPFSUploader implements IPFSUploader {
  private uploadCount = 0;

  async upload(content: string): Promise<string> {
    this.uploadCount++;
    // Generate a fake CID that looks realistic
    const hash = simpleHash(content);
    return `bafkreih${hash}${this.uploadCount.toString(16).padStart(4, '0')}`;
  }
}

/** Simple deterministic string hash for mock CIDs. */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(36).padStart(8, '0').slice(0, 8);
}

// ============================================
// ORACLE SKILL
// ============================================

export class OracleSkill {
  private client: GameContractClient;
  private ai: AIProvider;
  private ipfs: IPFSUploader;
  private listening = false;
  private eventHandler: ((...args: any[]) => void) | null = null;

  /** Track processed request IDs to avoid double-processing. */
  private processedRequests = new Set<number>();

  /** Max processed set size before pruning old entries. */
  private static readonly MAX_PROCESSED_SIZE = 10_000;

  constructor(client: GameContractClient, ai: AIProvider, ipfs: IPFSUploader) {
    this.client = client;
    this.ai = ai;
    this.ipfs = ipfs;
  }

  // ============================================
  // LIFECYCLE
  // ============================================

  /**
   * Start listening for ReasoningRequested events on the Oracle contract.
   * Each event triggers processRequest which runs AI, uploads to IPFS,
   * and calls fulfillReasoning on-chain.
   */
  async startListening(): Promise<void> {
    if (this.listening) {
      throw new Error('OracleSkill is already listening');
    }

    const oracle = this.client.getOracleContract();

    this.eventHandler = (
      requestId: ethers.BigNumber,
      nfaId: ethers.BigNumber,
      prompt: string,
      numOfChoices: number
    ) => {
      const reqId = requestId.toNumber();
      const nfa = nfaId.toNumber();

      // Skip if already processed
      if (this.processedRequests.has(reqId)) return;

      // Process asynchronously; log errors but don't crash the listener
      this.processRequest(reqId, nfa, prompt, numOfChoices).catch((err) => {
        console.error(`[OracleSkill] Failed to process request #${reqId}:`, err);
      });
    };

    oracle.on('ReasoningRequested', this.eventHandler);
    this.listening = true;
    console.log('[OracleSkill] Started listening for ReasoningRequested events');
  }

  /**
   * Stop listening for events. Safe to call even if not listening.
   */
  stop(): void {
    if (!this.listening || !this.eventHandler) return;

    const oracle = this.client.getOracleContract();
    oracle.off('ReasoningRequested', this.eventHandler);
    this.eventHandler = null;
    this.listening = false;
    console.log('[OracleSkill] Stopped listening');
  }

  /**
   * Whether the oracle is currently listening for events.
   */
  get isListening(): boolean {
    return this.listening;
  }

  // ============================================
  // PROCESSING
  // ============================================

  /**
   * Process a single oracle reasoning request.
   *
   * Flow:
   * 1. Fetch the lobster's current state from chain
   * 2. Build a reasoning prompt incorporating personality + request
   * 3. Call AI to generate a reasoned choice
   * 4. Upload the full reasoning to IPFS for auditability
   * 5. Call fulfillReasoning on-chain with the choice + CID
   *
   * @param requestId   On-chain request ID
   * @param nfaId       The lobster NFA ID
   * @param prompt      The reasoning prompt from the request
   * @param numChoices  Number of choices the AI must pick from (1-indexed)
   * @returns           Transaction hash of the fulfillment
   */
  async processRequest(
    requestId: number,
    nfaId: number,
    prompt: string,
    numChoices: number
  ): Promise<string> {
    // Mark as processing to prevent duplicates
    this.markProcessed(requestId);

    console.log(`[OracleSkill] Processing request #${requestId} for NFA #${nfaId}`);

    // Step 1: Fetch lobster state
    const { state } = await this.client.getLobsterStatus(nfaId);

    // Step 2: Build reasoning prompt
    const systemPrompt = buildOracleReasoningPrompt(state, prompt, numChoices);

    // Step 3: Call AI for reasoning
    const aiResponse = await this.ai.chat(
      systemPrompt,
      `请为龙虾 #${nfaId} 做出推理决策。从 ${numChoices} 个选项中选择一个。`,
      []
    );

    // Step 4: Parse the choice from AI response
    const choice = this.parseChoice(aiResponse, numChoices);

    // Step 5: Build the full reasoning document for IPFS
    const reasoningDoc = JSON.stringify(
      {
        requestId,
        nfaId,
        prompt,
        numChoices,
        lobsterState: {
          level: state.level,
          courage: state.courage,
          wisdom: state.wisdom,
          social: state.social,
          create: state.create,
          grit: state.grit,
          str: state.str,
          def: state.def,
          spd: state.spd,
          vit: state.vit,
          rarity: state.rarity,
        },
        aiReasoning: aiResponse,
        choice,
        timestamp: Date.now(),
      },
      null,
      2
    );

    // Step 6: Upload to IPFS
    const cid = await this.ipfs.upload(reasoningDoc);
    console.log(`[OracleSkill] Reasoning uploaded to IPFS: ${cid}`);

    // Step 7: Submit fulfillment on-chain
    const txHash = await this.client.fulfillReasoning(requestId, choice, cid);
    console.log(`[OracleSkill] Fulfilled request #${requestId} with choice ${choice}, tx: ${txHash}`);

    return txHash;
  }

  // ============================================
  // HELPERS
  // ============================================

  /**
   * Parse the AI's chosen option number from its response text.
   * Looks for patterns like "选择 2", "choice: 1", "选项1", or a bare number.
   * Falls back to 1 if parsing fails.
   */
  private parseChoice(response: string, numChoices: number): number {
    // Try common patterns
    const patterns = [
      /选择[：:\s]*(\d+)/,
      /选项[：:\s]*(\d+)/,
      /choice[：:\s]*(\d+)/i,
      /option[：:\s]*(\d+)/i,
      /^(\d+)[.。、]/m,
      /\b(\d+)\b/,
    ];

    for (const pattern of patterns) {
      const match = response.match(pattern);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num >= 1 && num <= numChoices) {
          return num;
        }
      }
    }

    // Default to 1 if we can't parse
    console.warn(`[OracleSkill] Could not parse choice from AI response, defaulting to 1`);
    return 1;
  }

  /**
   * Mark a request ID as processed and prune the set if it grows too large.
   */
  private markProcessed(requestId: number): void {
    this.processedRequests.add(requestId);

    // Prune old entries if set is too large
    if (this.processedRequests.size > OracleSkill.MAX_PROCESSED_SIZE) {
      const entries = Array.from(this.processedRequests);
      const toRemove = entries.slice(0, entries.length - OracleSkill.MAX_PROCESSED_SIZE / 2);
      for (const id of toRemove) {
        this.processedRequests.delete(id);
      }
    }
  }
}
