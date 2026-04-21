'use client';

import { useEffect, useMemo, useState } from 'react';

type WorldSummary = {
  rewardMultiplier: string;
  pkStakeLimitCLW: string;
  mutationBonus: string;
  dailyCostMultiplier: string;
  activeEvents: Array<{
    key: string;
    label: string;
    tone: 'warm' | 'cool' | 'alert';
  }>;
  battleRoyale: {
    matchId: string | null;
    status: 'open' | 'pending_reveal' | 'settled' | 'unknown';
    players: number;
    triggerCount: number;
    revealBlock: string;
    potCLW: string;
    losingRoom: number;
  } | null;
};

type TerminalWorldState = {
  summary: WorldSummary | null;
  isLoading: boolean;
  error: string | null;
};

const INITIAL_STATE: TerminalWorldState = {
  summary: null,
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

export function useTerminalWorld() {
  const [state, setState] = useState<TerminalWorldState>(INITIAL_STATE);

  useEffect(() => {
    let cancelled = false;
    let interval: number | null = null;

    setState((current) => ({ ...current, isLoading: true, error: null }));

    const load = (showLoading: boolean) => {
      if (showLoading) {
        setState((current) => ({ ...current, isLoading: true, error: null }));
      }

      readJson<WorldSummary>('/api/world/summary')
        .then((summary) => {
          if (cancelled) return;
          setState({ summary, isLoading: false, error: null });
        })
        .catch((error) => {
          if (cancelled) return;
          setState((current) => ({
            summary: current.summary,
            isLoading: false,
            error: error instanceof Error ? error.message : 'World request failed',
          }));
        });
    };

    load(true);
    interval = window.setInterval(() => load(false), 30000);

    return () => {
      cancelled = true;
      if (interval) window.clearInterval(interval);
    };
  }, []);

  return useMemo(() => state, [state]);
}
