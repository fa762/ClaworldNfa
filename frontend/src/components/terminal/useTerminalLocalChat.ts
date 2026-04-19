'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { TerminalCard } from '@/lib/terminal-cards';

const MAX_LOCAL_CARDS = 80;

function storageKey(token?: string, owner?: string) {
  if (!token || !owner) return null;
  return `claw-terminal-chat:${owner.toLowerCase()}:${token}`;
}

function readCards(key: string | null) {
  if (!key || typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { cards?: TerminalCard[] };
    return Array.isArray(parsed.cards) ? parsed.cards : [];
  } catch {
    return [];
  }
}

function writeCards(key: string | null, cards: TerminalCard[]) {
  if (!key || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify({ cards: cards.slice(-MAX_LOCAL_CARDS) }));
  } catch {
    // Local chat history is a convenience cache. If storage is full or blocked,
    // keep the in-memory session alive and let the next server history refill it.
  }
}

export function useTerminalLocalChat(tokenId?: bigint, owner?: string) {
  const token = tokenId?.toString();
  const key = useMemo(() => storageKey(token, owner), [owner, token]);
  const [cards, setCards] = useState<TerminalCard[]>(() => readCards(key));

  useEffect(() => {
    setCards(readCards(key));
  }, [key]);

  const appendCards = useCallback(
    (nextCards: TerminalCard[]) => {
      if (!nextCards.length) return;
      setCards((current) => {
        const merged = [...current, ...nextCards].slice(-MAX_LOCAL_CARDS);
        writeCards(key, merged);
        return merged;
      });
    },
    [key],
  );

  const clearCards = useCallback(() => {
    setCards([]);
    if (key && typeof window !== 'undefined') {
      window.localStorage.removeItem(key);
    }
  }, [key]);

  return useMemo(
    () => ({
      cards,
      appendCards,
      clearCards,
      count: cards.length,
    }),
    [appendCards, cards, clearCards],
  );
}
