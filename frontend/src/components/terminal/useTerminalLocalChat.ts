'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { coerceTerminalCard, type TerminalCard } from '@/lib/terminal-cards';

const MAX_LOCAL_CARDS = 80;
const LOCAL_CHAT_VERSION = 'v3';

function storageKey(token?: string, owner?: string) {
  if (!token || !owner) return null;
  return `claw-terminal-chat:${LOCAL_CHAT_VERSION}:${owner.toLowerCase()}:${token}`;
}

function isRenderableCard(card: TerminalCard) {
  if (!card || typeof card !== 'object' || typeof card.type !== 'string') return false;
  if (card.type === 'message') {
    const body = typeof card.body === 'string' ? card.body.trim() : '';
    const title = typeof card.title === 'string' ? card.title.trim() : '';
    if (!body && !title) return false;
    if (body === '已发送给当前 NFA。') return false;
  }
  return true;
}

function sanitizeCards(cards: TerminalCard[]) {
  return cards
    .map((card) => coerceTerminalCard(card))
    .filter((card): card is TerminalCard => Boolean(card))
    .filter(isRenderableCard);
}

function readCards(key: string | null) {
  if (!key || typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { cards?: TerminalCard[] };
    return Array.isArray(parsed.cards) ? sanitizeCards(parsed.cards) : [];
  } catch {
    return [];
  }
}

function writeCards(key: string | null, cards: TerminalCard[]) {
  if (!key || typeof window === 'undefined') return;
  try {
    const safeCards = sanitizeCards(cards).slice(-MAX_LOCAL_CARDS);
    window.localStorage.setItem(key, JSON.stringify({ cards: safeCards }));
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
        const merged = sanitizeCards([...current, ...nextCards]).slice(-MAX_LOCAL_CARDS);
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
