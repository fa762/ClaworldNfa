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
    zh: '紧凑执行',
    en: 'Tight execution',
    zhHint: '少一点修辞，多一点纪律和边界感。',
    enHint: 'Less flourish, more discipline and bounded action.',
  },
  {
    value: 'balanced',
    zh: '平衡判断',
    en: 'Balanced judgment',
    zhHint: '默认姿态，追求稳定推理和可控上行。',
    enHint: 'Default posture for stable reasoning and controlled upside.',
  },
  {
    value: 'expressive',
    zh: '多解释一点',
    en: 'Explain more',
    zhHint: '把取舍讲清楚，但动作仍只在 policy 边界内。',
    enHint: 'Show more tradeoff reasoning while still acting only inside policy bounds.',
  },
];

function buildDirectiveTemplate(style: DirectiveStyle) {
  if (style === 'tight') {
    return 'Prioritize survival, reserve discipline, and low-regret execution.';
  }
  if (style === 'expressive') {
    return 'Explain the tradeoff clearly, but still choose only from valid bounded actions.';
  }
  return 'Balance reward, variance, and continuity across the available bounded actions.';
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
          <h3>{pick('Directive 与提示词姿态', 'Directive and prompt posture')}</h3>
          <p className="cw-muted">
            {pick('给这条自治路径留一个明确的推理姿态。planner 仍然只会在 policy 边界里行动。', 'Save one explicit reasoning posture for this autonomy surface. The planner stays bounded by policy either way.')}
          </p>
        </div>
        <span className="cw-chip cw-chip--cool">
          <Bot size={14} />
          {pick('已签名策略', 'Signed policy')}
        </span>
      </div>

      <div className="cw-field-grid">
        <label className="cw-field">
          <span className="cw-label">{pick('思考风格', 'Thinking style')}</span>
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
          <p className="cw-muted">
            {activeOption ? pick(activeOption.zhHint, activeOption.enHint) : null}
          </p>
        </label>

        <label className="cw-field">
          <span className="cw-label">{pick('额外约束', 'Extra constraint')}</span>
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
            placeholder={pick('例如：如果上一局已结算可领，就先领再进新局。', 'Example: If a settled reward is claimable, prefer claiming it before entering a new match.')}
          />
          <p className="cw-muted">{pick('这段文字会被签名、存储，并注入 planner prompt。', 'This text is signed and stored, then injected into the planner prompt.')}</p>
          <p className="cw-muted">{text.length}/220 · {remainingChars} {pick('字符剩余', 'chars left')}</p>
        </label>
      </div>

      <div className="cw-panel cw-panel--warm">
        <div className="cw-section-head">
          <div>
            <span className="cw-label">{pick('预览', 'Preview')}</span>
            <h3>{pick('可见的 planner 指令', 'Visible planner instruction')}</h3>
          </div>
          <span className="cw-chip cw-chip--warm">
            <PenSquare size={14} />
            {pick('实时预览', 'Live preview')}
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
          {saving || isSigning ? pick('保存中', 'Saving directive') : pick('保存 directive', 'Save directive')}
        </button>
      </div>

      {!isOwner ? <p className="cw-muted">{pick('只有当前 NFA owner 才能签名并保存 directive。', 'Only the current NFA owner can sign and save directive updates.')}</p> : null}
      {success ? <p className="cw-result-celebration">{success}</p> : null}
      {error ? <p className="cw-muted">{pick(`directive 错误：${error}`, `Directive error: ${error}`)}</p> : null}
    </section>
  );
}
