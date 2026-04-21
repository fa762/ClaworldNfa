'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Bot,
  Brain,
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
import { useActiveCompanion } from '@/components/lobster/useActiveCompanion';
import { MintPanel } from '@/components/mint/MintPanel';
import { formatCLW, truncateAddress } from '@/lib/format';
import type { TerminalActionIntent, TerminalCard, TerminalChatStreamEvent, TerminalProposalAction, TerminalTone } from '@/lib/terminal-cards';
import { TerminalActionPanel } from './TerminalActionPanel';
import { useTerminalNfas } from './useTerminalNfas';
import { useTerminalWorld } from './useTerminalWorld';
import { useTerminalMemory } from './useTerminalMemory';
import { useTerminalAutonomy } from './useTerminalAutonomy';
import { useTerminalChatHistory } from './useTerminalChatHistory';
import { useTerminalEvents } from './useTerminalEvents';
import { useTerminalLocalChat } from './useTerminalLocalChat';

function toneClass(tone?: TerminalTone) {
  if (!tone) return '';
  return styles[tone];
}

function describeCompanion(companion: ReturnType<typeof useActiveCompanion>) {
  if (!companion.connected) {
    return '先接入钱包，终端才会读取你的 NFA、账本和动作结果。';
  }
  if (!companion.hasToken) {
    return '你还没有可用的 NFA。先去铸造，终端会把它接进来。';
  }
  if (!companion.active) {
    return '这只 NFA 当前停在维护前。先补储备，它才能继续挖矿、PK 和自治。';
  }
  return companion.stance;
}

function buildBaseFeed(
  companion: ReturnType<typeof useActiveCompanion>,
  detail: ReturnType<typeof useTerminalNfas>['detail'],
  memory: ReturnType<typeof useTerminalMemory>,
): TerminalCard[] {
  const cards: TerminalCard[] = [];
  const detailMemorySummary = memory.summary?.identity ?? detail?.memorySummary;

  if (companion.hasToken) {
    cards.push({
      id: 'intro',
      type: 'message',
      role: 'nfa',
      label: '已接入',
      title: '',
      body: detailMemorySummary ?? describeCompanion(companion),
      tone: 'warm',
      meta: `#${companion.tokenNumber} · Lv.${companion.level}`,
    });
    return cards;
  }

  cards.push({
    id: 'intro',
    type: 'message',
    role: 'system',
    label: '等待接入',
    title: '先接入一只 NFA',
    body: describeCompanion(companion),
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
  if (key === 'mint') return 'mint';
  if (key === 'memory' || key === 'cml') return 'memory';
  if (key === 'settings' || key === 'model' || key === 'byok') return 'settings';
  if (key === 'status') return 'status';
  return null;
}

function ConnectWall() {
  return (
    <div className={styles.connectShell}>
      <div className={styles.connectGrid} />
      <div className={styles.connectCard}>
        <p className={styles.eyebrow}>龙虾世界</p>
        <h1>连接钱包</h1>
        <p>接入 NFA，直接进入对话、挖矿、竞技和代理。</p>
        <div className={styles.connectActions}>
          <ConnectButton />
          <span className={styles.connectHint}>有 NFA 会直接进入。</span>
        </div>
      </div>
    </div>
  );
}

function NoCompanionState() {
  return (
    <div className={styles.connectShell}>
      <div className={styles.connectGrid} />
      <div className={styles.connectCard}>
        <p className={styles.eyebrow}>龙虾世界</p>
        <h1>先铸造一只 NFA</h1>
        <p>这个钱包还没有 NFA。铸造完成后会自动进入对话界面。</p>
        <div className={styles.inlineMintWrap}>
          <MintPanel />
        </div>
      </div>
    </div>
  );
}

function CompanionLoadingState() {
  return (
    <div className={styles.connectShell}>
      <div className={styles.connectGrid} />
      <div className={styles.connectCard}>
        <p className={styles.eyebrow}>龙虾世界</p>
        <h1>正在读取你的 NFA</h1>
        <p>钱包已经连接。终端正在读取持有列表、当前龙虾、账本和记忆上下文。</p>
        <div className={styles.loadingBars} aria-label="正在读取">
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
  const companion = useActiveCompanion();
  const terminalNfas = useTerminalNfas(companion.ownerAddress, companion.hasToken ? companion.tokenId : undefined);
  const terminalWorld = useTerminalWorld();
  const terminalMemory = useTerminalMemory(companion.hasToken ? companion.tokenId : undefined, companion.ownerAddress);
  const terminalAutonomy = useTerminalAutonomy(companion.hasToken ? companion.tokenId : undefined);
  const terminalHistory = useTerminalChatHistory(companion.hasToken ? companion.tokenId : undefined, companion.ownerAddress);
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
  const routeActionRef = useRef<string | null>(null);

  const baseCards = useMemo(
    () => buildBaseFeed(companion, terminalNfas.detail, terminalMemory),
    [companion, terminalMemory, terminalNfas.detail],
  );
  const seedCards = terminalHistory.cards.length ? terminalHistory.cards : baseCards;
  const cards = useMemo(
    () => [...seedCards, ...terminalEvents.cards, ...localChat.cards],
    [localChat.cards, seedCards, terminalEvents.cards],
  );

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
    const node = streamRef.current;
    const end = streamEndRef.current;
    if (!node || !end) return;

    const scrollToBottom = () => {
      end.scrollIntoView({ block: 'end', behavior: 'smooth' });
      node.scrollTop = node.scrollHeight;
    };

    scrollToBottom();
    const raf = window.requestAnimationFrame(scrollToBottom);
    const timeout = window.setTimeout(scrollToBottom, 80);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timeout);
    };
  }, [activeAction, cards.length, isSending]);

  useEffect(() => {
    setWalletMenuOpen(false);
  }, [address]);

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

  if (!isConnected || !address) {
    return <ConnectWall />;
  }

  if (companion.isLoading && !companion.hasToken) {
    return <CompanionLoadingState />;
  }

  if (!companion.hasToken) {
    return <NoCompanionState />;
  }

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
        label: '你',
        title: '',
        body: content,
        tone: 'warm',
        meta: '刚刚',
      },
    ]);
    setDraft('');

    if (chatEngine.preferredMode === 'byok' && !chatEngine.engine) {
      localChat.appendCards([
        {
          id: `engine-locked-${Date.now()}`,
          type: 'message',
          role: 'system',
          label: '模型设置',
          title: '',
          body: 'BYOK 未解锁，先开模型设置。',
          tone: 'alert',
          meta: '刚刚',
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
          content,
          owner: companion.ownerAddress,
          history: cards.slice(-12),
          engine: chatEngine.engine ?? undefined,
          memoryOverride: {
            summary: terminalMemory.summary,
            timeline: terminalMemory.timeline.slice(0, 6),
          },
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`终端接口返回 ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const handleParsedEvent = (item: { event: string; data: string }) => {
        const payload = JSON.parse(item.data) as TerminalChatStreamEvent;
        if (item.event === 'card' && payload.type === 'card') {
          localChat.appendCards([payload.card]);
          const action = resolveCardAction(payload.card);
          if (action) openAction(action, { silent: true });
        }
        if (item.event === 'error' && payload.type === 'error') {
          localChat.appendCards([
            {
              id: `terminal-error-${Date.now()}`,
              type: 'message',
              role: 'system',
              label: '终端错误',
              title: '这次整理动作失败了',
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
          label: '终端错误',
          title: '当前还没能完成这次整理',
          body: error instanceof Error ? error.message : '未知错误',
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
    const title =
      intent === 'mining'
        ? '挖矿'
        : intent === 'arena'
          ? '竞技'
          : intent === 'auto'
            ? '代理'
            : intent === 'mint'
              ? '铸造'
                : intent === 'settings'
                  ? '模型设置'
              : '状态';
    localChat.appendCards([
      {
        id: `action-open-${intent}-${Date.now()}`,
        type: 'message',
        role: 'system',
        label: '动作卡',
        title: '',
        body: `已打开${title}。`,
        tone: 'warm',
        meta: '刚刚',
      },
    ]);
  }

  const recentSummary = terminalAutonomy.status?.recentActions?.[0];
  const battleRoyaleSummary = terminalWorld.summary?.battleRoyale;
  const railItems =
    terminalNfas.rail.length > 0
      ? terminalNfas.rail.map((item) => ({
          tokenId: BigInt(item.tokenId),
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
  const drawerMemoryText = terminalMemory.summary?.identity ?? terminalNfas.detail?.memorySummary ?? describeCompanion(companion);
  const totalBudget = terminalAutonomy.status?.budget.totalCLW ? BigInt(terminalAutonomy.status.budget.totalCLW) : 0n;
  const usedBudget = terminalAutonomy.status?.budget.usedCLW ? BigInt(terminalAutonomy.status.budget.usedCLW) : 0n;
  const budgetPercent = totalBudget > 0n ? Number((usedBudget * 100n) / totalBudget) : 0;
  const quickPrompts = [
    { label: '挖矿', value: '去挖矿', icon: Pickaxe, tone: styles.growth },
    { label: '竞技', value: '看竞技', icon: Swords, tone: styles.warm },
    { label: '代理', value: '开代理', icon: Bot, tone: styles.cool },
    { label: '记忆', value: '看记忆', icon: Brain, tone: styles.alert },
  ] as const;

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
              关闭
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
                  aria-label={`切换到 ${item.label}`}
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
            aria-label="打开铸造"
            onClick={() => {
              setRailOpen(false);
              openAction('mint');
            }}
          >
            <Compass size={18} />
          </button>
          <div className={styles.railMeta}>
            <div>#{companion.tokenNumber}</div>
            <div>{terminalNfas.rail.length || companion.ownedCount} 只在线</div>
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
                  aria-label="打开 NFA 列表"
                >
                  {avatarSrc ? <img src={avatarSrc} alt={displayName} /> : <RailGlyph tokenId={companion.tokenId} />}
                </button>
                <div className={`${styles.heroAvatar} ${styles.hiddenMobile}`}>
                  {avatarSrc ? <img src={avatarSrc} alt={displayName} /> : <RailGlyph tokenId={companion.tokenId} />}
                </div>
                <div className={styles.titleBlock}>
                  <p className={styles.eyebrow}>对话入口</p>
                  <h2>{displayName}</h2>
                  <p className={`${styles.subline} ${styles.mono}`}>
                    #{companion.tokenNumber} · {terminalNfas.detail?.rarity ?? companion.shelterName} · Lv.{terminalNfas.detail?.level ?? companion.level} · {companion.statusLabel}
                  </p>
                </div>
              </div>
              <div className={styles.headerActions}>
                <div className={styles.pulsePill}>
                  <span className={styles.pulseDot} />
                  <span>心跳 {pulsePercent}%</span>
                </div>
                <div className={styles.pulsePill}>
                  <span className={styles.pulseDot} />
                  <span>{chatEngine.activeMode === 'byok' ? '自带模型' : '项目模型'}</span>
                </div>
                <div className={styles.walletMenuWrap}>
                  <button type="button" className={styles.walletPill} onClick={() => setWalletMenuOpen((open) => !open)}>
                    <Shield size={14} />
                    {truncateAddress(address)}
                  </button>
                  {walletMenuOpen ? (
                    <div className={styles.walletMenu}>
                      <button
                        type="button"
                        className={styles.walletMenuButton}
                        onClick={() => {
                          setWalletMenuOpen(false);
                          openAction('settings');
                        }}
                      >
                        模型设置
                      </button>
                      <button type="button" className={styles.walletMenuButton} onClick={requestWalletReconnect}>
                        切换钱包
                      </button>
                      <button
                        type="button"
                        className={`${styles.walletMenuButton} ${styles.walletMenuButtonDanger}`}
                        onClick={() => {
                          setWalletMenuOpen(false);
                          disconnect();
                        }}
                      >
                        断开连接
                      </button>
                    </div>
                  ) : null}
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
                  状态
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
                      <span className={styles.cardWatermark}>世</span>
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
                    <span className={styles.messageTime}>正在思考</span>
                  </div>
                  <div className={styles.typingDots} aria-label="NFA 正在回复">
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
                    localChat.appendCards([card]);
                    if (activeAction === 'mining') {
                      setActiveAction(null);
                    }
                  }}
                />
              ) : null}
              <div ref={streamEndRef} />
            </div>

            <form className={styles.heroComposer} onSubmit={handleCommandSubmit}>
              <div className={styles.suggestionChips}>
                {quickPrompts.map(({ label, value, icon: Icon, tone }) => (
                  <button
                    key={value}
                    type="button"
                    className={styles.suggestionChip}
                    onClick={() => {
                      setDraft(value);
                      if (label === '挖矿') openAction('mining');
                      if (label === '竞技') openAction('arena');
                      if (label === '代理') openAction('auto');
                      if (label === '记忆') openAction('memory');
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
                  placeholder="例如：去挖矿 / 打一场 PK / 看大逃杀 / 开代理"
                  disabled={isSending}
                />
                <button type="submit" className={styles.composerSendButton} disabled={isSending}>
                  <ArrowRight size={16} />
                  {isSending ? '整理中' : '发送'}
                </button>
              </div>
              {(terminalHistory.error || terminalEvents.error) ? (
                <div className={styles.composerTips}>
                  {terminalHistory.error ? <span className={styles.commandHint}>历史暂时没接上：{terminalHistory.error}</span> : null}
                  {terminalEvents.error ? <span className={styles.commandHint}>事件流暂时断开：{terminalEvents.error}</span> : null}
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
                    当前 NFA
                  </div>
                  <button type="button" className={`${styles.drawerToggle} ${styles.hiddenDesktop}`} onClick={() => setDrawerOpen(false)}>
                    <X size={16} />
                    关闭
                  </button>
                </div>
                <div className={styles.drawerHeroTop}>
                  <div className={styles.drawerAvatar}>
                    {avatarSrc ? <img className={styles.drawerAvatarImage} src={avatarSrc} alt={displayName} /> : <RailGlyph tokenId={companion.tokenId} />}
                  </div>
                  <div>
                    <div className={`${styles.drawerLineOne} ${styles.mono}`}>#{companion.tokenNumber} · {terminalNfas.detail?.rarity ?? 'NFA'}</div>
                    <div className={styles.drawerLineTwo}>{displayName}</div>
                    <div className={`${styles.drawerLineThree} ${styles.mono}`}>
                      Lv.{terminalNfas.detail?.level ?? companion.level} · {terminalNfas.detail?.shelter ?? companion.shelterName}
                    </div>
                  </div>
                </div>
                <div className={styles.quoteBlock}>{drawerMemoryText}</div>
                <div className={styles.drawerButtonPair}>
                  <button type="button" className={styles.drawerButton} onClick={() => openAction('auto')}>
                    编辑指令
                  </button>
                  <button type="button" className={styles.drawerButton} onClick={() => openAction('memory')}>
                    记忆图谱
                  </button>
                </div>
              </section>

              <section className={styles.drawerSection}>
                <div className={styles.drawerSectionHead}>
                  <Zap size={12} />
                  能量
                </div>
                <div className={styles.drawerRow}>
                  <span className={styles.drawerKey}>心跳</span>
                  <div className={styles.pulseBar}>
                    <div className={styles.pulseFill} style={{ width: `${pulsePercent}%` }} />
                  </div>
                  <span className={`${styles.drawerValue} ${styles.warm}`}>{pulsePercent}%</span>
                </div>
                <div className={styles.drawerRow}>
                  <span className={styles.drawerKey}>日维护</span>
                  <span className={styles.drawerValue}>{companion.dailyCostText}</span>
                </div>
                <div className={styles.drawerRow}>
                  <span className={styles.drawerKey}>续航</span>
                  <span className={`${styles.drawerValue} ${toneClass(companion.statusTone)}`}>
                    {companion.upkeepDays === null ? 'n/a' : `${companion.upkeepDays} 天`}
                  </span>
                </div>
              </section>

              <section className={styles.drawerSection}>
                <div className={styles.drawerSectionHead}>
                  <Shield size={12} />
                  账本
                </div>
                <div className={styles.drawerRow}>
                  <span className={styles.drawerKey}>储备</span>
                  <span className={`${styles.drawerValue} ${styles.warm}`}>{companion.routerClaworldText}</span>
                </div>
                <div className={styles.drawerRow}>
                  <span className={styles.drawerKey}>胜败</span>
                  <span className={styles.drawerValue}>
                    {companion.pkWins}胜 / {companion.pkLosses}败
                  </span>
                </div>
                <div className={styles.drawerRow}>
                  <span className={styles.drawerKey}>胜率</span>
                  <span className={`${styles.drawerValue} ${styles.growth}`}>{companion.pkWinRate}%</span>
                </div>
              </section>

              <section className={styles.drawerSection}>
                <div className={styles.drawerSectionHead}>
                  <Bot size={12} />
                  自治
                </div>
                <div className={styles.drawerRow}>
                  <span className={styles.drawerKey}>状态</span>
                  <span className={styles.drawerValue}>
                    {terminalAutonomy.status?.enabled ? (terminalAutonomy.status.paused ? '暂停' : '运行') : '未开'}
                  </span>
                </div>
                <div className={styles.drawerRow}>
                  <span className={styles.drawerKey}>预算</span>
                  <span className={styles.drawerValue}>
                    {totalBudget > 0n ? `${formatCLW(usedBudget)} / ${formatCLW(totalBudget)}` : '未设置'}
                  </span>
                </div>
                <div className={styles.budgetBar}>
                  <div className={`${styles.budgetFill} ${budgetPercent > 80 ? styles.budgetFillWarn : ''}`} style={{ width: `${budgetPercent}%` }} />
                </div>
              </section>

              <details className={styles.drawerDetails}>
                <summary>世界</summary>
                <div className={styles.compactStatusGrid}>
                  <div className={styles.statusCard}>
                    <span>大逃杀</span>
                    <strong>{battleRoyaleSummary?.matchId ? `#${battleRoyaleSummary.matchId}` : '--'}</strong>
                  </div>
                  <div className={styles.statusCard}>
                    <span>人数</span>
                    <strong>{battleRoyaleSummary ? `${battleRoyaleSummary.players}/${battleRoyaleSummary.triggerCount || 10}` : '--'}</strong>
                  </div>
                  <div className={styles.statusCard}>
                    <span>状态</span>
                    <strong className={battleRoyaleSummary?.status === 'pending_reveal' ? styles.alert : styles.cool}>
                      {battleRoyaleSummary?.status === 'open'
                        ? '开放'
                        : battleRoyaleSummary?.status === 'pending_reveal'
                          ? '待揭示'
                          : battleRoyaleSummary?.status === 'settled'
                            ? '已结算'
                            : '--'}
                    </strong>
                  </div>
                  <div className={styles.statusCard}>
                    <span>奖池</span>
                    <strong className={styles.warm}>{battleRoyaleSummary ? formatCLW(BigInt(battleRoyaleSummary.potCLW)) : '--'}</strong>
                  </div>
                </div>
              </details>

              <details className={styles.drawerDetails}>
                <summary>记忆</summary>
                <div className={styles.miniList}>
                  <div className={styles.miniItem}>
                    <strong>{terminalMemory.summary ? '已加载' : '暂无摘要'}</strong>
                    <p>{terminalMemory.summary?.identity ?? terminalNfas.detail?.memorySummary ?? terminalMemory.error ?? '新的记忆会在链下正文存储和学习树写回打通后继续变厚。'}</p>
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
                <summary>最近结果</summary>
                <div className={styles.compactStatusGrid}>
                  <div className={styles.statusCard}>
                    <span>任务</span>
                    <strong>{terminalAutonomy.status?.recentActions.filter((item) => item.skill === 'task').length ?? 0}</strong>
                  </div>
                  <div className={styles.statusCard}>
                    <span>PK</span>
                    <strong>{terminalAutonomy.status?.recentActions.filter((item) => item.skill === 'pk').length ?? 0}</strong>
                  </div>
                  <div className={styles.statusCard}>
                    <span>大逃杀</span>
                    <strong>{terminalAutonomy.status?.recentActions.filter((item) => item.skill === 'battle_royale').length ?? 0}</strong>
                  </div>
                  <div className={styles.statusCard}>
                    <span>对话</span>
                    <strong>{localChat.count}</strong>
                  </div>
                </div>
                <div className={styles.miniList}>
                  {recentSummary ? (
                    <div className={styles.miniItem}>
                      <strong>最近动作</strong>
                      <p>{recentSummary.summary}</p>
                    </div>
                  ) : (
                    <div className={styles.emptyState}>暂无代理动作。</div>
                  )}
                  <button type="button" className={styles.statusLink} onClick={localChat.clearCards} disabled={localChat.count === 0}>
                    清空本地对话
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
