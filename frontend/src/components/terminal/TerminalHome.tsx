'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
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
import { useAccount } from 'wagmi';

import styles from './TerminalHome.module.css';
import { ConnectButton } from '@/components/wallet/ConnectButton';
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
      label: '龙虾已上线',
      title: `${companion.name} 在等你的指令`,
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

function ConnectWall() {
  return (
    <div className={styles.connectShell}>
      <div className={styles.connectGrid} />
      <div className={styles.connectCard}>
        <p className={styles.eyebrow}>龙虾世界</p>
        <h1>连接钱包</h1>
        <p>接入你的 NFA，开始聊天、挖矿、竞技和代理。</p>
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
  const companion = useActiveCompanion();
  const terminalNfas = useTerminalNfas(companion.ownerAddress, companion.hasToken ? companion.tokenId : undefined);
  const terminalWorld = useTerminalWorld();
  const terminalMemory = useTerminalMemory(companion.hasToken ? companion.tokenId : undefined);
  const terminalAutonomy = useTerminalAutonomy(companion.hasToken ? companion.tokenId : undefined);
  const terminalHistory = useTerminalChatHistory(companion.hasToken ? companion.tokenId : undefined, companion.ownerAddress);
  const terminalEvents = useTerminalEvents(companion.hasToken ? companion.tokenId : undefined, companion.ownerAddress);
  const localChat = useTerminalLocalChat(companion.hasToken ? companion.tokenId : undefined, companion.ownerAddress);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [activeAction, setActiveAction] = useState<TerminalActionIntent | null>(null);
  const streamRef = useRef<HTMLDivElement | null>(null);

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
    const node = streamRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' });
  }, [activeAction, cards.length, isSending]);

  if (!isConnected || !address) {
    return <ConnectWall />;
  }

  if (companion.isLoading && !companion.hasToken) {
    return <CompanionLoadingState />;
  }

  if (!companion.hasToken) {
    return <NoCompanionState />;
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
        title: content,
        body: '已发送给当前 NFA。',
        tone: 'warm',
        meta: '刚刚',
      },
    ]);
    setDraft('');

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
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`终端接口返回 ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parsed = parseSseChunk(buffer);
        buffer = parsed.remainder;

        for (const item of parsed.events) {
          const payload = JSON.parse(item.data) as TerminalChatStreamEvent;
          if (item.event === 'card' && payload.type === 'card') {
            localChat.appendCards([payload.card]);
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
    return null;
  }

  function openAction(action: TerminalProposalAction | TerminalActionIntent) {
    const intent = typeof action === 'string' ? action : resolveActionIntent(action);
    if (!intent) return;
    setActiveAction(intent);
    const title =
      intent === 'mining'
        ? '挖矿卡已打开'
        : intent === 'arena'
          ? '竞技卡已打开'
          : intent === 'auto'
            ? '代理卡已打开'
            : intent === 'mint'
              ? '铸造卡已打开'
              : '状态卡已打开';
    localChat.appendCards([
      {
        id: `action-open-${intent}-${Date.now()}`,
        type: 'message',
        role: 'system',
        label: '动作卡',
        title,
        body: '就在当前对话里处理，不再跳到老页面。',
        tone: 'warm',
        meta: '刚刚',
      },
    ]);
  }

  const recentSummary = terminalAutonomy.status?.recentActions?.[0];
  const quickPrompts = [
    { label: '挖矿', value: '去挖矿', icon: Pickaxe, tone: styles.growth },
    { label: '竞技', value: '看竞技', icon: Swords, tone: styles.warm },
    { label: '代理', value: '开代理', icon: Bot, tone: styles.cool },
    { label: '记忆', value: '看记忆', icon: Brain, tone: styles.alert },
  ] as const;

  return (
    <div className={styles.root}>
      <div className={styles.shell}>
        <aside className={styles.rail}>
          <div className={styles.railHead}>
            <button type="button" className={styles.mintButton} aria-label="打开铸造" onClick={() => openAction('mint')}>
              <Compass size={18} />
            </button>
            <span className={styles.railTitle}>NFA</span>
          </div>
          <div className={styles.railList}>
            {(terminalNfas.rail.length > 0
              ? terminalNfas.rail.map((item) => ({
                  tokenId: BigInt(item.tokenId),
                  pulse: item.pulse,
                  unreadCount: item.unreadCount,
                  label: item.displayName,
                }))
              : companion.ownedTokens.map((tokenId) => ({
                  tokenId,
                  pulse: 0,
                  unreadCount: 0,
                  label: `#${tokenId.toString()}`,
                }))).map((item) => {
              const active = item.tokenId === companion.tokenId;
              return (
                <button
                  key={item.tokenId.toString()}
                  type="button"
                  className={`${styles.railItem} ${active ? styles.railItemActive : ''}`}
                  onClick={() => companion.selectCompanion(item.tokenId)}
                  aria-label={`切换到 ${item.label}`}
                  title={`${item.label} · pulse ${Math.round(item.pulse * 100)}%`}
                >
                  <RailGlyph tokenId={item.tokenId} />
                  {active ? <span className={styles.railBadge}>•</span> : null}
                  {!active && item.unreadCount > 0 ? <span className={styles.railBadge}>{item.unreadCount}</span> : null}
                </button>
              );
            })}
          </div>
          <div className={styles.railMeta}>
            <div>#{companion.tokenNumber}</div>
            <div>{terminalNfas.rail.length || companion.ownedCount} 只在线</div>
          </div>
        </aside>

        <div className={styles.main}>
          <section className={styles.conversation}>
            <header className={styles.conversationHead}>
              <div className={styles.titleBlock}>
                <p className={styles.eyebrow}>对话入口</p>
                <h2>{terminalNfas.detail?.displayName ?? companion.name}</h2>
                <p className={styles.subline}>
                  #{companion.tokenNumber} · {terminalNfas.detail?.shelter ?? companion.shelterName} · Lv.{terminalNfas.detail?.level ?? companion.level}
                </p>
              </div>
              <div className={styles.headerActions}>
                <div className={styles.walletPill}>
                  <Shield size={14} />
                  {truncateAddress(address)}
                </div>
                <button type="button" className={`${styles.drawerToggle} ${styles.hiddenDesktop}`} onClick={() => setDrawerOpen(true)}>
                  <Menu size={16} />
                  状态
                </button>
              </div>
            </header>

            <div className={styles.stream} ref={streamRef}>
              {cards.map((card) => {
                if (card.type === 'message') {
                  return (
                    <article
                      key={card.id}
                      className={`${styles.message} ${card.role === 'user' ? styles.messageUser : ''} ${card.role === 'system' ? styles.systemCard : ''}`}
                    >
                      <div className={styles.messageHead}>
                        <div className={styles.messageLabel}>
                          <MessageSquareText size={16} className={toneClass(card.tone)} />
                          {card.label}
                        </div>
                        {card.meta ? <span className={styles.messageTime}>{card.meta}</span> : null}
                      </div>
                      <div className={styles.messageBody}>
                        <p className={styles.messageBodyStrong}>{card.title}</p>
                        <p>{card.body}</p>
                      </div>
                    </article>
                  );
                }

                if (card.type === 'proposal') {
                  return (
                    <article key={card.id} className={styles.proposal}>
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
                <article className={`${styles.message} ${styles.typingMessage}`}>
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
                  onClose={() => setActiveAction(null)}
                  onReceipt={(card) => localChat.appendCards([card])}
                />
              ) : null}
            </div>

            <form className={styles.heroComposer} onSubmit={handleCommandSubmit}>
              <div className={styles.dialogueFocus}>
                <div className={styles.dialogueGlyph}>#{companion.tokenNumber}</div>
                <div className={styles.dialogueCopy}>
                  <span>和它说一句话</span>
                  <strong>聊天，或直接说你想做什么。</strong>
                </div>
              </div>

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

              <div className={styles.composerInputRow}>
                <input
                  className={styles.composerInput}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="例如：去挖矿 / 打一场 PK / 看大逃杀 / 开代理"
                  disabled={isSending}
                />
                <button type="submit" className={styles.commandButton} disabled={isSending}>
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

          {drawerOpen ? <div className={styles.drawerOverlay} onClick={() => setDrawerOpen(false)} /> : null}

          <aside className={`${styles.drawer} ${drawerOpen ? styles.drawerOpen : ''}`}>
            <div className={styles.drawerSection}>
              <div className={styles.cardHead}>
                <div className={styles.cardLabel}>
                  <CircleDot size={16} className={toneClass(companion.statusTone)} />
                  当前龙虾
                </div>
                <button type="button" className={`${styles.drawerToggle} ${styles.hiddenDesktop}`} onClick={() => setDrawerOpen(false)}>
                  <X size={16} />
                  关闭
                </button>
              </div>
              <div className={styles.compactStatusGrid}>
                <div className={styles.statusCard}>
                  <span>状态</span>
                  <strong className={toneClass(companion.statusTone)}>{companion.statusLabel}</strong>
                </div>
                <div className={styles.statusCard}>
                  <span>储备</span>
                  <strong className={styles.warm}>{companion.routerClaworldText}</strong>
                </div>
                <div className={styles.statusCard}>
                  <span>维护</span>
                  <strong>{companion.dailyCostText}</strong>
                </div>
                <div className={styles.statusCard}>
                  <span>续航</span>
                  <strong className={toneClass(companion.statusTone)}>
                    {companion.upkeepDays === null ? 'n/a' : `${companion.upkeepDays} 天`}
                  </strong>
                </div>
              </div>
            </div>

            <details className={styles.drawerDetails}>
              <summary>世界</summary>
              <div className={styles.compactStatusGrid}>
                <div className={styles.statusCard}>
                  <span>大逃杀</span>
                  <strong>{terminalWorld.summary?.battleRoyale?.matchId ? `#${terminalWorld.summary.battleRoyale.matchId}` : '--'}</strong>
                </div>
                <div className={styles.statusCard}>
                  <span>人数</span>
                  <strong>
                    {terminalWorld.summary?.battleRoyale
                      ? `${terminalWorld.summary.battleRoyale.players}/${terminalWorld.summary.battleRoyale.triggerCount || 10}`
                      : '--'}
                  </strong>
                </div>
                <div className={styles.statusCard}>
                  <span>状态</span>
                  <strong className={terminalWorld.summary?.battleRoyale?.status === 'pending_reveal' ? styles.alert : styles.cool}>
                    {terminalWorld.summary?.battleRoyale?.status === 'open'
                      ? '开放'
                      : terminalWorld.summary?.battleRoyale?.status === 'pending_reveal'
                        ? '待揭示'
                        : terminalWorld.summary?.battleRoyale?.status === 'settled'
                          ? '已结算'
                          : '--'}
                  </strong>
                </div>
                <div className={styles.statusCard}>
                  <span>奖池</span>
                  <strong className={styles.warm}>
                    {terminalWorld.summary?.battleRoyale ? formatCLW(BigInt(terminalWorld.summary.battleRoyale.potCLW)) : '--'}
                  </strong>
                </div>
              </div>
            </details>

            <details className={styles.drawerDetails}>
              <summary>记忆</summary>
              <div className={styles.miniList}>
                <div className={styles.miniItem}>
                  <strong>{terminalMemory.summary ? '已加载' : '暂无摘要'}</strong>
                  <p>{terminalMemory.summary?.identity ?? terminalNfas.detail?.memorySummary ?? terminalMemory.error ?? '可以先聊天，新的记忆会在后端写回链路接通后进入这里。'}</p>
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
              <summary>代理结果</summary>
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
          </aside>
        </div>
      </div>
    </div>
  );
}
