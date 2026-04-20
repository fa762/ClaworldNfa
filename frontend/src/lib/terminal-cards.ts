export type TerminalTone = 'warm' | 'cool' | 'growth' | 'alert';
export type TerminalActionIntent = 'mining' | 'arena' | 'auto' | 'mint' | 'memory' | 'status';

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
