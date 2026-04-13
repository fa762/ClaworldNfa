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
    en: 'Tight execution',
    zhHint: '先保储备，再动手。',
    enHint: 'Less flourish, more discipline and bounded action.',
  },
  {
    value: 'balanced',
    zh: '平衡',
    en: 'Balanced judgment',
    zhHint: '稳着来，先看收益风险。',
    enHint: 'Default posture for stable reasoning and controlled upside.',
  },
  {
    value: 'expressive',
    zh: '进取',
    en: 'Explain more',
    zhHint: '机会大时敢上。',
    enHint: 'Show more tradeoff reasoning while still acting only inside policy bounds.',
  },
];

function buildDirectiveTemplate(style: DirectiveStyle) {
  if (style === 'tight') {
    return '优先保储备，避免高波动动作。';
  }
  if (style === 'expressive') {
    return '机会明显时可以更主动，但不要越界。';
  }
  return '平衡收益、风险和续航。';
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
  title = 'Directive',
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
  const [updatedBy, setUpdatedBy] = useState<string | null>(null);
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
        setUpdatedBy(data.updatedBy);
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
    if (!isOwner || !address || saving || isSigning) return;

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
      setUpdatedBy(data.updatedBy);
      setSuccess(pick('directive 已保存。', 'Directive saved.'));
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
          <h3>{pick('选策略，写一句提示', 'Pick a style and one prompt')}</h3>
        </div>
        <span className="cw-chip cw-chip--cool">
          <Bot size={14} />
          {pick('策略', 'Policy')}
        </span>
      </div>

      <div className="cw-field-grid">
        <label className="cw-field">
          <span className="cw-label">{pick('策略', 'Style')}</span>
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
          <span className="cw-label">{pick('提示词', 'Prompt')}</span>
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
            placeholder={pick('例如：有已结算奖励就先领，再进新局。', 'Example: Claim settled rewards before entering a new match.')}
          />
          <p className="cw-muted">{text.length}/220 · {remainingChars} {pick('字符剩余', 'chars left')}</p>
        </label>
      </div>

      <div className="cw-panel cw-panel--warm">
        <div className="cw-section-head">
          <div>
            <span className="cw-label">{pick('预览', 'Preview')}</span>
            <h3>{pick('当前效果', 'Current effect')}</h3>
          </div>
          <span className="cw-chip cw-chip--warm">
            <PenSquare size={14} />
            {pick('预览', 'Preview')}
          </span>
        </div>
        <p className="cw-muted">{loading ? pick('正在读取 directive...', 'Loading directive...') : preview}</p>
        {updatedAt ? (
          <p className="cw-muted">
            {pick('最近保存于', 'Last saved')} {new Date(updatedAt).toLocaleString()}
            {updatedBy ? ` / ${updatedBy.slice(0, 6)}...${updatedBy.slice(-4)}` : ''}
          </p>
        ) : null}
      </div>

      {isSigning ? (
        <div className="cw-list">
          <div className="cw-list-item cw-list-item--warm">
            <Bot size={16} />
            <span>{pick('正在等待钱包签名 directive。', 'Waiting for wallet signature for the directive.')}</span>
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
          {saving || isSigning ? pick('保存中', 'Saving directive') : pick('保存策略', 'Save policy')}
        </button>
      </div>

      {!isOwner ? <p className="cw-muted">{pick('只有持有人钱包能保存。', 'Only the owner wallet can save this policy.')}</p> : null}
      {success ? <p className="cw-result-celebration">{success}</p> : null}
      {error ? <p className="cw-muted">{pick(`策略保存失败：${error}`, `Directive error: ${error}`)}</p> : null}
    </section>
  );
}
