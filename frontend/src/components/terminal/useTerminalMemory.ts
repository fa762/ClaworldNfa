'use client';

import { useEffect, useMemo, useState } from 'react';

type MemorySummary = {
  latestSnapshotHash: string;
  latestAnchorTxHash: string | null;
  pulse: number;
  hippocampusSize: number;
  identity: string;
  prefrontalBeliefs: string[];
  basalHabits: string[];
};

type MemorySnapshot = {
  snapshotId: string;
  hash: string;
  consolidatedAt: string;
  anchorTxHash: string | null;
  greenfieldUri: string | null;
  diffSummary: string;
  hippocampusMerged: number;
};

type TerminalMemoryState = {
  summary: MemorySummary | null;
  timeline: MemorySnapshot[];
  isLoading: boolean;
  error: string | null;
};

const INITIAL_STATE: TerminalMemoryState = {
  summary: null,
  timeline: [],
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

export function useTerminalMemory(tokenId?: bigint) {
  const [state, setState] = useState<TerminalMemoryState>(INITIAL_STATE);
  const token = tokenId?.toString();

  useEffect(() => {
    let cancelled = false;

    if (!token) {
      setState(INITIAL_STATE);
      return;
    }

    setState((current) => ({ ...current, isLoading: true, error: null }));

    Promise.all([
      readJson<MemorySummary>(`/api/memory/${token}/summary`),
      readJson<{ snapshots: MemorySnapshot[] }>(`/api/memory/${token}/timeline?limit=6`),
    ])
      .then(([summary, timeline]) => {
        if (cancelled) return;
        setState({
          summary,
          timeline: timeline.snapshots,
          isLoading: false,
          error: null,
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({
          summary: null,
          timeline: [],
          isLoading: false,
          error: error instanceof Error ? error.message : 'Memory request failed',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  return useMemo(() => state, [state]);
}
