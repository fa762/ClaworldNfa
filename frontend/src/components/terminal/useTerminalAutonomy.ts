'use client';

import { useEffect, useMemo, useState } from 'react';

type ActionReceipt = {
  id: string;
  type: 'action_receipt';
  tokenId: string;
  author: 'system';
  createdAt: string;
  actionId: string;
  skill: string;
  status: 'pending' | 'success' | 'failed';
  txHash: string;
  blockNumber: number | null;
  summary: string;
  costCLW: string;
  rewardCLW: string | null;
  gasBNB: string | null;
  reasoningCid: string | null;
  hippocampusEntryId: string | null;
  budgetRemainingCLW: string | null;
  errorMessage: string | null;
};

type AutonomyStatus = {
  enabled: boolean;
  paused: boolean;
  directive: {
    text: string;
    signedAt: string;
    expiresAt: string | null;
    skills: string[];
    onchainNonce: string | null;
  } | null;
  budget: {
    totalCLW: string;
    usedCLW: string;
    remainingCLW: string;
    windowStart: string | null;
  };
  recentActions: ActionReceipt[];
};

type TerminalAutonomyState = {
  status: AutonomyStatus | null;
  isLoading: boolean;
  error: string | null;
};

const INITIAL_STATE: TerminalAutonomyState = {
  status: null,
  isLoading: false,
  error: null,
};

async function readJson<T>(url: string) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Request failed with status ${response.status}`);
  }
  return (await response.json()) as T;
}

export function useTerminalAutonomy(tokenId?: bigint) {
  const [state, setState] = useState<TerminalAutonomyState>(INITIAL_STATE);
  const token = tokenId?.toString();

  useEffect(() => {
    let cancelled = false;
    let interval: number | null = null;

    if (!token) {
      setState(INITIAL_STATE);
      return;
    }

    setState((current) => ({ ...current, isLoading: true, error: null }));

    const load = (showLoading: boolean) => {
      if (showLoading) {
        setState((current) => ({ ...current, isLoading: true, error: null }));
      }

      readJson<AutonomyStatus>(`/api/autonomy/${token}/status`)
        .then((status) => {
          if (cancelled) return;
          setState({ status, isLoading: false, error: null });
        })
        .catch((error) => {
          if (cancelled) return;
          setState((current) => ({
            status: current.status,
            isLoading: false,
            error: error instanceof Error ? error.message : 'Autonomy request failed',
          }));
        });
    };

    load(true);
    interval = window.setInterval(() => load(false), 20000);

    return () => {
      cancelled = true;
      if (interval) window.clearInterval(interval);
    };
  }, [token]);

  return useMemo(() => state, [state]);
}
