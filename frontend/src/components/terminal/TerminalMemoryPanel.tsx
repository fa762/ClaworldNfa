'use client';

import { useEffect, useState } from 'react';
import { Brain, X } from 'lucide-react';
import { keccak256, toBytes } from 'viem';
import { useWaitForTransactionReceipt, useWriteContract } from 'wagmi';

import type { ActiveCompanionValue } from '@/components/lobster/useActiveCompanion';
import { ClawNFAABI } from '@/contracts/abis/ClawNFA';
import { addresses, getBscScanTxUrl } from '@/contracts/addresses';
import type { TerminalCard } from '@/lib/terminal-cards';
import type { LocalMemoryEntry, TerminalMemorySnapshot, TerminalMemorySummary } from '@/lib/terminal-memory-local';

import styles from './TerminalHome.module.css';

export type TerminalMemoryController = {
  summary: TerminalMemorySummary | null;
  timeline: TerminalMemorySnapshot[];
  refresh: () => Promise<void>;
  appendLocalEntry: (entry: Omit<LocalMemoryEntry, 'id' | 'createdAt'> & { id?: string; createdAt?: string }) => LocalMemoryEntry;
  patchLocalEntry: (entryId: string, patch: Partial<Omit<LocalMemoryEntry, 'id' | 'createdAt' | 'content'>>) => void;
};

type MemoryWriteResponse = {
  acceptedAt: string;
  contentHash: string;
  persisted: boolean;
  storage: 'backend' | 'local' | 'none';
  summary: TerminalMemorySummary | null;
  snapshot: TerminalMemorySnapshot | null;
};

function storageLabel(value: 'browser' | 'backend' | 'local') {
  if (value === 'backend') return '项目后端';
  if (value === 'local') return '本地落盘';
  return '当前浏览器';
}

export function TerminalMemoryPanel({
  companion,
  memory,
  memoryCandidate,
  onClose,
  onReceipt,
}: {
  companion: ActiveCompanionValue;
  memory: TerminalMemoryController;
  memoryCandidate?: string;
  onClose: () => void;
  onReceipt: (card: TerminalCard) => void;
}) {
  const { data: hash, error, isPending, writeContractAsync } = useWriteContract();
  const receiptQuery = useWaitForTransactionReceipt({ hash });
  const [text, setText] = useState(memoryCandidate ?? '');
  const [persisting, setPersisting] = useState(false);
  const [awaitingWallet, setAwaitingWallet] = useState(false);
  const [handledHash, setHandledHash] = useState<string | null>(null);
  const [persistNotice, setPersistNotice] = useState<string | null>(null);
  const [pendingEntryId, setPendingEntryId] = useState<string | null>(null);
  const [storageMode, setStorageMode] = useState<'browser' | 'backend' | 'local'>('browser');

  useEffect(() => {
    if (memoryCandidate) setText(memoryCandidate);
  }, [memoryCandidate]);

  const trimmed = text.trim().slice(0, 500);
  const memoryRoot = trimmed ? keccak256(toBytes(`claworld-cml:${companion.tokenId.toString()}:${trimmed}`)) : null;

  async function handleWrite() {
    if (!memoryRoot || isPending || receiptQuery.isLoading || persisting) return;

    const localEntry = memory.appendLocalEntry({
      content: trimmed,
      memoryRoot,
      txHash: null,
      storage: 'browser',
    });
    setPendingEntryId(localEntry.id);
    setStorageMode('browser');
    setPersistNotice('正文先保存在当前浏览器，接着确认链上记忆根。');

    setPersisting(true);
    try {
      const response = await fetch(`/api/memory/${companion.tokenId.toString()}/write`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          content: trimmed,
          owner: companion.ownerAddress,
          memoryRoot,
        }),
      });
      const payload = (await response.json().catch(() => null)) as MemoryWriteResponse | { error?: string } | null;
      if (response.ok && payload && 'storage' in payload) {
        const nextStorage = payload.storage === 'backend' ? 'backend' : payload.storage === 'local' ? 'local' : 'browser';
        memory.patchLocalEntry(localEntry.id, { storage: nextStorage });
        setStorageMode(nextStorage);
        setPersistNotice(
          payload.persisted
            ? `正文已同步到${storageLabel(nextStorage)}，现在只差链上确认。`
            : '后端正文存储还没接上，这次先保存在当前浏览器。',
        );
      } else if (payload && 'error' in payload && payload.error) {
        setPersistNotice(`正文先保存在当前浏览器。后端回执：${payload.error}`);
      }
    } catch {
      setPersistNotice('正文先保存在当前浏览器。后端正文存储暂时没接上。');
    } finally {
      setPersisting(false);
    }

    setAwaitingWallet(true);
    try {
      await writeContractAsync({
        address: addresses.clawNFA,
        abi: ClawNFAABI,
        functionName: 'updateLearningTreeByOwner',
        args: [companion.tokenId, memoryRoot],
      });
    } finally {
      setAwaitingWallet(false);
    }
  }

  useEffect(() => {
    if (!hash || handledHash === hash || !receiptQuery.data || !memoryRoot || !pendingEntryId) return;
    setHandledHash(hash);
    memory.patchLocalEntry(pendingEntryId, { memoryRoot, txHash: hash, storage: storageMode });
    void memory.refresh();
    onReceipt({
      id: `memory-receipt-${hash}`,
      type: 'receipt',
      label: '记忆回执',
      title: '长期记忆已更新',
      body:
        storageMode === 'backend'
          ? '正文已经交给项目后端，记忆根也写进学习树了。接下来的对话会优先带着这条记忆。'
          : storageMode === 'local'
            ? '正文已经落到本地文件，记忆根也写进学习树了。接下来的对话会优先带着这条记忆。'
            : '正文先保存在当前浏览器，记忆根已经写进学习树。接下来的对话会先按本地记忆继续。',
      details: [
        { label: 'NFA', value: `#${companion.tokenNumber}` },
        { label: '正文', value: storageLabel(storageMode), tone: 'cool' },
        { label: '记忆根', value: `${memoryRoot.slice(0, 10)}...${memoryRoot.slice(-6)}`, tone: 'growth' },
        { label: '交易', value: `${hash.slice(0, 10)}...`, tone: 'warm' },
      ],
      cta: { label: '查看交易', href: getBscScanTxUrl(hash) },
    });
  }, [companion.tokenNumber, handledHash, hash, memory, memoryRoot, onReceipt, pendingEntryId, receiptQuery.data, storageMode]);

  return (
    <section className={styles.inlinePanel}>
      <div className={styles.inlineHead}>
        <div>
          <span>长期记忆</span>
          <strong>确认一句话，写进学习树</strong>
        </div>
        <div className={styles.inlineHeadActions}>
          <Brain size={18} />
          <button type="button" className={styles.panelButton} onClick={onClose}>
            <X size={14} />
            收起
          </button>
        </div>
      </div>

      <div className={styles.actionHero}>
        <div>
          <span>写入对象</span>
          <strong>#{companion.tokenNumber}</strong>
          <small className={styles.heroMetaLine}>{companion.name}</small>
        </div>
        <p>正文会先交给后端或本地记忆层，链上只写记忆根。对话读取时会优先带上这条身份记忆。</p>
      </div>

      <label className={styles.compactField}>
        <span>记忆内容</span>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value.slice(0, 500))}
          rows={4}
          className={styles.compactTextarea}
          placeholder="例如：以后叫我船长。你说话短一点，像真的在旁边陪我。"
        />
      </label>

      <div className={styles.inlineSummary}>
        <div>
          <span>写入方式</span>
          <strong>CML hash</strong>
        </div>
        <div>
          <span>正文</span>
          <strong>{storageLabel(storageMode)}</strong>
        </div>
        <div>
          <span>长度</span>
          <strong>{trimmed.length}/500</strong>
        </div>
        <div>
          <span>记忆根</span>
          <strong>{memoryRoot ? `${memoryRoot.slice(0, 8)}...` : '--'}</strong>
        </div>
      </div>

      <div className={styles.inlineNote}>
        {persistNotice ?? '适合写名字、说话方式、偏好和长期规则。不适合塞整段长聊天。'}
      </div>

      <div className={styles.inlineActions}>
        <button
          type="button"
          className={styles.primaryPanelButton}
          onClick={() => void handleWrite()}
          disabled={!memoryRoot || isPending || receiptQuery.isLoading || persisting}
        >
          <Brain size={16} />
          {persisting ? '保存正文中' : awaitingWallet ? '等待钱包确认' : receiptQuery.isLoading ? '链上确认中' : '写入记忆'}
        </button>
        <span className={styles.actionHint}>确认后才会上链</span>
      </div>

      {error ? <p className={styles.panelError}>{error instanceof Error ? error.message : '写入失败'}</p> : null}
      {hash ? (
        <a className={styles.panelLink} href={getBscScanTxUrl(hash)} target="_blank" rel="noreferrer">
          查看交易 {hash.slice(0, 10)}...
        </a>
      ) : null}
    </section>
  );
}
