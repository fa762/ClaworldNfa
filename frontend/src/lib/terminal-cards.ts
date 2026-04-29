export type TerminalTone = 'warm' | 'cool' | 'growth' | 'alert';
export type TerminalActionIntent =
  | 'mining'
  | 'arena'
  | 'auto'
  | 'mint'
  | 'memory'
  | 'status'
  | 'settings'
  | 'finance'
  | 'market';

export type TerminalDetailRow = {
  label: string;
  value: string;
  tone?: TerminalTone;
};

export type TerminalProposalAction = {
  label: string;
  intent?: TerminalActionIntent;
  href?: string;
  memoryText?: string;
};

export type TerminalReportScore = {
  label: string;
  score: number;
  reason: string;
  tone?: TerminalTone;
};

export type TerminalContractReport = {
  kind: 'contract-report';
  asset: {
    name: string;
    address: string;
    type: string;
    venue?: string;
  };
  decision: {
    label: string;
    score: number;
    tone?: TerminalTone;
    summary: string;
    action: string;
  };
  metrics: TerminalDetailRow[];
  dimensions: TerminalReportScore[];
  focus: {
    label: string;
    title: string;
    body: string;
    items: TerminalDetailRow[];
  };
  receiver?: {
    title: string;
    score: number;
    tone?: TerminalTone;
    body: string;
    items: TerminalDetailRow[];
  } | null;
};

export type TerminalCard =
  | {
      id: string;
      type: 'message';
      role: 'nfa' | 'user' | 'system';
      label: string;
      title: string;
      body: string;
      tone?: TerminalTone;
      meta?: string;
    }
  | {
      id: string;
      type: 'proposal';
      label: string;
      title: string;
      body: string;
      details: TerminalDetailRow[];
      advancedDetails?: TerminalDetailRow[];
      actions: TerminalProposalAction[];
    }
  | {
      id: string;
      type: 'world';
      label: string;
      title: string;
      body: string;
      layout?: 'contract-report';
      report?: TerminalContractReport;
      details: TerminalDetailRow[];
      advancedDetails?: TerminalDetailRow[];
      cta?: TerminalProposalAction;
    }
  | {
      id: string;
      type: 'receipt';
      label: string;
      title: string;
      body: string;
      details: TerminalDetailRow[];
      advancedDetails?: TerminalDetailRow[];
      cta?: TerminalProposalAction;
    };

export type TerminalChatStreamEvent =
  | { type: 'card'; card: TerminalCard }
  | { type: 'done'; messageId: string }
  | { type: 'error'; message: string };

function asString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function isTone(value: unknown): value is TerminalTone {
  return value === 'warm' || value === 'cool' || value === 'growth' || value === 'alert';
}

function isIntent(value: unknown): value is TerminalActionIntent {
  return (
    value === 'mining' ||
    value === 'arena' ||
    value === 'auto' ||
    value === 'mint' ||
    value === 'memory' ||
    value === 'status' ||
    value === 'settings' ||
    value === 'finance' ||
    value === 'market'
  );
}

function coerceDetailRow(value: unknown): TerminalDetailRow | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const label = asString(row.label).trim();
  const rawValue = asString(row.value).trim();
  if (!label || !rawValue) return null;
  return {
    label,
    value: rawValue,
    tone: isTone(row.tone) ? row.tone : undefined,
  };
}

function coerceAction(value: unknown): TerminalProposalAction | null {
  if (!value || typeof value !== 'object') return null;
  const action = value as Record<string, unknown>;
  const label = asString(action.label).trim();
  const href = asString(action.href).trim();
  const memoryText = asString(action.memoryText).trim();
  const intent = isIntent(action.intent) ? action.intent : undefined;
  if (!label) return null;
  if (!intent && !href) return null;
  return {
    label,
    intent,
    href: href || undefined,
    memoryText: memoryText || undefined,
  };
}

function asNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function coerceReportScore(value: unknown): TerminalReportScore | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const label = asString(row.label).trim();
  if (!label) return null;
  return {
    label,
    score: Math.max(0, Math.min(100, Math.round(asNumber(row.score)))),
    reason: asString(row.reason).trim() || '--',
    tone: isTone(row.tone) ? row.tone : undefined,
  };
}

function coerceContractReport(value: unknown): TerminalContractReport | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const report = value as Record<string, unknown>;
  if (report.kind !== 'contract-report') return undefined;
  const asset = (report.asset && typeof report.asset === 'object' ? report.asset : {}) as Record<string, unknown>;
  const decision = (report.decision && typeof report.decision === 'object' ? report.decision : {}) as Record<string, unknown>;
  const focus = (report.focus && typeof report.focus === 'object' ? report.focus : {}) as Record<string, unknown>;
  const receiver = (report.receiver && typeof report.receiver === 'object' ? report.receiver : null) as Record<string, unknown> | null;
  const metrics = Array.isArray(report.metrics)
    ? report.metrics.map(coerceDetailRow).filter((item): item is TerminalDetailRow => Boolean(item))
    : [];
  const dimensions = Array.isArray(report.dimensions)
    ? report.dimensions.map(coerceReportScore).filter((item): item is TerminalReportScore => Boolean(item))
    : [];
  const focusItems = Array.isArray(focus.items)
    ? focus.items.map(coerceDetailRow).filter((item): item is TerminalDetailRow => Boolean(item))
    : [];
  const receiverItems = Array.isArray(receiver?.items)
    ? receiver!.items.map(coerceDetailRow).filter((item): item is TerminalDetailRow => Boolean(item))
    : [];

  return {
    kind: 'contract-report',
    asset: {
      name: asString(asset.name).trim(),
      address: asString(asset.address).trim(),
      type: asString(asset.type).trim(),
      venue: asString(asset.venue).trim() || undefined,
    },
    decision: {
      label: asString(decision.label).trim(),
      score: Math.max(0, Math.min(100, Math.round(asNumber(decision.score)))),
      tone: isTone(decision.tone) ? decision.tone : undefined,
      summary: asString(decision.summary).trim(),
      action: asString(decision.action).trim(),
    },
    metrics,
    dimensions,
    focus: {
      label: asString(focus.label).trim(),
      title: asString(focus.title).trim(),
      body: asString(focus.body).trim(),
      items: focusItems,
    },
    receiver: receiver
      ? {
          title: asString(receiver.title).trim(),
          score: Math.max(0, Math.min(100, Math.round(asNumber(receiver.score)))),
          tone: isTone(receiver.tone) ? receiver.tone : undefined,
          body: asString(receiver.body).trim(),
          items: receiverItems,
        }
      : null,
  };
}

function coerceCardId(value: unknown) {
  const id = asString(value).trim();
  return id || `terminal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function coerceTerminalCard(value: unknown): TerminalCard | null {
  if (!value || typeof value !== 'object') return null;
  const card = value as Record<string, unknown>;
  const type = asString(card.type).trim();
  const id = coerceCardId(card.id);
  const label = asString(card.label).trim();
  const title = asString(card.title).trim();
  const body = asString(card.body).trim();

  if (type === 'message') {
    const role = card.role === 'user' || card.role === 'system' ? card.role : 'nfa';
    if (!label && !title && !body) return null;
    return {
      id,
      type,
      role,
      label: label || '回复',
      title,
      body,
      tone: isTone(card.tone) ? card.tone : undefined,
      meta: asString(card.meta).trim() || undefined,
    };
  }

  if (type === 'proposal' || type === 'world' || type === 'receipt') {
    const details = Array.isArray(card.details)
      ? card.details.map(coerceDetailRow).filter((item): item is TerminalDetailRow => Boolean(item))
      : [];
    const advancedDetails = Array.isArray(card.advancedDetails)
      ? card.advancedDetails.map(coerceDetailRow).filter((item): item is TerminalDetailRow => Boolean(item))
      : [];
    const cta = coerceAction(card.cta);
    const report = coerceContractReport(card.report);
    const layout = card.layout === 'contract-report' && report ? 'contract-report' : undefined;
    if (!label && !title && !body) return null;

    if (type === 'proposal') {
      const actions = Array.isArray(card.actions)
        ? card.actions.map(coerceAction).filter((item): item is TerminalProposalAction => Boolean(item))
        : [];
      if (!actions.length) return null;
      return {
        id,
        type,
        label: label || '动作卡',
        title,
        body,
        details,
        advancedDetails,
        actions,
      };
    }

    return {
      id,
      type,
      label: label || (type === 'world' ? '世界' : '回执'),
      title,
      body,
      layout,
      report,
      details,
      advancedDetails,
      cta: cta || undefined,
    };
  }

  return null;
}

export function coerceTerminalCards(value: unknown): TerminalCard[] {
  if (!Array.isArray(value)) return [];
  return value.map(coerceTerminalCard).filter((item): item is TerminalCard => Boolean(item));
}
