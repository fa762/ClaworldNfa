'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Bot, Shield, Swords } from 'lucide-react';
import {
  decodeEventLog,
  encodeAbiParameters,
  type Address,
} from 'viem';
import {
  useAccount,
  usePublicClient,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi';

import { ClawOracleActionHubABI } from '@/contracts/abis/ClawOracleActionHub';
import { addresses, getBscScanTxUrl } from '@/contracts/addresses';
import {
  AUTONOMY_ACTION_KIND,
  AUTONOMY_ASSET_ID,
} from '@/contracts/hooks/useAutonomy';
import { formatBNB, formatCLW, truncateAddress } from '@/lib/format';

type ClaimPathKey = 'owner' | 'autonomy' | null | undefined;

const MODE_CLAIM_EXISTING = 3;

function buildClaimPrompt(tokenId: bigint, matchId: bigint) {
  return `Claim the settled Battle Royale reward for NFA #${tokenId.toString()} in match #${matchId.toString()} if it is available now.`;
}

export function AutonomyClaimRequestPanel({
  tokenId,
  ownerAddress,
  matchId,
  claimable,
  preferredPath,
  hasConflict,
  policyEnabled,
  permissionCount,
  emergencyPaused,
}: {
  tokenId: bigint;
  ownerAddress?: Address;
  matchId?: bigint;
  claimable: bigint;
  preferredPath: ClaimPathKey;
  hasConflict: boolean;
  policyEnabled: boolean;
  permissionCount: number;
  emergencyPaused: boolean;
}) {
  const publicClient = usePublicClient();
  const { address } = useAccount();
  const { data: hash, error, isPending, writeContract } = useWriteContract();
  const receiptQuery = useWaitForTransactionReceipt({ hash });
  const [requestId, setRequestId] = useState<bigint | null>(null);
  const [gasUnits, setGasUnits] = useState<bigint | null>(null);
  const [gasCostWei, setGasCostWei] = useState<bigint | null>(null);
  const [estimateError, setEstimateError] = useState<string | null>(null);

  const isOwner =
    Boolean(address && ownerAddress) && address!.toLowerCase() === ownerAddress!.toLowerCase();

  const payload = useMemo(() => {
    if (matchId === undefined) return undefined;
    const innerData = encodeAbiParameters([{ type: 'uint256' }], [matchId]);
    return encodeAbiParameters(
      [{ type: 'uint8' }, { type: 'bytes' }],
      [MODE_CLAIM_EXISTING, innerData],
    );
  }, [matchId]);

  const prompt = useMemo(
    () => (matchId === undefined ? '' : buildClaimPrompt(tokenId, matchId)),
    [matchId, tokenId],
  );

  const blockers = useMemo(() => {
    const next: string[] = [];
    if (!isOwner) next.push('Owner wallet must stay connected to submit the request.');
    if (emergencyPaused) next.push('Autonomy risk controls are emergency-paused.');
    if (!policyEnabled) next.push('Battle Royale policy is not enabled yet.');
    if (permissionCount < 4) next.push(`Only ${permissionCount}/4 required autonomy approvals are ready.`);
    if (hasConflict) next.push('Owner and autonomy participant paths conflict. Do not queue a blind claim.');
    if (preferredPath === 'owner' && claimable > 0n) next.push('This reward is on the owner-wallet path, so use direct claim instead.');
    if (matchId === undefined || claimable <= 0n) next.push('No settled autonomy-side reward is ready to claim.');
    return next;
  }, [claimable, emergencyPaused, hasConflict, isOwner, matchId, permissionCount, policyEnabled, preferredPath]);

  const canSubmit =
    blockers.length === 0 &&
    payload !== undefined &&
    matchId !== undefined &&
    preferredPath === 'autonomy' &&
    claimable > 0n;

  const requestPulse = error
    ? {
        tone: 'cw-panel--cool',
        chip: 'Failed',
        chipTone: 'cw-chip--alert',
        title: 'Autonomy request failed',
        detail: error.message,
      }
    : isPending
      ? {
          tone: 'cw-panel--warm',
          chip: 'Sign',
          chipTone: 'cw-chip--warm',
          title: 'Sign autonomy request',
          detail: 'The bounded request is ready. Confirm it in the owner wallet to hand the claim path to the action hub.',
        }
      : receiptQuery.isLoading
        ? {
            tone: 'cw-panel--warm',
            chip: 'Confirming',
            chipTone: 'cw-chip--warm',
            title: 'Autonomy request is confirming',
            detail: 'The request transaction is on-chain. Wait for the receipt so the emitted request id can be decoded.',
          }
        : requestId !== null
          ? {
              tone: 'cw-panel--warm',
              chip: 'Queued',
              chipTone: 'cw-chip--growth',
              title: `Request #${requestId.toString()} queued`,
              detail: 'The action hub now holds this Battle Royale claim request on the bounded autonomy path.',
            }
          : hash
            ? {
                tone: 'cw-panel--warm',
                chip: 'Submitted',
                chipTone: 'cw-chip--cool',
                title: 'Request transaction submitted',
                detail: 'The transaction is visible on-chain. If the request id is still blank, keep this page open until the receipt decode completes.',
              }
            : null;

  useEffect(() => {
    let cancelled = false;

    async function estimate() {
      if (!publicClient || !address || !canSubmit || payload === undefined) {
        setGasUnits(null);
        setGasCostWei(null);
        setEstimateError(null);
        return;
      }

      try {
        const [estimated, gasPrice] = await Promise.all([
          publicClient.estimateContractGas({
            address: addresses.oracleActionHub,
            abi: ClawOracleActionHubABI,
            functionName: 'requestAutonomousAction',
            args: [
              tokenId,
              AUTONOMY_ACTION_KIND.battleRoyale,
              AUTONOMY_ASSET_ID.claworld,
              0n,
              payload,
              prompt,
              2,
            ],
            account: address,
          }),
          publicClient.getGasPrice(),
        ]);

        if (!cancelled) {
          setGasUnits(estimated);
          setGasCostWei(estimated * gasPrice);
          setEstimateError(null);
        }
      } catch (estimateFailure) {
        if (!cancelled) {
          setGasUnits(null);
          setGasCostWei(null);
          setEstimateError((estimateFailure as Error).message);
        }
      }
    }

    void estimate();

    return () => {
      cancelled = true;
    };
  }, [address, canSubmit, payload, prompt, publicClient, tokenId]);

  useEffect(() => {
    if (!receiptQuery.data) return;

    for (const log of receiptQuery.data.logs) {
      if (log.address.toLowerCase() !== addresses.oracleActionHub.toLowerCase()) continue;
      try {
        const decoded = decodeEventLog({
          abi: ClawOracleActionHubABI,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === 'AutonomousActionRequested') {
          const nextRequestId = decoded.args.requestId;
          if (typeof nextRequestId === 'bigint') {
            setRequestId(nextRequestId);
          }
        }
      } catch {
        continue;
      }
    }
  }, [receiptQuery.data]);

  function handleSubmit() {
    if (!canSubmit || payload === undefined) return;

    setRequestId(null);
    writeContract({
      address: addresses.oracleActionHub,
      abi: ClawOracleActionHubABI,
      functionName: 'requestAutonomousAction',
      args: [
        tokenId,
        AUTONOMY_ACTION_KIND.battleRoyale,
        AUTONOMY_ASSET_ID.claworld,
        0n,
        payload,
        prompt,
        2,
      ],
    });
  }

  return (
    <section className={`cw-panel ${canSubmit ? 'cw-panel--warm' : 'cw-panel--cool'}`}>
      <div className="cw-section-head">
        <div>
          <span className="cw-label">Battle Royale claim request</span>
          <h3>
            {matchId !== undefined
              ? `Queue autonomy claim for match #${matchId.toString()}`
              : 'No settled reward is ready for an autonomy claim request'}
          </h3>
          <p className="cw-muted">
            Submit a bounded claim request to the action hub only when the reward is claimable on the autonomy participant path.
          </p>
        </div>
        <span className={`cw-chip ${canSubmit ? 'cw-chip--warm' : 'cw-chip--cool'}`}>
          <Bot size={14} />
          {claimable > 0n ? formatCLW(claimable) : 'Idle'}
        </span>
      </div>

      <div className="cw-state-grid">
        <div className="cw-state-card">
          <span className="cw-label">Claim path</span>
          <strong>{preferredPath === 'autonomy' ? 'Autonomy participant' : preferredPath === 'owner' ? 'Owner wallet' : 'Not found'}</strong>
        </div>
        <div className="cw-state-card">
          <span className="cw-label">Operator boundaries</span>
          <strong>{permissionCount}/4 ready</strong>
        </div>
        <div className="cw-state-card">
          <span className="cw-label">Estimated gas</span>
          <strong>{gasCostWei !== null ? formatBNB(gasCostWei, 6) : '--'} BNB</strong>
        </div>
      </div>

      <div className="cw-detail-list">
        <div className="cw-detail-row">
          <span>Connected wallet</span>
          <strong>{address ? truncateAddress(address) : 'Not connected'}</strong>
        </div>
        <div className="cw-detail-row">
          <span>Owner</span>
          <strong>{ownerAddress ? truncateAddress(ownerAddress) : 'Unknown'}</strong>
        </div>
        <div className="cw-detail-row">
          <span>Requested reward</span>
          <strong>{formatCLW(claimable)}</strong>
        </div>
        <div className="cw-detail-row">
          <span>Spend amount</span>
          <strong>0</strong>
        </div>
      </div>

      <div className="cw-panel cw-panel--cool">
        <div className="cw-section-head">
          <div>
            <span className="cw-label">Prompt preview</span>
            <h3>Action-hub request text</h3>
          </div>
          <span className="cw-chip cw-chip--cool">
            <Swords size={14} />
            2 choices
          </span>
        </div>
        <p className="cw-muted">{prompt || 'Prompt will appear once a settled claimable match is found.'}</p>
      </div>

      {requestPulse ? (
        <div className={`cw-panel ${requestPulse.tone}`}>
          <div className="cw-section-head">
            <div>
              <span className="cw-label">Request pulse</span>
              <h3>{requestPulse.title}</h3>
              <p className="cw-muted">{requestPulse.detail}</p>
            </div>
            <span className={`cw-chip ${requestPulse.chipTone}`}>{requestPulse.chip}</span>
          </div>
          {hash ? (
            <div className="cw-button-row">
              <a href={getBscScanTxUrl(hash)} target="_blank" rel="noopener noreferrer" className="cw-button cw-button--secondary">
                <ArrowUpRight size={16} />
                View request transaction
              </a>
            </div>
          ) : null}
        </div>
      ) : null}

      {blockers.length > 0 ? (
        <div className="cw-list">
          {blockers.map((blocker) => (
            <div key={blocker} className="cw-list-item cw-list-item--cool">
              <Shield size={16} />
              <span>{blocker}</span>
            </div>
          ))}
          {estimateError ? (
            <div className="cw-list-item cw-list-item--cool">
              <Shield size={16} />
              <span>Gas estimate failed: {estimateError}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="cw-button-row">
        <button
          type="button"
          className="cw-button cw-button--primary"
          disabled={!canSubmit || isPending || receiptQuery.isLoading}
          onClick={handleSubmit}
        >
          <Bot size={16} />
          {isPending ? 'Sign request' : receiptQuery.isLoading ? 'Confirming' : 'Request autonomy claim'}
        </button>
      </div>

      {hash ? (
        <a href={getBscScanTxUrl(hash)} target="_blank" rel="noopener noreferrer" className="cw-inline-link">
          View request transaction <ArrowUpRight size={14} />
        </a>
      ) : null}

      {requestId !== null ? (
        <p className="cw-muted">
          Request #{requestId.toString()} created. The runner can now fulfill, execute, and finalize it on the bounded path.
        </p>
      ) : null}
      {receiptQuery.isSuccess && requestId === null ? (
        <p className="cw-muted">Request transaction confirmed. Refresh the autonomy receipt list if the new request is not visible yet.</p>
      ) : null}
      {error ? <p className="cw-muted">Request failed to submit: {error.message}</p> : null}
      {estimateError && blockers.length === 0 ? <p className="cw-muted">Gas estimate failed: {estimateError}</p> : null}
      {gasUnits !== null ? (
        <p className="cw-muted">
          Estimated gas: {gasUnits.toString()} units
          {gasCostWei !== null ? ` / approx ${formatBNB(gasCostWei, 6)} BNB at current gas price.` : '.'}
        </p>
      ) : null}
    </section>
  );
}
