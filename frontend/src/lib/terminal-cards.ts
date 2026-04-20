export type TerminalTone = 'warm' | 'cool' | 'growth' | 'alert';
export type TerminalActionIntent = 'mining' | 'arena' | 'auto' | 'mint' | 'memory' | 'status' | 'settings';

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
      actions: TerminalProposalAction[];
    }
  | {
      id: string;
      type: 'world';
      label: string;
      title: string;
      body: string;
      details: TerminalDetailRow[];
      cta?: TerminalProposalAction;
    }
  | {
      id: string;
      type: 'receipt';
      label: string;
      title: string;
      body: string;
      details: TerminalDetailRow[];
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
  return value === 'mining' || value === 'arena' || value === 'auto' || value === 'mint' || value === 'memory' || value === 'status' || value === 'settings';
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
    const details = Array.isArray(card.details) ? card.details.map(coerceDetailRow).filter((item): item is TerminalDetailRow => Boolean(item)) : [];
    const cta = coerceAction(card.cta);
    if (!label && !title && !body) return null;

    if (type === 'proposal') {
      const actions = Array.isArray(card.actions) ? card.actions.map(coerceAction).filter((item): item is TerminalProposalAction => Boolean(item)) : [];
      if (!actions.length) return null;
      return {
        id,
        type,
        label: label || '动作卡',
        title,
        body,
        details,
        actions,
      };
    }

    return {
      id,
      type,
      label: label || (type === 'world' ? '世界' : '回执'),
      title,
      body,
      details,
      cta: cta || undefined,
    };
  }

  return null;
}

export function coerceTerminalCards(value: unknown): TerminalCard[] {
  if (!Array.isArray(value)) return [];
  return value.map(coerceTerminalCard).filter((item): item is TerminalCard => Boolean(item));
}
