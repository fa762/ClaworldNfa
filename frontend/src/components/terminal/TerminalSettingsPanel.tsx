'use client';

import { useEffect, useMemo, useState } from 'react';
import { LockKeyhole, Server, ShieldCheck } from 'lucide-react';
import { useAccount } from 'wagmi';

import type { TerminalCard } from '@/lib/terminal-cards';
import { type ChatEngineDraft, type ChatEngineProviderId, useChatEngine } from '@/lib/chat-engine';
import { useI18n } from '@/lib/i18n';

import styles from './TerminalHome.module.css';

const PROVIDERS: Array<{ value: ChatEngineProviderId; labelZh: string; labelEn: string; hintZh: string; hintEn: string }> = [
  { value: 'openai', labelZh: 'OpenAI', labelEn: 'OpenAI', hintZh: '适合日常对话、联网整理和动作意图。', hintEn: 'Best for chat, web-aware answers, and action intent.' },
  { value: 'deepseek', labelZh: 'DeepSeek', labelEn: 'DeepSeek', hintZh: '更便宜，中文也够用。', hintEn: 'Lower cost and solid Chinese support.' },
  { value: 'custom', labelZh: '自定义', labelEn: 'Custom', hintZh: '填你自己的 OpenAI 兼容接口。', hintEn: 'Use any OpenAI-compatible endpoint.' },
];

function providerLabel(value: ChatEngineProviderId, pick: <T,>(zh: T, en: T) => T) {
  const provider = PROVIDERS.find((item) => item.value === value);
  return provider ? pick(provider.labelZh, provider.labelEn) : value;
}

export function TerminalSettingsPanel({
  onClose,
  onReceipt,
}: {
  onClose: () => void;
  onReceipt: (card: TerminalCard) => void;
}) {
  const { isConnected, address } = useAccount();
  const { pick } = useI18n();
  const engine = useChatEngine();
  const [draft, setDraft] = useState<ChatEngineDraft>(() => engine.defaultDraft('openai'));
  const [message, setMessage] = useState<string | null>(null);
  const [messageKind, setMessageKind] = useState<'success' | 'error' | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    if (engine.engine) {
      setDraft({
        provider: engine.engine.provider,
        apiKey: engine.engine.apiKey,
        baseUrl: engine.engine.baseUrl,
        model: engine.engine.model,
      });
      return;
    }
    if (engine.storedMeta) {
      setDraft({
        ...engine.defaultDraft(engine.storedMeta.provider),
        apiKey: '',
        baseUrl: engine.storedMeta.baseUrl,
        model: engine.storedMeta.model,
      });
      return;
    }
    setDraft(engine.defaultDraft('openai'));
  }, [engine]);

  const modeCopy = useMemo(() => {
    if (engine.activeMode === 'byok' && engine.unlocked) {
      return pick('当前对话正在走你自己的模型。', 'Current chat is using your model.');
    }
    if (engine.preferredMode === 'byok' && engine.hasStoredByok && !engine.unlocked) {
      return pick('你已经切到 BYOK，但当前浏览器还没解锁。', 'BYOK is selected, but this browser session is still locked.');
    }
    return pick('当前对话正在走项目模型。', 'Current chat is using the project model.');
  }, [engine.activeMode, engine.hasStoredByok, engine.preferredMode, engine.unlocked, pick]);

  async function handleSave() {
    setIsWorking(true);
    setMessage(null);
    setMessageKind(null);
    try {
      await engine.saveByok(draft);
      setMessage(pick('已保存，并切到你的模型。', 'Saved. Chat is now using your model.'));
      setMessageKind('success');
      onReceipt({
        id: `settings-save-${Date.now()}`,
        type: 'receipt',
        label: pick('模型设置', 'Model settings'),
        title: pick('BYOK 已生效', 'BYOK enabled'),
        body: pick(`后续终端会优先走 ${providerLabel(draft.provider, pick)} / ${draft.model}。`, `The terminal will prefer ${providerLabel(draft.provider, pick)} / ${draft.model}.`),
        details: [
          { label: pick('模式', 'Mode'), value: 'BYOK', tone: 'warm' },
          { label: pick('提供商', 'Provider'), value: providerLabel(draft.provider, pick), tone: 'cool' },
          { label: pick('模型', 'Model'), value: draft.model || '--', tone: 'growth' },
        ],
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : pick('保存失败', 'Save failed'));
      setMessageKind('error');
    } finally {
      setIsWorking(false);
    }
  }

  async function handleUnlock() {
    setIsWorking(true);
    setMessage(null);
    setMessageKind(null);
    try {
      await engine.unlockByok();
      setMessage(pick('已解锁，后续对话会直接用你的模型。', 'Unlocked. Chat will use your model.'));
      setMessageKind('success');
      onReceipt({
        id: `settings-unlock-${Date.now()}`,
        type: 'receipt',
        label: pick('模型设置', 'Model settings'),
        title: pick('BYOK 已解锁', 'BYOK unlocked'),
        body: pick('浏览器里加密保存的模型配置已经解锁，本次对话会直接走你的 Key。', 'The encrypted model config in this browser is unlocked. This session will use your key.'),
        details: [
          { label: pick('模式', 'Mode'), value: 'BYOK', tone: 'warm' },
          { label: pick('钱包', 'Wallet'), value: address ? `${address.slice(0, 8)}...${address.slice(-4)}` : '--', tone: 'cool' },
        ],
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : pick('解锁失败', 'Unlock failed'));
      setMessageKind('error');
    } finally {
      setIsWorking(false);
    }
  }

  function handleClear() {
    engine.clearByok();
    setMessage(pick('已清除本地 BYOK，终端回到项目模型。', 'Local BYOK cleared. The terminal is back on the project model.'));
    setMessageKind('success');
    onReceipt({
      id: `settings-clear-${Date.now()}`,
      type: 'receipt',
      label: pick('模型设置', 'Model settings'),
      title: pick('已切回项目模型', 'Project model restored'),
      body: pick('浏览器里保存的 BYOK 已清除，终端后续会继续走项目默认模型。', 'Saved BYOK data was cleared. The terminal will use the project default model.'),
      details: [{ label: pick('模式', 'Mode'), value: pick('项目模型', 'Project model'), tone: 'cool' }],
    });
  }

  return (
    <section className={styles.inlinePanel}>
      <div className={styles.inlineHead}>
        <div className={styles.inlineHeadActions}>
          <button type="button" className={styles.panelButton} onClick={onClose}>
            {pick('返回', 'Back')}
          </button>
        </div>
        <div>
          <span>{pick('模型设置', 'Model settings')}</span>
          <strong>{pick('这里只控制对话走哪套模型', 'Choose which model powers chat')}</strong>
        </div>
      </div>

      <div className={styles.actionHero}>
        <div>
          <span>{pick('当前模式', 'Current mode')}</span>
          <strong>{engine.activeMode === 'byok' ? 'BYOK' : pick('项目模型', 'Project model')}</strong>
          <small className={styles.heroMetaLine}>{modeCopy}</small>
        </div>
        <div>
          <span>{pick('当前钱包', 'Current wallet')}</span>
          <strong>{address ? `${address.slice(0, 8)}...${address.slice(-4)}` : pick('未连接', 'Not connected')}</strong>
          <small className={styles.heroMetaLine}>{pick('保存和解锁都要当前钱包签名', 'Saving and unlocking require this wallet signature')}</small>
        </div>
        <div>
          <span>{pick('当前引擎', 'Current engine')}</span>
          <strong>{engine.engine ? `${providerLabel(engine.engine.provider, pick)} / ${engine.engine.model}` : pick('项目后端', 'Project backend')}</strong>
          <small className={styles.heroMetaLine}>{pick('链上动作、记忆和回执仍然走同一条终端链路', 'On-chain actions, memory, and receipts stay on the same terminal path')}</small>
        </div>
      </div>

      <div className={styles.inlineSummary}>
        <div>
          <span>{pick('模式', 'Mode')}</span>
          <strong>{engine.activeMode === 'byok' ? 'BYOK' : pick('项目模型', 'Project model')}</strong>
        </div>
        <div>
          <span>{pick('已保存', 'Saved')}</span>
          <strong>{engine.hasStoredByok ? pick('是', 'Yes') : pick('否', 'No')}</strong>
        </div>
        <div>
          <span>{pick('已解锁', 'Unlocked')}</span>
          <strong>{engine.unlocked ? pick('是', 'Yes') : pick('否', 'No')}</strong>
        </div>
        <div>
          <span>{pick('签名钱包', 'Signing wallet')}</span>
          <strong>{isConnected ? pick('已连接', 'Connected') : pick('未连接', 'Not connected')}</strong>
        </div>
      </div>

      <div className={styles.inlineActions}>
        <button
          type="button"
          className={engine.preferredMode === 'project' ? styles.primaryPanelButton : styles.panelButton}
          onClick={() => engine.setPreferredMode('project')}
        >
          <Server size={16} />
          {pick('项目模型', 'Project model')}
        </button>
        <button
          type="button"
          className={engine.preferredMode === 'byok' ? styles.primaryPanelButton : styles.panelButton}
          onClick={() => engine.setPreferredMode('byok')}
          disabled={!engine.hasStoredByok && !engine.unlocked}
        >
          <ShieldCheck size={16} />
          BYOK
        </button>
        {engine.hasStoredByok && !engine.unlocked ? (
          <button type="button" className={styles.panelButton} onClick={() => void handleUnlock()} disabled={!isConnected || isWorking}>
            <LockKeyhole size={16} />
            {pick('解锁', 'Unlock')}
          </button>
        ) : null}
      </div>

      <label className={styles.compactField}>
        <span>{pick('提供商', 'Provider')}</span>
        <select
          className={styles.compactInput}
          value={draft.provider}
          onChange={(event) => {
            const nextProvider = event.target.value as ChatEngineProviderId;
            setDraft((current) => ({
              ...engine.defaultDraft(nextProvider),
              apiKey: current.provider === nextProvider ? current.apiKey : '',
            }));
          }}
        >
          {PROVIDERS.map((provider) => (
            <option key={provider.value} value={provider.value}>
              {pick(provider.labelZh, provider.labelEn)}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.compactField}>
        <span>Base URL</span>
        <input
          className={styles.compactInput}
          value={draft.baseUrl}
          onChange={(event) => setDraft((current) => ({ ...current, baseUrl: event.target.value }))}
          placeholder="https://api.openai.com/v1"
        />
      </label>

      <label className={styles.compactField}>
        <span>{pick('模型名', 'Model')}</span>
        <input
          className={styles.compactInput}
          value={draft.model}
          onChange={(event) => setDraft((current) => ({ ...current, model: event.target.value }))}
          placeholder="gpt-5.5"
        />
      </label>

      <label className={styles.compactField}>
        <span>API Key</span>
        <input
          className={styles.compactInput}
          value={draft.apiKey}
          onChange={(event) => setDraft((current) => ({ ...current, apiKey: event.target.value }))}
          placeholder="sk-..."
          type="password"
          autoComplete="off"
        />
      </label>

      <div className={styles.inlineActions}>
        <button type="button" className={styles.primaryPanelButton} onClick={() => void handleSave()} disabled={!isConnected || isWorking}>
          {pick('保存并切到 BYOK', 'Save and use BYOK')}
        </button>
        <button type="button" className={styles.panelButton} onClick={handleClear} disabled={!engine.hasStoredByok || isWorking}>
          {pick('清除本地 BYOK', 'Clear local BYOK')}
        </button>
      </div>

      {PROVIDERS.map((provider) => (
        <p key={provider.value} className={styles.inlineNote}>
          <strong>{pick(provider.labelZh, provider.labelEn)}</strong>：{pick(provider.hintZh, provider.hintEn)}
        </p>
      ))}

      {message ? <p className={messageKind === 'success' ? styles.panelSuccess : styles.panelError}>{message}</p> : null}
    </section>
  );
}
