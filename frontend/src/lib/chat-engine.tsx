'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAccount, useSignMessage } from 'wagmi';

export type ChatEngineMode = 'project' | 'byok';
export type ChatEngineProviderId = 'openai' | 'deepseek' | 'custom';

export type ChatEngineDraft = {
  provider: ChatEngineProviderId;
  apiKey: string;
  baseUrl: string;
  model: string;
};

export type ChatEngineRequest = ChatEngineDraft & {
  mode: 'byok';
};

type StoredEngineEnvelope = {
  version: 1;
  wallet: string;
  provider: ChatEngineProviderId;
  baseUrl: string;
  model: string;
  salt: string;
  iv: string;
  cipher: string;
  updatedAt: string;
};

type ChatEngineContextValue = {
  preferredMode: ChatEngineMode;
  activeMode: ChatEngineMode;
  hasStoredByok: boolean;
  unlocked: boolean;
  isBusy: boolean;
  storedMeta: Pick<StoredEngineEnvelope, 'provider' | 'baseUrl' | 'model' | 'updatedAt'> | null;
  engine: ChatEngineRequest | null;
  setPreferredMode: (mode: ChatEngineMode) => void;
  saveByok: (draft: ChatEngineDraft) => Promise<void>;
  unlockByok: () => Promise<void>;
  clearByok: () => void;
  defaultDraft: (provider?: ChatEngineProviderId) => ChatEngineDraft;
};

const ChatEngineContext = createContext<ChatEngineContextValue | null>(null);

const ENGINE_VERSION = 1;

function providerDefaults(provider: ChatEngineProviderId): ChatEngineDraft {
  if (provider === 'openai') {
    return {
      provider,
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
    };
  }

  if (provider === 'deepseek') {
    return {
      provider,
      apiKey: '',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-chat',
    };
  }

  return {
    provider: 'custom',
    apiKey: '',
    baseUrl: '',
    model: '',
  };
}

function engineKey(address?: string) {
  if (!address) return null;
  return `clawworld-chat-engine:${address.toLowerCase()}`;
}

function modeKey(address?: string) {
  if (!address) return null;
  return `clawworld-chat-mode:${address.toLowerCase()}`;
}

function toBase64(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return window.btoa(binary);
}

function fromBase64(value: string) {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function deriveEncryptionKey(signature: string, salt: Uint8Array) {
  const encoder = new TextEncoder();
  const material = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(signature),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(salt),
      iterations: 180_000,
      hash: 'SHA-256',
    },
    material,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt'],
  );
}

function unlockMessage(address: string) {
  return [
    'Clawworld BYOK unlock',
    `wallet:${address.toLowerCase()}`,
    'Purpose: unlock your local encrypted chat engine settings.',
  ].join('\n');
}

function readEnvelope(key: string | null) {
  if (!key || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredEngineEnvelope>;
    if (
      parsed.version !== ENGINE_VERSION ||
      typeof parsed.wallet !== 'string' ||
      typeof parsed.provider !== 'string' ||
      typeof parsed.baseUrl !== 'string' ||
      typeof parsed.model !== 'string' ||
      typeof parsed.salt !== 'string' ||
      typeof parsed.iv !== 'string' ||
      typeof parsed.cipher !== 'string' ||
      typeof parsed.updatedAt !== 'string'
    ) {
      return null;
    }
    return parsed as StoredEngineEnvelope;
  } catch {
    return null;
  }
}

export function ChatEngineProvider({ children }: { children: ReactNode }) {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [preferredMode, setPreferredModeState] = useState<ChatEngineMode>('project');
  const [storedMeta, setStoredMeta] = useState<ChatEngineContextValue['storedMeta']>(null);
  const [engine, setEngine] = useState<ChatEngineRequest | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const currentEngineKey = useMemo(() => engineKey(address), [address]);
  const currentModeKey = useMemo(() => modeKey(address), [address]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!currentModeKey) {
      setPreferredModeState('project');
      return;
    }
    const raw = window.localStorage.getItem(currentModeKey);
    setPreferredModeState(raw === 'byok' ? 'byok' : 'project');
  }, [currentModeKey]);

  useEffect(() => {
    setEngine(null);
    setUnlocked(false);
    const envelope = readEnvelope(currentEngineKey);
    if (!envelope) {
      setStoredMeta(null);
      return;
    }
    setStoredMeta({
      provider: envelope.provider,
      baseUrl: envelope.baseUrl,
      model: envelope.model,
      updatedAt: envelope.updatedAt,
    });
  }, [currentEngineKey]);

  const setPreferredMode = useCallback(
    (mode: ChatEngineMode) => {
      setPreferredModeState(mode);
      if (typeof window !== 'undefined' && currentModeKey) {
        window.localStorage.setItem(currentModeKey, mode);
      }
    },
    [currentModeKey],
  );

  const defaultDraft = useCallback((provider: ChatEngineProviderId = 'openai') => providerDefaults(provider), []);

  const unlockByok = useCallback(async () => {
    if (!address || !currentEngineKey) {
      throw new Error('先连接钱包');
    }

    const envelope = readEnvelope(currentEngineKey);
    if (!envelope) {
      throw new Error('当前钱包还没有保存 BYOK');
    }

    setIsBusy(true);
    try {
      const signature = await signMessageAsync({ message: unlockMessage(address) });
      const key = await deriveEncryptionKey(signature, fromBase64(envelope.salt));
      const plainBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: fromBase64(envelope.iv) },
        key,
        fromBase64(envelope.cipher),
      );
      const payload = JSON.parse(new TextDecoder().decode(plainBuffer)) as ChatEngineDraft;
      if (
        typeof payload.provider !== 'string' ||
        typeof payload.apiKey !== 'string' ||
        typeof payload.baseUrl !== 'string' ||
        typeof payload.model !== 'string'
      ) {
        throw new Error('保存的 BYOK 数据格式不正确');
      }

      setEngine({
        ...payload,
        mode: 'byok',
      });
      setUnlocked(true);
      setPreferredMode('byok');
    } catch (error) {
      setEngine(null);
      setUnlocked(false);
      throw error instanceof Error ? error : new Error('解锁失败');
    } finally {
      setIsBusy(false);
    }
  }, [address, currentEngineKey, setPreferredMode, signMessageAsync]);

  const saveByok = useCallback(
    async (draft: ChatEngineDraft) => {
      if (!address || !currentEngineKey) {
        throw new Error('先连接钱包');
      }

      const normalized: ChatEngineDraft = {
        provider: draft.provider,
        apiKey: draft.apiKey.trim(),
        baseUrl: draft.baseUrl.trim().replace(/\/+$/, ''),
        model: draft.model.trim(),
      };

      if (!normalized.apiKey) throw new Error('API Key 不能为空');
      if (!normalized.baseUrl) throw new Error('Base URL 不能为空');
      if (!normalized.model) throw new Error('模型名不能为空');

      setIsBusy(true);
      try {
        const signature = await signMessageAsync({ message: unlockMessage(address) });
        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const key = await deriveEncryptionKey(signature, salt);
        const cipher = await window.crypto.subtle.encrypt(
          { name: 'AES-GCM', iv },
          key,
          new TextEncoder().encode(JSON.stringify(normalized)),
        );

        const envelope: StoredEngineEnvelope = {
          version: ENGINE_VERSION,
          wallet: address.toLowerCase(),
          provider: normalized.provider,
          baseUrl: normalized.baseUrl,
          model: normalized.model,
          salt: toBase64(salt),
          iv: toBase64(iv),
          cipher: toBase64(new Uint8Array(cipher)),
          updatedAt: new Date().toISOString(),
        };

        window.localStorage.setItem(currentEngineKey, JSON.stringify(envelope));
        setStoredMeta({
          provider: envelope.provider,
          baseUrl: envelope.baseUrl,
          model: envelope.model,
          updatedAt: envelope.updatedAt,
        });
        setEngine({
          ...normalized,
          mode: 'byok',
        });
        setUnlocked(true);
        setPreferredMode('byok');
      } catch (error) {
        throw error instanceof Error ? error : new Error('保存失败');
      } finally {
        setIsBusy(false);
      }
    },
    [address, currentEngineKey, setPreferredMode, signMessageAsync],
  );

  const clearByok = useCallback(() => {
    if (typeof window !== 'undefined' && currentEngineKey) {
      window.localStorage.removeItem(currentEngineKey);
    }
    setStoredMeta(null);
    setEngine(null);
    setUnlocked(false);
    setPreferredMode('project');
  }, [currentEngineKey, setPreferredMode]);

  const value = useMemo<ChatEngineContextValue>(() => {
    const activeMode = preferredMode === 'byok' && engine ? 'byok' : 'project';
    return {
      preferredMode,
      activeMode,
      hasStoredByok: Boolean(storedMeta),
      unlocked,
      isBusy,
      storedMeta,
      engine,
      setPreferredMode,
      saveByok,
      unlockByok,
      clearByok,
      defaultDraft,
    };
  }, [clearByok, defaultDraft, engine, isBusy, preferredMode, saveByok, setPreferredMode, storedMeta, unlockByok, unlocked]);

  return <ChatEngineContext.Provider value={value}>{children}</ChatEngineContext.Provider>;
}

export function useChatEngine() {
  const context = useContext(ChatEngineContext);
  if (!context) {
    throw new Error('useChatEngine must be used inside ChatEngineProvider');
  }
  return context;
}
