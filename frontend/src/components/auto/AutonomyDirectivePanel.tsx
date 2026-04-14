'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bot, PenSquare } from 'lucide-react';
import { useAccount, useSignMessage } from 'wagmi';

import { useI18n } from '@/lib/i18n';

type DirectiveStyle = 'tight' | 'balanced' | 'expressive';

type DirectiveApiResponse = {
  tokenId: number;
  actionKind: number;
  style: DirectiveStyle;
  text: string;
  updatedAt: number | null;
  updatedBy: string | null;
  error?: string;
};

const STYLE_OPTIONS: Array<{ value: DirectiveStyle; zh: string; en: string; zhHint: string; enHint: string }> = [
  {
    value: 'tight',
    zh: '保守',
    en: 'Tight',
    zhHint: '先保底，再行动。',
    enHint: 'Protect reserve first, then act.',
  },
  {
    value: 'balanced',
    zh: '平衡',
    en: 'Balanced',
    zhHint: '收益和风险一起看。',
    enHint: 'Balance upside and risk.',
  },
  {
    value: 'expressive',
    zh: '激进',
    en: 'Aggressive',
    zhHint: '机会明显时更主动。',
    enHint: 'Push harder when the upside is clear.',
  },
];

function buildDirectiveTemplate(style: DirectiveStyle) {
  if (style === 'tight') {
    return '优先保底和稳定，只有在把握足够时再行动。';
  }
  if (style === 'expressive') {
    return '机会足够明显时更主动，但不要越过预算和保底。';
  }
  return '在收益、风险和续航之间做平衡。';
}

function buildDirectivePreview(style: DirectiveStyle, extra: string) {
  const base = buildDirectiveTemplate(style);
  const trimmed = extra.trim();
  return trimmed ? `${base} ${trimmed}` : base;
}

function buildDirectiveMessage(
  tokenId: bigint,
  actionKind: number,
  style: DirectiveStyle,
  text: string,
  issuedAt: number,
) {
  return [
    'Clawworld Autonomy Directive',
    `tokenId:${tokenId.toString()}`,
    `actionKind:${actionKind}`,
    `style:${style}`,
    `text:${text.trim().slice(0, 220)}`,
    `issuedAt:${issuedAt}`,
  ].join('\n');
}

export function AutonomyDirectivePanel({
  tokenId,
  actionKind,
  ownerAddress,
  title = 'Prompt',
}: {
  tokenId: bigint;
  actionKind: number;
  ownerAddress?: string;
  title?: string;
}) {
  const { pick } = useI18n();
  const { address } = useAccount();
  const { signMessageAsync, isPending: isSigning } = useSignMessage();
  const isOwner =
    Boolean(address && ownerAddress) && address!.toLowerCase() === ownerAddress!.toLowerCase();

  const [style, setStyle] = useState<DirectiveStyle>('balanced');
  const [text, setText] = useState('');
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDirective() {
      setLoading(true);
      setError(null);
      setSuccess(null);

      try {
        const response = await fetch(
          `/api/autonomy/directive?tokenId=${tokenId.toString()}&actionKind=${actionKind}`,
          { cache: 'no-store' },
        );
        const data = (await response.json()) as DirectiveApiResponse;
        if (!response.ok) throw new Error(data.error || 'Failed to load directive.');
        if (cancelled) return;
        setStyle(data.style);
        setText(data.text);
        setUpdatedAt(data.updatedAt);
      } catch (loadError) {
        if (!cancelled) setError((loadError as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadDirective();

    return () => {
      cancelled = true;
    };
  }, [actionKind, tokenId]);

  const preview = useMemo(() => buildDirectivePreview(style, text), [style, text]);
  const remainingChars = 220 - text.length;
  const activeOption = STYLE_OPTIONS.find((option) => option.value === style);

  async function handleSave() {
    if (!isOwner || saving || isSigning || !address) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const issuedAt = Date.now();
      const trimmed = text.trim().slice(0, 220);
      const message = buildDirectiveMessage(tokenId, actionKind, style, trimmed, issuedAt);
      const signature = await signMessageAsync({ message });

      const response = await fetch('/api/autonomy/directive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenId: Number(tokenId),
          actionKind,
          style,
          text: trimmed,
          issuedAt,
          signer: address,
          signature,
        }),
      });

      const data = (await response.json()) as DirectiveApiResponse;
      if (!response.ok) throw new Error(data.error || 'Failed to save directive.');

      setStyle(data.style);
      setText(data.text);
      setUpdatedAt(data.updatedAt);
      setSuccess(pick('设定已保存。', 'Settings saved.'));
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="cw-panel cw-panel--cool">
      <div className="cw-section-head">
        <div>
          <span className="cw-label">{title}</span>
          <h3>{pick('告诉代理怎么做', 'Tell the agent how to act')}</h3>
        </div>
        <span className="cw-chip cw-chip--cool">
          <Bot size={14} />
          {pick('策略', 'Policy')}
        </span>
      </div>

      <div className="cw-field-grid">
        <label className="cw-field">
          <span className="cw-label">{pick('风格', 'Style')}</span>
          <select
            value={style}
            onChange={(event) => {
              setStyle(event.target.value as DirectiveStyle);
              setSuccess(null);
              setError(null);
            }}
            disabled={!isOwner || loading || saving || isSigning}
            className="cw-input"
          >
            {STYLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {pick(option.zh, option.en)}
              </option>
            ))}
          </select>
          {activeOption ? <p className="cw-muted">{pick(activeOption.zhHint, activeOption.enHint)}</p> : null}
        </label>

        <label className="cw-field">
          <span className="cw-label">{pick('一句提示', 'Prompt')}</span>
          <textarea
            value={text}
            onChange={(event) => {
              setText(event.target.value.slice(0, 220));
              setSuccess(null);
              setError(null);
            }}
            rows={4}
            disabled={!isOwner || loading || saving || isSigning}
            className="cw-input cw-input--textarea"
            placeholder={pick('比如：先领已结算奖励，再进新一局。', 'Example: Claim settled rewards before entering a new match.')}
          />
          <p className="cw-muted">{text.length}/220 · {remainingChars} {pick('字可用', 'chars left')}</p>
        </label>
      </div>

      <div className="cw-panel cw-panel--warm">
        <div className="cw-section-head">
          <div>
            <span className="cw-label">{pick('当前效果', 'Current effect')}</span>
            <h3>{pick('代理会按这个口径做判断', 'This is how the agent will reason')}</h3>
          </div>
          <span className="cw-chip cw-chip--warm">
            <PenSquare size={14} />
            {pick('预览', 'Preview')}
          </span>
        </div>
        <p className="cw-muted">{loading ? pick('正在读取设定...', 'Loading settings...') : preview}</p>
        {updatedAt ? (
          <p className="cw-muted">
            {pick('最近保存', 'Last saved')} {new Date(updatedAt).toLocaleString()}
          </p>
        ) : null}
      </div>

      {isSigning ? (
        <div className="cw-list">
          <div className="cw-list-item cw-list-item--warm">
            <Bot size={16} />
            <span>{pick('去钱包确认这次保存。', 'Confirm this save in your wallet.')}</span>
          </div>
        </div>
      ) : null}

      <div className="cw-button-row">
        <button
          type="button"
          onClick={handleSave}
          disabled={!isOwner || loading || saving || isSigning}
          className="cw-button cw-button--secondary"
        >
          <Bot size={16} />
          {saving || isSigning ? pick('保存中', 'Saving') : pick('保存设定', 'Save settings')}
        </button>
      </div>

      {!isOwner ? <p className="cw-muted">{pick('只有持有人钱包可以改这里。', 'Only the owner wallet can edit this.')}</p> : null}
      {success ? <p className="cw-result-celebration">{success}</p> : null}
      {error ? <p className="cw-muted">{pick(`保存失败：${error}`, `Save failed: ${error}`)}</p> : null}
    </section>
  );
}
