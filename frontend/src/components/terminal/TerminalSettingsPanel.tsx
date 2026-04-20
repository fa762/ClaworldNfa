'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, KeyRound, LockKeyhole, Server, ShieldCheck, Trash2, Wallet } from 'lucide-react';
import { useAccount } from 'wagmi';

import type { TerminalCard } from '@/lib/terminal-cards';
import { type ChatEngineDraft, type ChatEngineProviderId, useChatEngine } from '@/lib/chat-engine';

import styles from './TerminalHome.module.css';

const PROVIDERS: Array<{ value: ChatEngineProviderId; label: string; hint: string }> = [
  { value: 'openai', label: 'OpenAI', hint: '适合默认聊天、联网整理和动作意图。' },
  { value: 'deepseek', label: 'DeepSeek', hint: '便宜，中文也够用。' },
  { value: 'custom', label: '自定义', hint: '填你自己的 OpenAI 兼容接口。' },
];

function providerLabel(value: ChatEngineProviderId) {
  return PROVIDERS.find((item) => item.value === value)?.label || value;
}

export function TerminalSettingsPanel({
  onClose,
  onReceipt,
}: {
  onClose: () => void;
  onReceipt: (card: TerminalCard) => void;
}) {
  const { isConnected, address } = useAccount();
  const engine = useChatEngine();
  const [draft, setDraft] = useState<ChatEngineDraft>(() => engine.defaultDraft('openai'));
  const [message, setMessage] = useState<string | null>(null);
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
      return '当前对话正在走你的 BYOK。';
    }
    if (engine.preferredMode === 'byok' && engine.hasStoredByok && !engine.unlocked) {
      return '你已经切到 BYOK，但现在还没解锁。';
    }
    return '当前对话走项目模型。';
  }, [engine.activeMode, engine.hasStoredByok, engine.preferredMode, engine.unlocked]);

  async function handleSave() {
    setIsWorking(true);
    setMessage(null);
    try {
      await engine.saveByok(draft);
      setMessage('已保存，并切到你的模型。');
      onReceipt({
        id: `settings-save-${Date.now()}`,
        type: 'receipt',
        label: '模型设置',
        title: 'BYOK 已生效',
        body: `当前终端会优先使用 ${providerLabel(draft.provider)} / ${draft.model}。`,
        details: [
          { label: '模式', value: 'BYOK', tone: 'warm' },
          { label: '提供商', value: providerLabel(draft.provider), tone: 'cool' },
          { label: '模型', value: draft.model || '--', tone: 'growth' },
        ],
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败');
    } finally {
      setIsWorking(false);
    }
  }

  async function handleUnlock() {
    setIsWorking(true);
    setMessage(null);
    try {
      await engine.unlockByok();
      setMessage('已解锁，终端聊天会直接使用你的模型。');
      onReceipt({
        id: `settings-unlock-${Date.now()}`,
        type: 'receipt',
        label: '模型设置',
        title: 'BYOK 已解锁',
        body: '当前浏览器里的加密模型配置已经解锁，后续终端消息会直接走你的 Key。',
        details: [
          { label: '模式', value: 'BYOK', tone: 'warm' },
          { label: '钱包', value: address ? `${address.slice(0, 8)}...${address.slice(-4)}` : '--', tone: 'cool' },
        ],
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '解锁失败');
    } finally {
      setIsWorking(false);
    }
  }

  function handleClear() {
    engine.clearByok();
    setMessage('已清除本地 BYOK，终端回到项目模型。');
    onReceipt({
      id: `settings-clear-${Date.now()}`,
      type: 'receipt',
      label: '模型设置',
      title: '已切回项目模型',
      body: '浏览器里保存的 BYOK 已清除，终端后续会继续走项目默认模型。',
      details: [
        { label: '模式', value: 'PROJECT', tone: 'cool' },
      ],
    });
  }

  return (
    <section className={styles.inlinePanel}>
      <div className={styles.inlineHead}>
        <div className={styles.inlineHeadActions}>
          <button type="button" className={styles.panelButton} onClick={onClose}>
            <ChevronLeft size={14} />
            返回
          </button>
        </div>
        <div>
          <span>模型设置</span>
          <strong>只控制终端对话走哪套模型</strong>
        </div>
      </div>

      <div className={styles.actionHero}>
        <div>
          <span>当前模式</span>
          <strong>{engine.activeMode === 'byok' ? 'BYOK' : '项目模型'}</strong>
          <small className={styles.heroMetaLine}>{modeCopy}</small>
        </div>
        <div>
          <span>当前钱包</span>
          <strong>{address ? `${address.slice(0, 8)}...${address.slice(-4)}` : '未连接'}</strong>
          <small className={styles.heroMetaLine}>保存和解锁都要当前钱包签名。</small>
        </div>
        <div>
          <span>当前引擎</span>
          <strong>{engine.engine ? `${providerLabel(engine.engine.provider)} / ${engine.engine.model}` : '项目后端'}</strong>
          <small className={styles.heroMetaLine}>链上动作、记忆、结果回执还是走同一条终端链路。</small>
        </div>
      </div>

      <div className={styles.inlineSummary}>
        <div>
          <span>模式</span>
          <strong>{engine.activeMode === 'byok' ? 'BYOK' : 'PROJECT'}</strong>
        </div>
        <div>
          <span>已保存</span>
          <strong>{engine.hasStoredByok ? '是' : '否'}</strong>
        </div>
        <div>
          <span>已解锁</span>
          <strong>{engine.unlocked ? '是' : '否'}</strong>
        </div>
        <div>
          <span>签名钱包</span>
          <strong>{isConnected ? '已连接' : '未连接'}</strong>
        </div>
      </div>

      <div className={styles.inlineActions}>
        <button
          type="button"
          className={engine.preferredMode === 'project' ? styles.primaryPanelButton : styles.panelButton}
          onClick={() => engine.setPreferredMode('project')}
        >
          <Server size={16} />
          项目模型
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
            解锁
          </button>
        ) : null}
      </div>

      <label className={styles.compactField}>
        <span>提供商</span>
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
              {provider.label}
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
        <span>模型名</span>
        <input
          className={styles.compactInput}
          value={draft.model}
          onChange={(event) => setDraft((current) => ({ ...current, model: event.target.value }))}
          placeholder="gpt-4o-mini"
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

      <div className={styles.inlineNote}>
        {PROVIDERS.find((item) => item.value === draft.provider)?.hint ?? '当前浏览器里会加密保存你的 Key。'}
      </div>

      <div className={styles.inlineActions}>
        <button
          type="button"
          className={styles.primaryPanelButton}
          onClick={() => void handleSave()}
          disabled={!isConnected || isWorking || engine.isBusy}
        >
          <KeyRound size={16} />
          保存并切换
        </button>
        {engine.hasStoredByok ? (
          <button
            type="button"
            className={styles.panelButton}
            onClick={handleClear}
            disabled={isWorking || engine.isBusy}
          >
            <Trash2 size={16} />
            清除 BYOK
          </button>
        ) : null}
      </div>

      {message ? <div className={styles.inlineNote}>{message}</div> : null}
      <div className={styles.inlineSummary}>
        <div>
          <span>说明</span>
          <strong>这一步只影响聊天模型</strong>
        </div>
        <div>
          <span>动作</span>
          <strong>仍由终端动作卡处理</strong>
        </div>
      </div>
    </section>
  );
}
