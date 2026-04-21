'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import type { TerminalCard, TerminalChatStreamEvent } from '@/lib/terminal-cards';

type TerminalEventState = {
  cards: TerminalCard[];
  error: string | null;
};

const INITIAL_STATE: TerminalEventState = {
  cards: [],
  error: null,
};

export function useTerminalEvents(tokenId?: bigint, owner?: string) {
  const [state, setState] = useState<TerminalEventState>(INITIAL_STATE);
  const seen = useRef<Set<string>>(new Set());
  const token = tokenId?.toString();
  const normalizedOwner = owner?.toLowerCase();

  useEffect(() => {
    seen.current = new Set();
    setState(INITIAL_STATE);
  }, [token]);

  useEffect(() => {
    if (!token) return;

    const ownerQuery = normalizedOwner ? `&owner=${normalizedOwner}` : '';
    if (typeof window === 'undefined' || typeof window.EventSource === 'undefined') {
      setState(INITIAL_STATE);
      return;
    }

    let source: EventSource;
    try {
      source = new window.EventSource(`/api/events/stream?tokenId=${token}${ownerQuery}`);
    } catch {
      setState(INITIAL_STATE);
      return;
    }

    const handleCard = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as TerminalChatStreamEvent;
        if (payload.type !== 'card') return;
        if (seen.current.has(payload.card.id)) return;
        seen.current.add(payload.card.id);
        setState((current) => ({
          ...current,
          cards: [...current.cards, payload.card],
        }));
      } catch {
        setState((current) => ({ ...current, error: '事件流解析失败。' }));
      }
    };

    const handleError = () => {
      setState((current) => ({ ...current, error: '事件流暂时断开，下次进入会继续同步状态。' }));
    };

    source.addEventListener('card', handleCard as EventListener);
    source.addEventListener('error', handleError as EventListener);
    source.onerror = handleError;

    return () => {
      source.removeEventListener('card', handleCard as EventListener);
      source.removeEventListener('error', handleError as EventListener);
      source.close();
    };
  }, [normalizedOwner, token]);

  return useMemo(() => state, [state]);
}
