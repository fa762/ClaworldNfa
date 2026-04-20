'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  appendLocalMemoryEntry,
  mergeMemoryState,
  readLocalMemoryEntries,
  updateLocalMemoryEntry,
  type LocalMemoryEntry,
  type TerminalMemorySnapshot,
  type TerminalMemorySummary,
} from '@/lib/terminal-memory-local';

type TerminalMemoryState = {
  summary: TerminalMemorySummary | null;
  timeline: TerminalMemorySnapshot[];
  localEntries: LocalMemoryEntry[];
  isLoading: boolean;
  error: string | null;
};

const INITIAL_STATE: TerminalMemoryState = {
  summary: null,
  timeline: [],
  localEntries: [],
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

export function useTerminalMemory(tokenId?: bigint, owner?: string) {
  const [state, setState] = useState<TerminalMemoryState>(INITIAL_STATE);
  const token = tokenId?.toString();

  const refresh = useCallback(async () => {
    if (!token) {
      setState(INITIAL_STATE);
      return;
    }

    const localEntries = readLocalMemoryEntries(token, owner);
    setState((current) => ({
      ...current,
      localEntries,
      isLoading: true,
      error: null,
    }));

    try {
      const [summary, timeline] = await Promise.all([
        readJson<TerminalMemorySummary>(`/api/memory/${token}/summary`).catch(() => null),
        readJson<{ snapshots: TerminalMemorySnapshot[] }>(`/api/memory/${token}/timeline?limit=6`).catch(() => ({ snapshots: [] })),
      ]);
      const merged = mergeMemoryState(summary, timeline.snapshots, localEntries);
      setState({
        summary: merged.summary,
        timeline: merged.timeline,
        localEntries,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const merged = mergeMemoryState(null, [], localEntries);
      setState({
        summary: merged.summary,
        timeline: merged.timeline,
        localEntries,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Memory request failed',
      });
    }
  }, [owner, token]);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setState(INITIAL_STATE);
      return;
    }

    setState((current) => ({ ...current, isLoading: true, error: null }));
    const localEntries = readLocalMemoryEntries(token, owner);

    Promise.all([
      readJson<TerminalMemorySummary>(`/api/memory/${token}/summary`).catch(() => null),
      readJson<{ snapshots: TerminalMemorySnapshot[] }>(`/api/memory/${token}/timeline?limit=6`).catch(() => ({ snapshots: [] })),
    ])
      .then(([summary, timeline]) => {
        if (cancelled) return;
        const merged = mergeMemoryState(summary, timeline.snapshots, localEntries);
        setState({
          summary: merged.summary,
          timeline: merged.timeline,
          localEntries,
          isLoading: false,
          error: null,
        });
      })
      .catch((error) => {
        if (cancelled) return;
        const merged = mergeMemoryState(null, [], localEntries);
        setState({
          summary: merged.summary,
          timeline: merged.timeline,
          localEntries,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Memory request failed',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [owner, token]);

  const appendLocalEntry = useCallback(
    (entry: Omit<LocalMemoryEntry, 'id' | 'createdAt'> & { id?: string; createdAt?: string }) => {
      if (!token || !owner) {
        throw new Error('当前缺少 token 或 owner，不能写本地记忆');
      }
      const next = appendLocalMemoryEntry(token, owner, entry);
      const nextEntries = [next, ...state.localEntries]
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, 24);
      const merged = mergeMemoryState(state.summary, state.timeline, nextEntries);
      setState((current) => ({
        ...current,
        summary: merged.summary,
        timeline: merged.timeline,
        localEntries: nextEntries,
      }));
      return next;
    },
    [owner, state.localEntries, state.summary, state.timeline, token],
  );

  const patchLocalEntry = useCallback(
    (entryId: string, patch: Partial<Omit<LocalMemoryEntry, 'id' | 'createdAt' | 'content'>>) => {
      if (!token || !owner) return;
      updateLocalMemoryEntry(token, owner, entryId, patch);
      const nextEntries = readLocalMemoryEntries(token, owner);
      const merged = mergeMemoryState(state.summary, state.timeline, nextEntries);
      setState((current) => ({
        ...current,
        summary: merged.summary,
        timeline: merged.timeline,
        localEntries: nextEntries,
      }));
    },
    [owner, state.summary, state.timeline, token],
  );

  return useMemo(
    () => ({
      ...state,
      refresh,
      appendLocalEntry,
      patchLocalEntry,
    }),
    [appendLocalEntry, patchLocalEntry, refresh, state],
  );
}
