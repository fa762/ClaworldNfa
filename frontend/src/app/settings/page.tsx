'use client';

import { useEffect, useMemo, useState } from 'react';
import { KeyRound, LockKeyhole, Server, ShieldCheck, Trash2, Wallet } from 'lucide-react';
import { useAccount } from 'wagmi';

import { ConnectButton } from '@/components/wallet/ConnectButton';
import { type ChatEngineDraft, type ChatEngineProviderId, useChatEngine } from '@/lib/chat-engine';

const PROVIDERS: Array<{ value: ChatEngineProviderId; label: string; hint: string }> = [
  { value: 'openai', label: 'OpenAI', hint: '适合项目默认聊天、搜索和动作意图。' },
  { value: 'deepseek', label: 'DeepSeek', hint: '便宜，中文体验也够用。' },
  { value: 'custom', label: '自定义', hint: '填你自己的 OpenAI 兼容接口。' },
];

function providerLabel(value: ChatEngineProviderId) {
  return PROVIDERS.find((item) => item.value === value)?.label || value;
}

export default function SettingsPage() {
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
      return '你选了 BYOK，但当前还没解锁。回到终端前先点一次解锁。';
    }
    return '当前对话走项目后端模型。';
  }, [engine.activeMode, engine.hasStoredByok, engine.preferredMode, engine.unlocked]);

  async function handleSave() {
    setIsWorking(true);
    setMessage(null);
    try {
      await engine.saveByok(draft);
      setMessage('BYOK 已加密保存，当前对话已经切到你的模型。');
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
      setMessage('BYOK 已解锁，回到终端就会直接生效。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '解锁失败');
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <>
      <section className="cw-band">
        <div className="cw-band--split">
          <div>
            <p className="cw-eyebrow">模型设置</p>
            <h2 className="cw-section-title">聊天模型只做一件事：决定终端对话走项目模型，还是走你的 BYOK。</h2>
            <p className="cw-muted">动作卡、链上交易、记忆读取还是同一条终端链路，不会分裂成两套页面。</p>
          </div>
        </div>
      </section>

      <section className="cw-panel cw-panel--warm">
        <div className="cw-section-head">
          <div>
            <span className="cw-label">钱包</span>
            <h3>{isConnected && address ? address : '先连接钱包'}</h3>
            <p className="cw-muted">保存和解锁 BYOK 都要走当前钱包签名。</p>
          </div>
          <Wallet size={20} style={{ color: 'var(--color-bunker-primary)', flexShrink: 0 }} />
        </div>
        <div className="cw-button-row">
          <ConnectButton />
        </div>
      </section>

      <section className="cw-card-stack">
        <article className="cw-card cw-card--safe">
          <div className="cw-card-icon">
            <Server size={18} />
          </div>
          <div className="cw-card-copy">
            <p className="cw-label">当前模式</p>
            <h3>{engine.activeMode === 'byok' ? 'BYOK' : '项目模型'}</h3>
            <p className="cw-muted">{modeCopy}</p>
          </div>
          <span className={`cw-chip ${engine.activeMode === 'byok' ? 'cw-chip--warm' : 'cw-chip--cool'}`}>
            {engine.activeMode === 'byok' ? 'BYOK' : 'PROJECT'}
          </span>
        </article>
      </section>

      <section className="cw-panel">
        <div className="cw-section-head">
          <div>
            <span className="cw-label">模式切换</span>
            <h3>项目模型 / BYOK</h3>
            <p className="cw-muted">默认是项目模型。切到 BYOK 后，聊天会优先走你自己的 Key。</p>
          </div>
          <ShieldCheck size={20} style={{ color: 'var(--color-bunker-primary)', flexShrink: 0 }} />
        </div>
        <div className="cw-button-row">
          <button
            type="button"
            className={`cw-button ${engine.preferredMode === 'project' ? 'cw-button--primary' : 'cw-button--ghost'}`}
            onClick={() => engine.setPreferredMode('project')}
          >
            项目模型
          </button>
          <button
            type="button"
            className={`cw-button ${engine.preferredMode === 'byok' ? 'cw-button--primary' : 'cw-button--ghost'}`}
            onClick={() => engine.setPreferredMode('byok')}
            disabled={!engine.hasStoredByok && !engine.unlocked}
          >
            BYOK
          </button>
          {engine.hasStoredByok && !engine.unlocked ? (
            <button type="button" className="cw-button cw-button--ghost" onClick={() => void handleUnlock()} disabled={!isConnected || isWorking}>
              <LockKeyhole size={16} />
              解锁
            </button>
          ) : null}
        </div>
      </section>

      <section className="cw-panel">
        <div className="cw-section-head">
          <div>
            <span className="cw-label">BYOK</span>
            <h3>只支持 OpenAI 兼容接口</h3>
            <p className="cw-muted">保存时会用当前钱包签名派生加密密钥，API Key 只保存在你的浏览器里。</p>
          </div>
          <KeyRound size={20} style={{ color: 'var(--color-bunker-primary)', flexShrink: 0 }} />
        </div>

        <div className="cw-field-grid">
          <label className="cw-field">
            <span>提供商</span>
            <select
              className="cw-input"
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

          <label className="cw-field">
            <span>Base URL</span>
            <input
              className="cw-input"
              value={draft.baseUrl}
              onChange={(event) => setDraft((current) => ({ ...current, baseUrl: event.target.value }))}
              placeholder="https://api.openai.com/v1"
            />
          </label>

          <label className="cw-field">
            <span>模型名</span>
            <input
              className="cw-input"
              value={draft.model}
              onChange={(event) => setDraft((current) => ({ ...current, model: event.target.value }))}
              placeholder="gpt-4o-mini"
            />
          </label>

          <label className="cw-field">
            <span>API Key</span>
            <input
              className="cw-input"
              value={draft.apiKey}
              onChange={(event) => setDraft((current) => ({ ...current, apiKey: event.target.value }))}
              placeholder="sk-..."
              type="password"
              autoComplete="off"
            />
          </label>
        </div>

        <div className="cw-button-row">
          <button type="button" className="cw-button cw-button--primary" onClick={() => void handleSave()} disabled={!isConnected || isWorking || engine.isBusy}>
            保存并切到 BYOK
          </button>
          {engine.hasStoredByok ? (
            <button
              type="button"
              className="cw-button cw-button--ghost"
              onClick={engine.clearByok}
              disabled={isWorking || engine.isBusy}
            >
              <Trash2 size={16} />
              清除 BYOK
            </button>
          ) : null}
        </div>

        <div className="cw-card-stack" style={{ marginTop: '1rem' }}>
          <article className="cw-card cw-card--watch">
            <div className="cw-card-copy">
              <p className="cw-label">说明</p>
              <h3>{providerLabel(draft.provider)}</h3>
              <p className="cw-muted">{PROVIDERS.find((item) => item.value === draft.provider)?.hint}</p>
            </div>
            {engine.storedMeta ? (
              <span className="cw-chip cw-chip--cool">已保存 {new Date(engine.storedMeta.updatedAt).toLocaleDateString('zh-CN')}</span>
            ) : null}
          </article>
        </div>

        {message ? <p className="cw-muted" style={{ marginTop: '0.75rem', color: message.includes('失败') ? '#ff8a7a' : '#7ecfb0' }}>{message}</p> : null}
      </section>
    </>
  );
}
