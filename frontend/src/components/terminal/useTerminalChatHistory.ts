'use client';

import { useEffect, useMemo, useState } from 'react';

import { coerceTerminalCards, type TerminalCard } from '@/lib/terminal-cards';

type TerminalChatHistoryState = {
  cards: TerminalCard[];
  isLoading: boolean;
  error: string | null;
};

const INITIAL_STATE: TerminalChatHistoryState = {
  cards: [],
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

export function useTerminalChatHistory(tokenId?: bigint, owner?: string) {
  const [state, setState] = useState<TerminalChatHistoryState>(INITIAL_STATE);
  const token = tokenId?.toString();
  const normalizedOwner = owner?.toLowerCase();

  useEffect(() => {
    let cancelled = false;

    if (!token) {
      setState(INITIAL_STATE);
      return;
    }

    setState((current) => ({
      ...current,
      isLoading: true,
      error: null,
    }));

    const ownerQuery = normalizedOwner ? `?owner=${normalizedOwner}` : '';

    readJson<{ messages: TerminalCard[] }>(`/api/chat/${token}/history${ownerQuery}`)
      .then((payload) => {
        if (cancelled) return;
        setState({
          cards: coerceTerminalCards(payload.messages),
          isLoading: false,
          error: null,
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({
          cards: [],
          isLoading: false,
          error: error instanceof Error ? error.message : 'History request failed',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [normalizedOwner, token]);

  return useMemo(() => state, [state]);
}
