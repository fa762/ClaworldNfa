'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Address } from 'viem';

import type { TerminalNFADetail, TerminalNFASummary } from '@/app/api/_lib/nfas';

type TerminalNfaState = {
  rail: TerminalNFASummary[];
  detail: TerminalNFADetail | null;
  isRailLoading: boolean;
  isDetailLoading: boolean;
  railError: string | null;
  detailError: string | null;
};

const INITIAL_STATE: TerminalNfaState = {
  rail: [],
  detail: null,
  isRailLoading: false,
  isDetailLoading: false,
  railError: null,
  detailError: null,
};

async function readJson<T>(url: string) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message = payload?.error || `Request failed with status ${response.status}`;
    throw new Error(message);
  }
  return (await response.json()) as T;
}

export function useTerminalNfas(ownerAddress?: Address, tokenId?: bigint) {
  const [state, setState] = useState<TerminalNfaState>(INITIAL_STATE);

  const owner = ownerAddress?.toLowerCase();
  const token = tokenId?.toString();

  useEffect(() => {
    let cancelled = false;

    if (!owner) {
      setState(INITIAL_STATE);
      return;
    }

    setState((current) => ({
      ...current,
      isRailLoading: true,
      railError: null,
    }));

    readJson<{ items: TerminalNFASummary[] }>(`/api/nfas?owner=${owner}`)
      .then((payload) => {
        if (cancelled) return;
        setState((current) => ({
          ...current,
          rail: payload.items,
          isRailLoading: false,
          railError: null,
        }));
      })
      .catch((error) => {
        if (cancelled) return;
        setState((current) => ({
          ...current,
          isRailLoading: false,
          railError: error instanceof Error ? error.message : 'Rail request failed',
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [owner]);

  useEffect(() => {
    let cancelled = false;

    if (!owner || !token) {
      setState((current) => ({
        ...current,
        detail: null,
        isDetailLoading: false,
        detailError: null,
      }));
      return;
    }

    setState((current) => ({
      ...current,
      isDetailLoading: true,
      detailError: null,
    }));

    readJson<TerminalNFADetail>(`/api/nfas/${token}?owner=${owner}`)
      .then((payload) => {
        if (cancelled) return;
        setState((current) => ({
          ...current,
          detail: payload,
          isDetailLoading: false,
          detailError: null,
        }));
      })
      .catch((error) => {
        if (cancelled) return;
        setState((current) => ({
          ...current,
          isDetailLoading: false,
          detailError: error instanceof Error ? error.message : 'Detail request failed',
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [owner, token]);

  return useMemo(() => state, [state]);
}
