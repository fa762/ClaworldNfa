'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import {
  ArrowRight,
  Bot,
  CircleDot,
  Compass,
  ExternalLink,
  Menu,
  MessageSquareText,
  Pickaxe,
  Shield,
  Sparkles,
  Swords,
  X,
  Zap,
} from 'lucide-react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';

import styles from './TerminalHome.module.css';
import { ConnectButton } from '@/components/wallet/ConnectButton';
import { useChatEngine } from '@/lib/chat-engine';
import { useI18n } from '@/lib/i18n';
import { useActiveCompanion } from '@/components/lobster/useActiveCompanion';
import { MintPanel } from '@/components/mint/MintPanel';
import { formatCLW, truncateAddress } from '@/lib/format';
import {
  coerceTerminalCard,
  coerceTerminalCards,
  type TerminalActionIntent,
  type TerminalCard,
  type TerminalChatStreamEvent,
  type TerminalProposalAction,
  type TerminalTone,
} from '@/lib/terminal-cards';
import { TerminalActionPanel } from './TerminalActionPanel';
import { useTerminalNfas } from './useTerminalNfas';
import { useTerminalWorld } from './useTerminalWorld';
import { useTerminalMemory } from './useTerminalMemory';
import { useTerminalAutonomy } from './useTerminalAutonomy';
import { useTerminalChatHistory } from './useTerminalChatHistory';
import { useTerminalEvents } from './useTerminalEvents';
import { useTerminalLocalChat } from './useTerminalLocalChat';
import { TerminalMarketPanel } from './TerminalMarketPanel';

function toneClass(tone?: TerminalTone) {
  if (!tone) return '';
  return styles[tone];
}

type PickFn = <T,>(zh: T, en: T) => T;

function describeCompanion(companion: ReturnType<typeof useActiveCompanion>, pick: PickFn) {
  if (!companion.connected) {
    return pick(
      '先接入钱包，终端才会读取你的 NFA、账本和动作结果。',
      'Connect a wallet so the terminal can read your NFA, ledger, and action results.',
    );
  }
  if (!companion.hasToken) {
    return pick(
      '你还没有可用的 NFA。先去铸造，终端会把它接进来。',
      'No usable NFA found yet. Mint one first and the terminal will bring it online.',
    );
  }
  if (!companion.active) {
    return pick(
      '这只 NFA 当前停在维护前。先补储备，它才能继续挖矿、PK 和自治。',
      'This NFA needs upkeep before mining, PK, or autonomy can continue.',
    );
  }
  return companion.stance;
}

function localizeStatusLabel(value: string | undefined, pick: PickFn) {
  const normalized = (value ?? '').trim().toLowerCase();
  if (!normalized) return '--';
  if (normalized === '稳定' || normalized === 'stable') return pick('稳定', 'Stable');
  if (normalized === '需要维护' || normalized === 'needs upkeep') return pick('需要维护', 'Needs upkeep');
  if (normalized === '储备告急' || normalized === 'reserve low') return pick('储备告急', 'Reserve low');
  if (normalized === '储备预警' || normalized === 'reserve watch') return pick('储备预警', 'Reserve watch');
  if (normalized === '连接钱包' || normalized === 'connect wallet') return pick('连接钱包', 'Connect wallet');
  if (normalized === '未发现 nfa' || normalized === 'no nfa found') return pick('未发现 NFA', 'No NFA found');
  if (normalized === 'demo view') return pick('演示', 'Demo');
  return value ?? '--';
}

function localizeRarityLabel(value: string | undefined, pick: PickFn) {
  const normalized = (value ?? '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === '普通' || normalized === 'common') return pick('普通', 'Common');
  if (normalized === '稀有' || normalized === 'rare') return pick('稀有', 'Rare');
  if (normalized === '史诗' || normalized === 'epic') return pick('史诗', 'Epic');
  if (normalized === '传说' || normalized === 'legendary') return pick('传说', 'Legendary');
  if (normalized === '神话' || normalized === 'mythic') return pick('神话', 'Mythic');
  return value ?? '';
}

function localizeShelterLabel(value: string | undefined, pick: PickFn) {
  const normalized = (value ?? '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === '废土' || normalized === 'wasteland') return pick('废土', 'Wasteland');
  return value ?? '';
}

function localizeWorldEventLabel(key: string | undefined, fallback: string | undefined, pick: PickFn) {
  const normalized = (key ?? fallback ?? '').trim().toUpperCase();
  if (normalized === 'BUBBLE' || fallback === '泡沫') return pick('泡沫', 'Bubble');
  if (normalized === 'WINTER' || fallback === '寒冬') return pick('寒冬', 'Winter');
  if (normalized === 'GOLDEN_AGE' || fallback === '繁荣') return pick('繁荣', 'Golden Age');
  return fallback ?? key ?? '--';
}

function buildBaseFeed(
  companion: ReturnType<typeof useActiveCompanion>,
  detail: ReturnType<typeof useTerminalNfas>['detail'],
  memory: ReturnType<typeof useTerminalMemory>,
  pick: PickFn,
  lang: 'zh' | 'en',
): TerminalCard[] {
  const cards: TerminalCard[] = [];
  const detailMemorySummary = memory.summary?.identity ?? (lang === 'zh' ? detail?.memorySummary : undefined);

  if (companion.hasToken) {
    cards.push({
      id: 'intro',
      type: 'message',
      role: 'nfa',
      label: pick('已接入', 'Online'),
      title: '',
      body: detailMemorySummary ?? describeCompanion(companion, pick),
      tone: 'warm',
      meta: `#${companion.tokenNumber} · Lv.${companion.level}`,
    });
    return cards;
  }

  cards.push({
    id: 'intro',
    type: 'message',
    role: 'system',
    label: pick('等待接入', 'Waiting'),
    title: pick('先接入一只 NFA', 'Bring an NFA online'),
    body: describeCompanion(companion, pick),
    tone: 'cool',
  });

  return cards;
}

function RailGlyph({ tokenId }: { tokenId: bigint }) {
  return <div className={styles.railGlyph}>#{tokenId.toString().slice(-2)}</div>;
}

function parseSseChunk(chunk: string) {
  const blocks = chunk.split('\n\n');
  const remainder = blocks.pop() ?? '';
  const events = blocks
    .map((block) => {
      const lines = block.split('\n');
      let event = 'message';
      let data = '';
      for (const line of lines) {
        if (line.startsWith(':')) continue;
        if (line.startsWith('event:')) {
          event = line.slice(6).trim();
          continue;
        }
        if (line.startsWith('data:')) {
          data += `${line.slice(5).trim()}\n`;
        }
      }
      return { event, data: data.trim() };
    })
    .filter((item) => item.data);
  return { events, remainder };
}

function normalizeRouteAction(value: string | null): TerminalActionIntent | null {
  const key = value?.trim().toLowerCase();
  if (!key) return null;
  if (key === 'mining' || key === 'mine' || key === 'play' || key === 'task') return 'mining';
  if (key === 'arena' || key === 'pk' || key === 'br' || key === 'battle') return 'arena';
  if (key === 'auto' || key === 'autonomy' || key === 'proxy') return 'auto';
  if (key === 'finance' || key === 'fund' || key === 'deposit' || key === 'withdraw') return 'finance';
  if (key === 'market' || key === 'trade') return 'market';
  if (key === 'mint') return 'mint';
  if (key === 'memory' || key === 'cml') return 'memory';
  if (key === 'settings' || key === 'model' || key === 'byok') return 'settings';
  if (key === 'status') return 'status';
  return null;
}

type LocalTerminalCommand =
  | { kind: 'help'; tokenId?: bigint }
  | { kind: 'next' }
  | { kind: 'prev' }
  | { kind: 'switch'; tokenId: bigint }
  | { kind: 'open'; action: TerminalActionIntent; tokenId?: bigint; memoryText?: string }
  | { kind: 'send'; content: string; tokenId?: bigint };

function parseLeadingTokenSwitch(input: string, ownedTokens: bigint[]) {
  const match = input.match(/^\s*(?:@|#)(\d+)\b\s*/);
  if (!match) return { tokenId: undefined, rest: input.trim() };
  const tokenId = BigInt(match[1]);
  if (!ownedTokens.some((item) => item === tokenId)) {
    return { tokenId: undefined, rest: input.trim() };
  }
  return {
    tokenId,
    rest: input.slice(match[0].length).trim(),
  };
}

function safeBigInt(value: unknown, fallback = 0n) {
  try {
    if (typeof value === 'bigint') return value;
    if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return BigInt(value.trim());
    if (typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value)) return BigInt(value);
    return fallback;
  } catch {
    return fallback;
  }
}

function parseLocalTerminalCommand(input: string, ownedTokens: bigint[]): LocalTerminalCommand {
  const trimmed = input.trim();
  const switched = parseLeadingTokenSwitch(trimmed, ownedTokens);
  const content = switched.rest;

  if (!content) {
    if (switched.tokenId !== undefined) return { kind: 'switch', tokenId: switched.tokenId };
    return { kind: 'help' };
  }

  if (!content.startsWith('/')) {
    return { kind: 'send', content, tokenId: switched.tokenId };
  }

  const [rawCommand, ...restParts] = content.slice(1).split(/\s+/);
  const command = rawCommand.toLowerCase();
  const rest = restParts.join(' ').trim();

  if (command === 'help' || command === 'h') return { kind: 'help', tokenId: switched.tokenId };
  if (command === 'next') return { kind: 'next' };
  if (command === 'prev' || command === 'previous') return { kind: 'prev' };
  if (command === 'status' || command === 'state') return { kind: 'open', action: 'status', tokenId: switched.tokenId };
  if (command === 'settings' || command === 'model' || command === 'byok') return { kind: 'open', action: 'settings', tokenId: switched.tokenId };
  if (command === 'finance' || command === 'fund' || command === 'deposit' || command === 'withdraw') return { kind: 'open', action: 'finance', tokenId: switched.tokenId };
  if (command === 'market' || command === 'trade') return { kind: 'open', action: 'market', tokenId: switched.tokenId };
  if (command === 'mint') return { kind: 'open', action: 'mint', tokenId: switched.tokenId };
  if (command === 'mine' || command === 'mining' || command === 'task') return { kind: 'open', action: 'mining', tokenId: switched.tokenId };
  if (command === 'arena' || command === 'pk' || command === 'br' || command === 'battle') return { kind: 'open', action: 'arena', tokenId: switched.tokenId };
  if (command === 'auto' || command === 'proxy' || command === 'autonomy') return { kind: 'open', action: 'auto', tokenId: switched.tokenId };
  if (command === 'memory' || command === 'remember' || command === 'cml') {
    return { kind: 'open', action: 'memory', tokenId: switched.tokenId, memoryText: rest || undefined };
  }

  return { kind: 'send', content: rest ? `${command} ${rest}` : command, tokenId: switched.tokenId };
}

function buildLocalCommandCards(command: LocalTerminalCommand, pick: PickFn): TerminalCard[] {
  if (command.kind === 'help') {
    return [
      {
        id: `local-help-${Date.now()}`,
        type: 'receipt',
        label: pick('终端命令', 'Terminal commands'),
        title: pick('直接输命令也可以', 'Commands work too'),
        body: pick('常用命令都能直接开动作，不用先聊一轮。', 'Use a short command when you want to jump straight into an action.'),
        details: [
          { label: '/mine', value: pick('打开挖矿', 'Open mining'), tone: 'growth' },
          { label: '/arena', value: pick('打开竞技', 'Open arena'), tone: 'warm' },
          { label: '/auto', value: pick('打开代理', 'Open auto'), tone: 'cool' },
          { label: '/finance', value: pick('打开资金', 'Open funds') },
          { label: '/market', value: pick('打开市场', 'Open market') },
          { label: '/memory', value: pick('写长期记忆', 'Write memory') },
          { label: '@123', value: pick('切到 #123', 'Switch to #123') },
        ],
      },
    ];
  }

  if (command.kind === 'switch') {
    return [
      {
        id: `local-switch-${command.tokenId.toString()}-${Date.now()}`,
        type: 'message',
        role: 'system',
        label: pick('切换', 'Switch'),
        title: '',
        body: pick(`已切到 #${command.tokenId.toString()}`, `Switched to #${command.tokenId.toString()}`),
        tone: 'cool',
        meta: pick('刚刚', 'now'),
      },
    ];
  }

  if (command.kind === 'next') {
    return [
      {
        id: `local-next-${Date.now()}`,
        type: 'message',
        role: 'system',
        label: pick('切换', 'Switch'),
        title: '',
        body: pick('已切到下一只 NFA', 'Switched to the next NFA'),
        tone: 'cool',
        meta: pick('刚刚', 'now'),
      },
    ];
  }

  if (command.kind === 'prev') {
    return [
      {
        id: `local-prev-${Date.now()}`,
        type: 'message',
        role: 'system',
        label: pick('切换', 'Switch'),
        title: '',
        body: pick('已切到上一只 NFA', 'Switched to the previous NFA'),
        tone: 'cool',
        meta: pick('刚刚', 'now'),
      },
    ];
  }

  if (command.kind === 'open') {
    const label =
      command.action === 'mining'
        ? pick('挖矿', 'mining')
        : command.action === 'arena'
          ? pick('竞技', 'arena')
          : command.action === 'auto'
            ? pick('代理', 'auto')
            : command.action === 'memory'
              ? pick('记忆', 'memory')
              : command.action === 'mint'
                ? pick('铸造', 'mint')
                : command.action === 'finance'
                  ? pick('资金', 'funds')
                  : command.action === 'market'
                    ? pick('市场', 'market')
                : command.action === 'settings'
                  ? pick('模型设置', 'model settings')
                  : pick('状态', 'status');

    return [
      {
        id: `local-open-${command.action}-${Date.now()}`,
        type: 'message',
        role: 'nfa',
        label: pick('回复', 'Reply'),
        title: '',
        body: pick(`行，直接看${label}。`, `Opening ${label}.`),
        tone: command.action === 'auto' || command.action === 'settings' ? 'cool' : 'warm',
        meta: pick('刚刚', 'now'),
      },
    ];
  }

  return [];
}

function ConnectWall({ pick }: { pick: PickFn }) {
  return (
    <div className={styles.connectShell}>
      <div className={styles.connectGrid} />
      <div className={styles.connectCard}>
        <p className={styles.eyebrow}>{pick('龙虾世界', 'ClaworldNfa')}</p>
        <h1>{pick('连接钱包', 'Connect wallet')}</h1>
        <p>{pick('接入 NFA，直接进入对话、挖矿、竞技和代理。', 'Connect an NFA to enter chat, mining, arena, and auto mode.')}</p>
        <div className={styles.connectActions}>
          <ConnectButton />
          <span className={styles.connectHint}>{pick('有 NFA 会直接进入。', 'Owned NFAs enter directly.')}</span>
        </div>
      </div>
    </div>
  );
}

function NoCompanionState({
  pick,
  companion,
}: {
  pick: PickFn;
  companion: ReturnType<typeof useActiveCompanion>;
}) {
  const [mode, setMode] = useState<'mint' | 'market'>('mint');
  const [marketReceipt, setMarketReceipt] = useState<TerminalCard | null>(null);

  return (
    <div className={styles.connectShell}>
      <div className={styles.connectGrid} />
      <div className={styles.connectCard}>
        <p className={styles.eyebrow}>{pick('龙虾世界', 'ClaworldNfa')}</p>
        <h1>{mode === 'mint' ? pick('先铸造一只 NFA', 'Mint an NFA first') : pick('先去市场看看', 'Open the market')}</h1>
        <p>
          {mode === 'mint'
            ? pick('这个钱包还没有 NFA。铸造完成后会自动进入对话界面。', 'This wallet has no NFA yet. After minting, it will enter chat automatically.')
            : pick('当前钱包没有在手 NFA 也没关系。这里仍然可以购买挂单，或者取消你自己的挂单。', 'Even with no NFA in the wallet right now, you can still buy listings or cancel your own listings here.')}
        </p>
        <div className={styles.inlineActions}>
          <button
            type="button"
            className={mode === 'mint' ? styles.primaryPanelButton : styles.panelButton}
            onClick={() => setMode('mint')}
          >
            {pick('铸造', 'Mint')}
          </button>
          <button
            type="button"
            className={mode === 'market' ? styles.primaryPanelButton : styles.panelButton}
            onClick={() => setMode('market')}
          >
            {pick('市场', 'Market')}
          </button>
        </div>
        {marketReceipt ? <p className={styles.connectHint}>{marketReceipt.title || marketReceipt.body}</p> : null}
        <div className={styles.inlineMintWrap}>
          {mode === 'mint' ? (
            <MintPanel onTerminalClose={() => setMode('market')} />
          ) : (
            <TerminalMarketPanel
              companion={companion}
              onClose={() => setMode('mint')}
              onReceipt={(card) => setMarketReceipt(card)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function CompanionLoadingState({ pick }: { pick: PickFn }) {
  return (
    <div className={styles.connectShell}>
      <div className={styles.connectGrid} />
      <div className={styles.connectCard}>
        <p className={styles.eyebrow}>{pick('龙虾世界', 'ClaworldNfa')}</p>
        <h1>{pick('正在读取你的 NFA', 'Reading your NFA')}</h1>
        <p>{pick('钱包已经连接。终端正在读取持有列表、当前龙虾、账本和记忆上下文。', 'Wallet connected. Reading owned NFAs, current companion, ledger, and memory context.')}</p>
        <div className={styles.loadingBars} aria-label={pick('正在读取', 'Reading')}>
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}

export function TerminalHome() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { lang, setLang, pick } = useI18n();
  const companion = useActiveCompanion();
  const terminalNfas = useTerminalNfas(companion.ownerAddress, companion.hasToken ? companion.tokenId : undefined);
  const terminalWorld = useTerminalWorld();
  const terminalMemory = useTerminalMemory(companion.hasToken ? companion.tokenId : undefined, companion.ownerAddress);
  const terminalAutonomy = useTerminalAutonomy(companion.hasToken ? companion.tokenId : undefined);
  const terminalHistory = useTerminalChatHistory(companion.hasToken ? companion.tokenId : undefined, companion.ownerAddress, lang);
  const terminalEvents = useTerminalEvents(companion.hasToken ? companion.tokenId : undefined, companion.ownerAddress);
  const localChat = useTerminalLocalChat(companion.hasToken ? companion.tokenId : undefined, companion.ownerAddress);
  const chatEngine = useChatEngine();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [activeAction, setActiveAction] = useState<TerminalActionIntent | null>(null);
  const [memoryCandidate, setMemoryCandidate] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<HTMLDivElement | null>(null);
  const streamEndRef = useRef<HTMLDivElement | null>(null);
  const walletMenuRef = useRef<HTMLDivElement | null>(null);
  const walletButtonRef = useRef<HTMLButtonElement | null>(null);
  const routeActionRef = useRef<string | null>(null);
  const ambientEventIdsRef = useRef<Set<string>>(new Set());
  const pendingReceiptScrollRef = useRef(false);
  const [walletMenuPosition, setWalletMenuPosition] = useState<{ top: number; right: number; width: number } | null>(null);

  const baseCards = useMemo(
    () => buildBaseFeed(companion, terminalNfas.detail, terminalMemory, pick, lang),
    [companion, lang, pick, terminalMemory, terminalNfas.detail],
  );
  const seedCards = terminalHistory.cards.length ? terminalHistory.cards : baseCards;
  const cards = useMemo(
    () => coerceTerminalCards([...seedCards, ...terminalEvents.cards, ...localChat.cards]),
    [localChat.cards, seedCards, terminalEvents.cards],
  );
  const scrollStreamToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const node = streamRef.current;
    const end = streamEndRef.current;
    if (!node || !end) return;
    end.scrollIntoView({ block: 'end', behavior });
    node.scrollTop = node.scrollHeight;
  }, []);
  const updateWalletMenuPosition = useCallback(() => {
    if (typeof window === 'undefined') return;
    const trigger = walletButtonRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const width = Math.min(248, Math.max(220, Math.round(rect.width + 84)));
    const right = Math.max(12, Math.round(window.innerWidth - rect.right));
    const viewportHeight = window.innerHeight;
    const estimatedHeight = 236;
    let top = Math.round(rect.bottom + 10);
    if (top + estimatedHeight > viewportHeight - 12) {
      top = Math.max(12, Math.round(rect.top - estimatedHeight - 10));
    }
    setWalletMenuPosition({ top, right, width });
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const htmlOverflow = document.documentElement.style.overflow;
    const htmlOverscroll = document.documentElement.style.overscrollBehavior;
    const bodyOverflow = document.body.style.overflow;
    const bodyOverscroll = document.body.style.overscrollBehavior;
    const bodyPosition = document.body.style.position;
    const bodyInset = document.body.style.inset;
    const bodyWidth = document.body.style.width;
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.body.style.position = 'fixed';
    document.body.style.inset = '0';
    document.body.style.width = '100%';
    return () => {
      document.documentElement.style.overflow = htmlOverflow;
      document.documentElement.style.overscrollBehavior = htmlOverscroll;
      document.body.style.overflow = bodyOverflow;
      document.body.style.overscrollBehavior = bodyOverscroll;
      document.body.style.position = bodyPosition;
      document.body.style.inset = bodyInset;
      document.body.style.width = bodyWidth;
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const touchState = { startY: 0 };

    const findScrollable = (target: EventTarget | null) => {
      if (!(target instanceof Node)) return null;
      let element = target instanceof HTMLElement ? target : target.parentElement;
      while (element && element !== root) {
        if (element.dataset.terminalScroll === 'true') return element;
        element = element.parentElement;
      }
      return null;
    };

    const handleTouchStart = (event: TouchEvent) => {
      touchState.startY = event.touches[0]?.clientY ?? 0;
    };

    const handleTouchMove = (event: TouchEvent) => {
      const currentY = event.touches[0]?.clientY ?? touchState.startY;
      const deltaY = currentY - touchState.startY;
      const scrollable = findScrollable(event.target);

      if (!scrollable) {
        event.preventDefault();
        return;
      }

      const canScroll = scrollable.scrollHeight > scrollable.clientHeight + 1;
      if (!canScroll) {
        event.preventDefault();
        return;
      }

      const atTop = scrollable.scrollTop <= 0;
      const atBottom = scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight - 1;

      if ((deltaY > 0 && atTop) || (deltaY < 0 && atBottom)) {
        event.preventDefault();
      }
    };

    root.addEventListener('touchstart', handleTouchStart, { passive: true });
    root.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      root.removeEventListener('touchstart', handleTouchStart);
      root.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  useLayoutEffect(() => {
    const behavior = pendingReceiptScrollRef.current ? 'auto' : 'smooth';
    scrollStreamToBottom(behavior);
    const raf = window.requestAnimationFrame(() => {
      scrollStreamToBottom(behavior);
    });
    const timeout = window.setTimeout(() => {
      scrollStreamToBottom('auto');
      pendingReceiptScrollRef.current = false;
    }, 96);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timeout);
    };
  }, [activeAction, cards.length, isSending, scrollStreamToBottom]);

  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;

    let raf = 0;
    let timeout = 0;

    const clearScheduled = () => {
      if (raf) {
        window.cancelAnimationFrame(raf);
        raf = 0;
      }
      if (timeout) {
        window.clearTimeout(timeout);
        timeout = 0;
      }
    };

    const flushPendingReceiptScroll = () => {
      if (!pendingReceiptScrollRef.current) return;
      clearScheduled();
      scrollStreamToBottom('auto');
      raf = window.requestAnimationFrame(() => {
        scrollStreamToBottom('smooth');
      });
      timeout = window.setTimeout(() => {
        scrollStreamToBottom('auto');
        pendingReceiptScrollRef.current = false;
      }, 140);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        flushPendingReceiptScroll();
      }
    };

    const handlePageShow = () => {
      flushPendingReceiptScroll();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      clearScheduled();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [scrollStreamToBottom]);

  useEffect(() => {
    setWalletMenuOpen(false);
  }, [address]);

  useEffect(() => {
    if (!walletMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (!walletMenuRef.current?.contains(event.target)) {
        setWalletMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setWalletMenuOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [walletMenuOpen]);

  useLayoutEffect(() => {
    if (!walletMenuOpen) return;

    updateWalletMenuPosition();

    const handleViewportChange = () => {
      updateWalletMenuPosition();
    };

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [updateWalletMenuPosition, walletMenuOpen]);

  useEffect(() => {
    ambientEventIdsRef.current = new Set();
  }, [companion.tokenId]);

  useEffect(() => {
    if (!companion.hasToken || typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    const action = normalizeRouteAction(url.searchParams.get('action'));
    if (!action) return;

    const memoryText = url.searchParams.get('memory') || '';
    const routeKey = `${companion.tokenId.toString()}:${action}:${memoryText}`;
    if (routeActionRef.current === routeKey) return;
    routeActionRef.current = routeKey;

    if (action === 'memory' && memoryText.trim()) {
      setMemoryCandidate(memoryText.trim().slice(0, 500));
    }

    setRailOpen(false);
    setDrawerOpen(false);
    setActiveAction(action);

    url.searchParams.delete('action');
    url.searchParams.delete('memory');
    const nextSearch = url.searchParams.toString();
    window.history.replaceState(null, '', `${url.pathname}${nextSearch ? `?${nextSearch}` : ''}${url.hash}`);
  }, [companion.hasToken, companion.tokenId]);

  function requestWalletConnect() {
    const inj = connectors.find((connector) => connector.type === 'injected');
    const wc = connectors.find((connector) => connector.name === 'WalletConnect');
    const connector =
      inj && typeof window !== 'undefined' && (window as Window & { ethereum?: unknown }).ethereum
        ? inj
        : wc ?? connectors[0];
    if (connector) connect({ connector });
  }

  function requestWalletReconnect() {
    setWalletMenuOpen(false);
    disconnect();
    setTimeout(() => {
      requestWalletConnect();
    }, 100);
  }

  async function handleCommandSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !companion.hasToken || isSending) return;

    localChat.appendCards([
      {
        id: `user-${Date.now()}`,
        type: 'message',
        role: 'user',
        label: pick('你', 'You'),
        title: '',
        body: content,
        tone: 'warm',
        meta: pick('刚刚', 'now'),
      },
    ]);
    setDraft('');

    const localCommand = parseLocalTerminalCommand(content, companion.ownedTokens);
    if (localCommand.kind !== 'send') {
      if (localCommand.kind === 'switch') {
        companion.selectCompanion(localCommand.tokenId);
      }
      if (localCommand.kind === 'next') {
        companion.selectNext();
      }
      if (localCommand.kind === 'prev') {
        companion.selectPrevious();
      }
      if ('tokenId' in localCommand && localCommand.tokenId !== undefined && localCommand.kind !== 'switch') {
        companion.selectCompanion(localCommand.tokenId);
      }
      if (localCommand.kind === 'open') {
        if (localCommand.memoryText) setMemoryCandidate(localCommand.memoryText);
        openAction(localCommand.action, { silent: true });
      }
      localChat.appendCards(buildLocalCommandCards(localCommand, pick));
      return;
    }

    if (localCommand.tokenId !== undefined && localCommand.tokenId !== companion.tokenId) {
      companion.selectCompanion(localCommand.tokenId);
      localChat.appendCards([
        {
          id: `switch-before-send-${localCommand.tokenId.toString()}-${Date.now()}`,
          type: 'message',
          role: 'system',
          label: pick('切换', 'Switch'),
          title: '',
          body: pick(
            `已切到 #${localCommand.tokenId.toString()}，继续把这句话发给它。`,
            `Switched to #${localCommand.tokenId.toString()}. Send the message again when ready.`,
          ),
          tone: 'cool',
          meta: pick('刚刚', 'now'),
        },
      ]);
      return;
    }

    if (chatEngine.preferredMode === 'byok' && !chatEngine.engine) {
      localChat.appendCards([
        {
          id: `engine-locked-${Date.now()}`,
          type: 'message',
          role: 'system',
          label: pick('模型设置', 'Model settings'),
          title: '',
          body: pick('BYOK 未解锁，先开模型设置。', 'BYOK is locked. Open model settings first.'),
          tone: 'alert',
          meta: pick('刚刚', 'now'),
        },
      ]);
      return;
    }

    setIsSending(true);

    try {
      const response = await fetch(`/api/chat/${companion.tokenId.toString()}/send`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          content: localCommand.content,
          owner: companion.ownerAddress,
          lang,
          history: cards.slice(-12),
          engine: chatEngine.engine ?? undefined,
          memoryOverride: {
            summary: terminalMemory.summary,
            timeline: terminalMemory.timeline.slice(0, 6),
          },
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(pick(`终端接口返回 ${response.status}`, `Terminal API returned ${response.status}`));
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const handleParsedEvent = (item: { event: string; data: string }) => {
        const payload = JSON.parse(item.data) as TerminalChatStreamEvent;
        if (item.event === 'card' && payload.type === 'card') {
          const nextCard = coerceTerminalCard(payload.card);
          if (!nextCard) return;
          localChat.appendCards([nextCard]);
          const action = resolveCardAction(nextCard);
          if (action) openAction(action, { silent: true });
        }
        if (item.event === 'error' && payload.type === 'error') {
          localChat.appendCards([
            {
              id: `terminal-error-${Date.now()}`,
              type: 'message',
              role: 'system',
              label: pick('终端错误', 'Terminal error'),
              title: pick('这次整理动作失败了', 'This action failed'),
              body: payload.message,
              tone: 'alert',
            },
          ]);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parsed = parseSseChunk(buffer);
        buffer = parsed.remainder;

        for (const item of parsed.events) {
          handleParsedEvent(item);
        }
      }

      if (buffer.trim()) {
        const parsed = parseSseChunk(`${buffer}\n\n`);
        for (const item of parsed.events) {
          handleParsedEvent(item);
        }
      }
    } catch (error) {
      localChat.appendCards([
        {
          id: `terminal-error-${Date.now()}`,
          type: 'message',
          role: 'system',
          label: pick('终端错误', 'Terminal error'),
          title: pick('当前还没能完成这次整理', 'Could not finish this request'),
          body: error instanceof Error ? error.message : pick('未知错误', 'Unknown error'),
          tone: 'alert',
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  function resolveActionIntent(action: TerminalProposalAction): TerminalActionIntent | null {
    if (action.intent) return action.intent;
    if (action.href === '/play') return 'mining';
    if (action.href === '/arena') return 'arena';
    if (action.href === '/auto') return 'auto';
    if (action.href === '/finance') return 'finance';
    if (action.href === '/market') return 'market';
    if (action.href === '/mint') return 'mint';
    if (action.href === '/settings') return 'settings';
    return null;
  }

  function resolveCardAction(card: TerminalCard): TerminalProposalAction | null {
    if (card.type !== 'proposal') return null;
    for (const action of card.actions) {
      const intent = resolveActionIntent(action);
      if (intent) return action;
    }
    return null;
  }

  function openAction(action: TerminalProposalAction | TerminalActionIntent, options?: { silent?: boolean }) {
    const intent = typeof action === 'string' ? action : resolveActionIntent(action);
    if (!intent) return;
    if (typeof action !== 'string' && action.memoryText) {
      setMemoryCandidate(action.memoryText);
    }
    setRailOpen(false);
    setDrawerOpen(false);
    setActiveAction(intent);
    if (options?.silent) return;
  }

  const recentSummary = terminalAutonomy.status?.recentActions?.[0];
  const battleRoyaleSummary = terminalWorld.summary?.battleRoyale;
  const railItems =
    terminalNfas.rail.length > 0
      ? terminalNfas.rail.map((item) => ({
          tokenId: safeBigInt(item.tokenId),
          pulse: item.pulse,
          unreadCount: item.unreadCount,
          label: item.displayName,
          accentColor: item.accentColor,
          avatarUri: item.avatarUri,
          level: item.level,
          active: item.active,
        }))
      : companion.ownedTokens.map((tokenId) => ({
          tokenId,
          pulse: 0,
          unreadCount: 0,
          label: `#${tokenId.toString()}`,
          accentColor: '#F5A524',
          avatarUri: '',
          level: companion.level,
          active: true,
        }));
  const activeSummary = railItems.find((item) => item.tokenId === companion.tokenId);
  const accentColor = terminalNfas.detail?.accentColor ?? activeSummary?.accentColor ?? '#F5A524';
  const displayName = terminalNfas.detail?.displayName ?? companion.name;
  const avatarSrc = terminalNfas.detail?.avatarUri || activeSummary?.avatarUri || companion.imageSrc;
  const pulsePercent = Math.round((terminalNfas.detail?.pulse ?? activeSummary?.pulse ?? 0) * 100);
  const statusText = localizeStatusLabel(companion.statusLabel, pick);
  const rarityText = terminalNfas.detail?.rarity
    ? localizeRarityLabel(terminalNfas.detail.rarity, pick)
    : localizeShelterLabel(companion.shelterName, pick);
  const shelterText = localizeShelterLabel(terminalNfas.detail?.shelter ?? companion.shelterName, pick);
  const drawerMemoryText = terminalMemory.summary?.identity ?? (lang === 'zh' ? terminalNfas.detail?.memorySummary : undefined) ?? describeCompanion(companion, pick);
  const totalBudget = terminalAutonomy.status?.budget.totalCLW ? safeBigInt(terminalAutonomy.status.budget.totalCLW) : 0n;
  const usedBudget = terminalAutonomy.status?.budget.usedCLW ? safeBigInt(terminalAutonomy.status.budget.usedCLW) : 0n;
  const budgetPercent = totalBudget > 0n ? Number((usedBudget * 100n) / totalBudget) : 0;
  const quickPrompts = [
    { label: pick('挖矿', 'Mine'), value: pick('去挖矿', 'mine'), icon: Pickaxe, tone: styles.growth, action: 'mining' },
    { label: pick('竞技', 'Arena'), value: pick('看竞技', 'arena'), icon: Swords, tone: styles.warm, action: 'arena' },
    { label: pick('代理', 'Auto'), value: pick('开代理', 'auto'), icon: Bot, tone: styles.cool, action: 'auto' },
    { label: pick('资金', 'Funds'), value: pick('补储备', 'funds'), icon: Sparkles, tone: styles.cool, action: 'finance' },
    { label: pick('市场', 'Market'), value: pick('打开市场', 'market'), icon: Compass, tone: styles.warm, action: 'market' },
  ] as const;
  const walletMenuOverlay =
    walletMenuOpen && typeof document !== 'undefined'
      ? createPortal(
          <>
            <button
              type="button"
              className={styles.walletMenuBackdrop}
              aria-label={pick('关闭钱包菜单', 'Close wallet menu')}
              onClick={() => setWalletMenuOpen(false)}
            />
            <div
              ref={walletMenuRef}
              className={styles.walletMenu}
              role="menu"
              aria-label={pick('钱包菜单', 'Wallet menu')}
              style={
                walletMenuPosition
                  ? {
                      position: 'fixed',
                      top: `${walletMenuPosition.top}px`,
                      right: `${walletMenuPosition.right}px`,
                      minWidth: `${walletMenuPosition.width}px`,
                      zIndex: 1001,
                    }
                  : { position: 'fixed', top: '84px', right: '12px', minWidth: '220px', zIndex: 1001 }
              }
            >
              <button
                type="button"
                className={styles.walletMenuButton}
                onClick={() => {
                  setWalletMenuOpen(false);
                  openAction('mint');
                }}
              >
                {pick('铸造新 NFA', 'Mint NFA')}
              </button>
              <button
                type="button"
                className={styles.walletMenuButton}
                onClick={() => {
                  setWalletMenuOpen(false);
                  openAction('settings');
                }}
              >
                {pick('模型设置', 'Model settings')}
              </button>
              <div className={styles.walletLanguageRow} role="group" aria-label={pick('语言切换', 'Language switch')}>
                <span>{pick('语言', 'Language')}</span>
                <div className={styles.walletLanguageButtons}>
                  <button
                    type="button"
                    className={`${styles.walletLangButton} ${lang === 'zh' ? styles.walletLangButtonActive : ''}`}
                    aria-pressed={lang === 'zh'}
                    onClick={() => setLang('zh')}
                  >
                    中
                  </button>
                  <button
                    type="button"
                    className={`${styles.walletLangButton} ${lang === 'en' ? styles.walletLangButtonActive : ''}`}
                    aria-pressed={lang === 'en'}
                    onClick={() => setLang('en')}
                  >
                    EN
                  </button>
                </div>
              </div>
              <button type="button" className={styles.walletMenuButton} onClick={requestWalletReconnect}>
                {pick('切换钱包', 'Switch wallet')}
              </button>
              <button
                type="button"
                className={`${styles.walletMenuButton} ${styles.walletMenuButtonDanger}`}
                onClick={() => {
                  setWalletMenuOpen(false);
                  disconnect();
                }}
              >
                {pick('断开连接', 'Disconnect')}
              </button>
            </div>
          </>,
          document.body,
        )
      : null;


  useEffect(() => {
    const activeWorldEvent = terminalWorld.summary?.activeEvents?.[0];
    if (!activeWorldEvent) return;
    const eventId = `ambient-world-${activeWorldEvent.key}`;
    if (ambientEventIdsRef.current.has(eventId)) return;
    ambientEventIdsRef.current.add(eventId);
    const eventLabel = localizeWorldEventLabel(activeWorldEvent.key, activeWorldEvent.label, pick);
    localChat.appendCards([
      {
        id: eventId,
        type: 'world',
        label: pick('世界', 'World'),
        title: eventLabel,
        body: pick(
          '这轮世界状态已经变了，先看倍率和当前局面，再决定要不要动。',
          'World state changed. Check the multiplier and current board before acting.',
        ),
        details: [
          { label: pick('事件', 'Event'), value: eventLabel, tone: activeWorldEvent.tone },
          { label: pick('大逃杀', 'Battle Royale'), value: battleRoyaleSummary?.matchId ? `#${battleRoyaleSummary.matchId}` : '--' },
          { label: pick('人数', 'Players'), value: battleRoyaleSummary ? `${battleRoyaleSummary.players}/${battleRoyaleSummary.triggerCount || 10}` : '--' },
          { label: pick('奖池', 'Pot'), value: battleRoyaleSummary ? formatCLW(safeBigInt(battleRoyaleSummary.potCLW)) : '--', tone: 'warm' },
        ],
        cta: { label: pick('打开竞技', 'Open arena'), intent: 'arena' },
      },
    ]);
  }, [battleRoyaleSummary, localChat, pick, terminalWorld.summary?.activeEvents]);

  if (!isConnected || !address) {
    return <ConnectWall pick={pick} />;
  }

  if (companion.isLoading && !companion.hasToken) {
    return <CompanionLoadingState pick={pick} />;
  }

  if (!companion.hasToken) {
    return <NoCompanionState pick={pick} companion={companion} />;
  }

  return (
    <div ref={rootRef} className={styles.root} style={{ ['--accent-color' as any]: accentColor }}>
      <div className={styles.ambient} aria-hidden="true">
        <div className={styles.ambientGrid} />
        <div className={styles.ambientOrbOne} />
        <div className={styles.ambientOrbTwo} />
      </div>
      <div className={styles.shell}>
        <aside data-terminal-scroll="true" className={`${styles.rail} ${railOpen ? styles.railOpen : ''}`}>
          <div className={styles.railHead}>
            <div className={styles.railBrand}>CLAWORLD · NFA</div>
            <button type="button" className={`${styles.drawerToggle} ${styles.mobileOnly}`} onClick={() => setRailOpen(false)}>
              <X size={16} />
              {pick('关闭', 'Close')}
            </button>
          </div>
          <div className={styles.railList}>
            {railItems.map((item) => {
              const active = item.tokenId === companion.tokenId;
              return (
                <button
                  key={item.tokenId.toString()}
                  type="button"
                  className={`${styles.railItem} ${active ? styles.railItemActive : ''}`}
                  onClick={() => {
                    companion.selectCompanion(item.tokenId);
                    setRailOpen(false);
                  }}
                  aria-label={pick(`切换到 ${item.label}`, `Switch to ${item.label}`)}
                  title={`${item.label} · pulse ${Math.round(item.pulse * 100)}%`}
                  style={{ ['--rail-accent' as any]: item.accentColor }}
                >
                  <span className={styles.railItemBar} />
                  <span className={styles.railItemInner}>
                    {item.avatarUri ? <img className={styles.railImage} src={item.avatarUri} alt={item.label} /> : <RailGlyph tokenId={item.tokenId} />}
                  </span>
                  <span className={styles.railMiniMeta}>L{item.level}</span>
                  {!active && item.unreadCount > 0 ? <span className={styles.railBadge}>{item.unreadCount}</span> : null}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className={styles.mintButton}
            aria-label={pick('打开铸造', 'Open mint')}
            onClick={() => {
              setRailOpen(false);
              openAction('mint');
            }}
          >
            <Compass size={18} />
          </button>
          <div className={styles.railMeta}>
            <div>#{companion.tokenNumber}</div>
            <div>{terminalNfas.rail.length || companion.ownedCount} {pick('只在线', 'online')}</div>
          </div>
        </aside>

        <div className={styles.main}>
          <section className={styles.conversation}>
            <header className={styles.conversationHead}>
              <div className={styles.headerIdentity}>
                <button
                  type="button"
                  className={`${styles.heroAvatarButton} ${styles.mobileOnly}`}
                  onClick={() => {
                    setDrawerOpen(false);
                    setRailOpen(true);
                  }}
                  aria-label={pick('打开 NFA 列表', 'Open NFA list')}
                >
                  {avatarSrc ? <img src={avatarSrc} alt={displayName} /> : <RailGlyph tokenId={companion.tokenId} />}
                </button>
                <div className={`${styles.heroAvatar} ${styles.hiddenMobile}`}>
                  {avatarSrc ? <img src={avatarSrc} alt={displayName} /> : <RailGlyph tokenId={companion.tokenId} />}
                </div>
                <div className={styles.titleBlock}>
                  <p className={styles.eyebrow}>{pick('对话入口', 'Chat entry')}</p>
                  <h2>{displayName}</h2>
                  <p className={`${styles.subline} ${styles.mono}`}>
                    #{companion.tokenNumber} · {rarityText || shelterText || 'NFA'} · Lv.{terminalNfas.detail?.level ?? companion.level} · {statusText}
                  </p>
                </div>
              </div>
              <div className={styles.headerActions}>
                <div className={styles.pulsePill}>
                  <span className={styles.pulseDot} />
                  <span>{pick('心跳', 'Pulse')} {pulsePercent}%</span>
                </div>
                <div className={styles.pulsePill}>
                  <span className={styles.pulseDot} />
                  <span>{chatEngine.activeMode === 'byok' ? pick('自带模型', 'Own model') : pick('项目模型', 'Project model')}</span>
                </div>
                <div className={styles.walletMenuWrap}>
                  <button
                    type="button"
                    ref={walletButtonRef}
                    className={styles.walletPill}
                    aria-expanded={walletMenuOpen}
                    aria-haspopup="menu"
                    onClick={() => {
                      if (!walletMenuOpen) updateWalletMenuPosition();
                      setWalletMenuOpen((open) => !open);
                    }}
                  >
                    <Shield size={14} />
                    {truncateAddress(address)}
                  </button>
                  {walletMenuOverlay}
                </div>
                <button
                  type="button"
                  className={`${styles.drawerToggle} ${styles.hiddenDesktop}`}
                  onClick={() => {
                    setRailOpen(false);
                    setDrawerOpen(true);
                  }}
                >
                  <Menu size={16} />
                  {pick('状态', 'Status')}
                </button>
              </div>
            </header>

            <div data-terminal-scroll="true" className={styles.stream} ref={streamRef}>
              {cards.map((card) => {
                if (card.type === 'message') {
                  const displayText = [card.title, card.body].filter((value) => value && value.trim().length > 0).join('\n').trim();
                  if (!displayText) return null;

                  if (card.role === 'user') {
                    return (
                      <article key={card.id} className={styles.messageUser}>
                        <div className={styles.messageBody}>
                          <p>{displayText}</p>
                        </div>
                      </article>
                    );
                  }

                  if (card.role === 'system' && card.tone !== 'alert' && !card.title) {
                    return (
                      <div key={card.id} className={styles.systemEvent}>
                        <span className={styles.systemEventSpark}>
                          <Sparkles size={10} />
                        </span>
                        <span>{displayText}</span>
                      </div>
                    );
                  }

                  return (
                    <article
                      key={card.id}
                      className={`${styles.message} ${card.role === 'system' ? styles.systemCard : styles.nfaMessage}`}
                    >
                      <div className={styles.messageHead}>
                        <div className={styles.messageLabel}>
                          <MessageSquareText size={16} className={toneClass(card.tone)} />
                          {card.label}
                        </div>
                        {card.meta ? <span className={styles.messageTime}>{card.meta}</span> : null}
                      </div>
                      <div className={styles.messageBody}>
                        {card.title ? <p className={styles.messageBodyStrong}>{card.title}</p> : null}
                        {card.body ? <p>{card.body}</p> : null}
                      </div>
                    </article>
                  );
                }

                if (card.type === 'proposal') {
                  return (
                    <article key={card.id} className={styles.proposal}>
                      <span className={styles.cardWatermark}>ACT</span>
                      <div className={styles.cardHead}>
                        <div className={styles.cardLabel}>
                          <Sparkles size={16} className={styles.warm} />
                          {card.label}
                        </div>
                      </div>
                      <div className={styles.messageBody}>
                        <p className={styles.messageBodyStrong}>{card.title}</p>
                        <p>{card.body}</p>
                      </div>
                      <div className={styles.kvGrid}>
                        {card.details.map((item) => (
                          <div key={`${card.id}-${item.label}`} className={styles.kvItem}>
                            <span>{item.label}</span>
                            <strong className={toneClass(item.tone)}>{item.value}</strong>
                          </div>
                        ))}
                      </div>
                      <div className={styles.proposalActions}>
                        {card.actions.map((action) => (
                          <button key={`${card.id}-${action.label}`} type="button" className={styles.commandButton} onClick={() => openAction(action)}>
                            {action.label}
                            <ArrowRight size={14} />
                          </button>
                        ))}
                      </div>
                    </article>
                  );
                }

                if (card.type === 'world') {
                  return (
                    <article key={card.id} className={styles.worldCard}>
                      <span className={styles.cardWatermark}>{pick('世', 'W')}</span>
                      <div className={styles.cardHead}>
                        <div className={styles.cardLabel}>
                          <Zap size={16} className={styles.cool} />
                          {card.label}
                        </div>
                        {card.cta?.href ? (
                          <Link href={card.cta.href} className={styles.statusLink}>
                            {card.cta.label}
                            <ArrowRight size={14} />
                          </Link>
                        ) : card.cta?.intent ? (
                          <button type="button" className={styles.statusLink} onClick={() => openAction(card.cta!)}>
                            {card.cta.label}
                            <ArrowRight size={14} />
                          </button>
                        ) : null}
                      </div>
                      <div className={styles.messageBody}>
                        <p className={styles.messageBodyStrong}>{card.title}</p>
                        <p>{card.body}</p>
                      </div>
                      <div className={styles.kvGrid}>
                        {card.details.map((item) => (
                          <div key={`${card.id}-${item.label}`} className={styles.kvItem}>
                            <span>{item.label}</span>
                            <strong className={toneClass(item.tone)}>{item.value}</strong>
                          </div>
                        ))}
                      </div>
                    </article>
                  );
                }

                return (
                  <article key={card.id} className={styles.receipt}>
                    <span className={styles.cardWatermark}>ACT</span>
                    <div className={styles.cardHead}>
                      <div className={styles.cardLabel}>
                        <Bot size={16} className={styles.growth} />
                        {card.label}
                      </div>
                      {card.cta?.href ? (
                        <Link href={card.cta.href} className={styles.statusLink}>
                          {card.cta.label}
                          <ExternalLink size={14} />
                        </Link>
                      ) : card.cta?.intent ? (
                        <button type="button" className={styles.statusLink} onClick={() => openAction(card.cta!)}>
                          {card.cta.label}
                          <ArrowRight size={14} />
                        </button>
                      ) : null}
                    </div>
                    <div className={styles.messageBody}>
                      <p className={styles.messageBodyStrong}>{card.title}</p>
                      <p>{card.body}</p>
                    </div>
                    <div className={styles.kvGrid}>
                      {card.details.map((item) => (
                        <div key={`${card.id}-${item.label}`} className={styles.kvItem}>
                          <span>{item.label}</span>
                          <strong className={toneClass(item.tone)}>{item.value}</strong>
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
              {isSending ? (
                <article className={`${styles.message} ${styles.typingMessage} ${styles.nfaMessage}`}>
                  <div className={styles.messageHead}>
                    <div className={styles.messageLabel}>
                      <MessageSquareText size={16} className={styles.warm} />
                      {terminalNfas.detail?.displayName ?? companion.name}
                    </div>
                    <span className={styles.messageTime}>{pick('正在思考', 'Thinking')}</span>
                  </div>
                  <div className={styles.typingDots} aria-label={pick('NFA 正在回复', 'NFA is replying')}>
                    <span />
                    <span />
                    <span />
                  </div>
                </article>
              ) : null}
              {activeAction ? (
                <TerminalActionPanel
                  action={activeAction}
                  companion={companion}
                  memory={terminalMemory}
                  memoryCandidate={memoryCandidate}
                  onClose={() => setActiveAction(null)}
                  onReceipt={(card) => {
                    const shouldClosePanel =
                      card.type === 'receipt' &&
                      !card.id.startsWith('mint-commit-');
                    pendingReceiptScrollRef.current = shouldClosePanel;
                    if (shouldClosePanel) {
                      setActiveAction(null);
                      localChat.appendCards([card]);
                      return;
                    }
                    localChat.appendCards([card]);
                  }}
                />
              ) : null}
              <div ref={streamEndRef} />
            </div>

            <form className={styles.heroComposer} onSubmit={handleCommandSubmit}>
              <div className={styles.suggestionChips}>
                {quickPrompts.map(({ label, value, icon: Icon, tone, action }) => (
                  <button
                    key={value}
                    type="button"
                    className={styles.suggestionChip}
                    onClick={() => {
                      setDraft(value);
                      openAction(action);
                    }}
                  >
                    <Icon size={15} className={tone} />
                    {label}
                  </button>
                ))}
              </div>

              <div className={styles.composerInputShell}>
                <input
                  className={styles.composerInput}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={pick('例如：去挖矿、看竞技、开代理、补储备、打开市场、@12', 'Try: mine, arena, auto, funds, market, @12')}
                  disabled={isSending}
                />
                <button type="submit" className={styles.composerSendButton} disabled={isSending}>
                  <ArrowRight size={16} />
                  {isSending ? pick('整理中', 'Thinking') : pick('发送', 'Send')}
                </button>
              </div>
              {terminalHistory.error ? (
                <div className={styles.composerTips}>
                  {terminalHistory.error ? (
                    <span className={styles.commandHint}>
                      {pick('历史暂时没接上：', 'History is not connected: ')}
                      {terminalHistory.error}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </form>
          </section>

          {(drawerOpen || railOpen) ? (
            <div
              className={styles.drawerOverlay}
              onClick={() => {
                setDrawerOpen(false);
                setRailOpen(false);
              }}
            />
          ) : null}

          <aside data-terminal-scroll="true" className={`${styles.drawer} ${drawerOpen ? styles.drawerOpen : ''}`}>
            <div className={styles.drawerBody}>
              <section className={styles.drawerHero}>
                <div className={styles.cardHead}>
                  <div className={styles.cardLabel}>
                    <CircleDot size={16} className={toneClass(companion.statusTone)} />
                    {pick('当前 NFA', 'Current NFA')}
                  </div>
                  <button type="button" className={`${styles.drawerToggle} ${styles.hiddenDesktop}`} onClick={() => setDrawerOpen(false)}>
                    <X size={16} />
                    {pick('关闭', 'Close')}
                  </button>
                </div>
                <div className={styles.drawerHeroTop}>
                  <div className={styles.drawerAvatar}>
                    {avatarSrc ? <img className={styles.drawerAvatarImage} src={avatarSrc} alt={displayName} /> : <RailGlyph tokenId={companion.tokenId} />}
                  </div>
                  <div>
                    <div className={`${styles.drawerLineOne} ${styles.mono}`}>#{companion.tokenNumber} · {rarityText || 'NFA'}</div>
                    <div className={styles.drawerLineTwo}>{displayName}</div>
                    <div className={`${styles.drawerLineThree} ${styles.mono}`}>
                      Lv.{terminalNfas.detail?.level ?? companion.level} · {shelterText || 'NFA'}
                    </div>
                  </div>
                </div>
                <div className={styles.quoteBlock}>{drawerMemoryText}</div>
                <div className={styles.drawerButtonPair}>
                  <button type="button" className={styles.drawerButton} onClick={() => openAction('auto')}>
                    {pick('编辑指令', 'Edit directive')}
                  </button>
                  <button type="button" className={styles.drawerButton} onClick={() => openAction('memory')}>
                    {pick('记忆图谱', 'Memory map')}
                  </button>
                </div>
              </section>

              <section className={styles.drawerSection}>
                <div className={styles.drawerSectionHead}>
                  <Zap size={12} />
                  {pick('能量', 'Energy')}
                </div>
                <div className={styles.drawerRow}>
                  <span className={styles.drawerKey}>{pick('心跳', 'Pulse')}</span>
                  <div className={styles.pulseBar}>
                    <div className={styles.pulseFill} style={{ width: `${pulsePercent}%` }} />
                  </div>
                  <span className={`${styles.drawerValue} ${styles.warm}`}>{pulsePercent}%</span>
                </div>
                <div className={styles.drawerRow}>
                  <span className={styles.drawerKey}>{pick('日维护', 'Daily upkeep')}</span>
                  <span className={styles.drawerValue}>{companion.dailyCostText}</span>
                </div>
                <div className={styles.drawerRow}>
                  <span className={styles.drawerKey}>{pick('续航', 'Runway')}</span>
                  <span className={`${styles.drawerValue} ${toneClass(companion.statusTone)}`}>
                    {companion.upkeepDays === null ? 'n/a' : `${companion.upkeepDays} ${pick('天', 'd')}`}
                  </span>
                </div>
              </section>

              <section className={styles.drawerSection}>
                <div className={styles.drawerSectionHead}>
                  <Shield size={12} />
                  {pick('账本', 'Ledger')}
                </div>
                <div className={styles.drawerRow}>
                  <span className={styles.drawerKey}>{pick('储备', 'Reserve')}</span>
                  <span className={`${styles.drawerValue} ${styles.warm}`}>{companion.routerClaworldText}</span>
                </div>
                <div className={styles.drawerRow}>
                  <span className={styles.drawerKey}>{pick('胜败', 'Record')}</span>
                  <span className={styles.drawerValue}>
                    {lang === 'zh' ? `${companion.pkWins}胜 / ${companion.pkLosses}败` : `${companion.pkWins}W / ${companion.pkLosses}L`}
                  </span>
                </div>
                <div className={styles.drawerRow}>
                  <span className={styles.drawerKey}>{pick('胜率', 'Win rate')}</span>
                  <span className={`${styles.drawerValue} ${styles.growth}`}>{companion.pkWinRate}%</span>
                </div>
              </section>

              <section className={styles.drawerSection}>
                <div className={styles.drawerSectionHead}>
                  <Bot size={12} />
                  {pick('自治', 'Autonomy')}
                </div>
                <div className={styles.drawerRow}>
                  <span className={styles.drawerKey}>{pick('状态', 'Status')}</span>
                  <span className={styles.drawerValue}>
                    {terminalAutonomy.status?.enabled
                      ? (terminalAutonomy.status.paused ? pick('暂停', 'Paused') : pick('运行', 'Running'))
                      : pick('未开', 'Off')}
                  </span>
                </div>
                <div className={styles.drawerRow}>
                  <span className={styles.drawerKey}>{pick('预算', 'Budget')}</span>
                  <span className={styles.drawerValue}>
                    {totalBudget > 0n ? `${formatCLW(usedBudget)} / ${formatCLW(totalBudget)}` : pick('未设置', 'Not set')}
                  </span>
                </div>
                <div className={styles.budgetBar}>
                  <div className={`${styles.budgetFill} ${budgetPercent > 80 ? styles.budgetFillWarn : ''}`} style={{ width: `${budgetPercent}%` }} />
                </div>
              </section>

              <details className={styles.drawerDetails}>
                <summary>{pick('世界', 'World')}</summary>
                <div className={styles.compactStatusGrid}>
                  <div className={styles.statusCard}>
                    <span>{pick('大逃杀', 'Battle Royale')}</span>
                    <strong>{battleRoyaleSummary?.matchId ? `#${battleRoyaleSummary.matchId}` : '--'}</strong>
                  </div>
                  <div className={styles.statusCard}>
                    <span>{pick('人数', 'Players')}</span>
                    <strong>{battleRoyaleSummary ? `${battleRoyaleSummary.players}/${battleRoyaleSummary.triggerCount || 10}` : '--'}</strong>
                  </div>
                  <div className={styles.statusCard}>
                    <span>{pick('状态', 'Status')}</span>
                    <strong className={battleRoyaleSummary?.status === 'pending_reveal' ? styles.alert : styles.cool}>
                      {battleRoyaleSummary?.status === 'open'
                        ? pick('开放', 'Open')
                        : battleRoyaleSummary?.status === 'pending_reveal'
                          ? pick('待揭示', 'Reveal')
                          : battleRoyaleSummary?.status === 'settled'
                            ? pick('已结算', 'Settled')
                            : '--'}
                    </strong>
                  </div>
                  <div className={styles.statusCard}>
                    <span>{pick('奖池', 'Pot')}</span>
                    <strong className={styles.warm}>{battleRoyaleSummary ? formatCLW(safeBigInt(battleRoyaleSummary.potCLW)) : '--'}</strong>
                  </div>
                </div>
              </details>

              <details className={styles.drawerDetails}>
                <summary>{pick('记忆', 'Memory')}</summary>
                <div className={styles.miniList}>
                  <div className={styles.miniItem}>
                    <strong>{terminalMemory.summary ? pick('已加载', 'Loaded') : pick('暂无摘要', 'No summary')}</strong>
                    <p>
                      {terminalMemory.summary?.identity ??
                        (lang === 'zh' ? terminalNfas.detail?.memorySummary : undefined) ??
                        terminalMemory.error ??
                        pick('新的记忆会在链下正文存储和学习树写回打通后继续变厚。', 'New memories will appear here after storage and learning-tree sync.')}
                    </p>
                  </div>
                  {terminalMemory.timeline.slice(0, 2).map((snapshot) => (
                    <div key={snapshot.snapshotId} className={styles.miniItem}>
                      <strong>{new Date(snapshot.consolidatedAt).toLocaleDateString('zh-CN')}</strong>
                      <p>{snapshot.diffSummary}</p>
                    </div>
                  ))}
                </div>
              </details>

              <details className={styles.drawerDetails}>
                <summary>{pick('最近结果', 'Recent results')}</summary>
                <div className={styles.compactStatusGrid}>
                  <div className={styles.statusCard}>
                    <span>{pick('任务', 'Tasks')}</span>
                    <strong>{terminalAutonomy.status?.recentActions.filter((item) => item.skill === 'task').length ?? 0}</strong>
                  </div>
                  <div className={styles.statusCard}>
                    <span>PK</span>
                    <strong>{terminalAutonomy.status?.recentActions.filter((item) => item.skill === 'pk').length ?? 0}</strong>
                  </div>
                  <div className={styles.statusCard}>
                    <span>{pick('大逃杀', 'Battle Royale')}</span>
                    <strong>{terminalAutonomy.status?.recentActions.filter((item) => item.skill === 'battle_royale').length ?? 0}</strong>
                  </div>
                  <div className={styles.statusCard}>
                    <span>{pick('对话', 'Chat')}</span>
                    <strong>{localChat.count}</strong>
                  </div>
                </div>
                <div className={styles.miniList}>
                  {recentSummary ? (
                    <div className={styles.miniItem}>
                      <strong>{pick('最近动作', 'Latest action')}</strong>
                      <p>{recentSummary.summary}</p>
                    </div>
                  ) : (
                    <div className={styles.emptyState}>{pick('暂无代理动作。', 'No proxy action yet.')}</div>
                  )}
                  <button type="button" className={styles.statusLink} onClick={localChat.clearCards} disabled={localChat.count === 0}>
                    {pick('清空本地对话', 'Clear local chat')}
                  </button>
                </div>
              </details>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
