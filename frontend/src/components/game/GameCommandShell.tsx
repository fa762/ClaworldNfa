'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatEther } from 'viem';

import { eventBus } from '@/game/EventBus';
import { loadMarketListing, loadMarketListings, loadMatch, loadRecentMatches, type MarketListing, type NFASummary, type PKMatch } from '@/game/chain/wallet';
import { buildLobsterIdentity } from '@/lib/lobsterIdentity';
import { getLobsterName } from '@/lib/mockData';
import { getRarityName } from '@/lib/rarity';
import { getShelterName } from '@/lib/shelter';

type Lang = 'zh' | 'en';
type GameStatus =
  | 'loading'
  | 'ready'
  | 'connected'
  | 'booting'
  | 'no-nfa'
  | 'select-nfa'
  | 'loading-nfa'
  | 'playing'
  | 'error';

type PendingTx = { hash: `0x${string}`; label: string } | null;
type WalletOption = { id: string; name: string };
type CommandTone = 'input' | 'system' | 'ok' | 'warn' | 'error';

type CommandEntry = {
  id: number;
  tone: CommandTone;
  text: string;
};

type GameCommandShellProps = {
  floating?: boolean;
  lang: Lang;
  status: GameStatus;
  isConnected: boolean;
  address?: string;
  bootProgress: number;
  walletOptions: WalletOption[];
  selectedConnectorId: string | null;
  nfaList: number[];
  nfaSummaries: Record<number, NFASummary>;
  activeNfaId: number | null;
  activeSummary?: NFASummary;
  pendingTx: PendingTx;
  onConnectWallet: (query?: string) => boolean;
  onSync: () => void;
  onSelectNfa: (nfaId: number) => void;
  onToggleMenu: () => void;
  onOpenHelp: () => void;
  onOpenHome: () => void;
  onOpenMint: () => void;
  onOpenNfa: () => void;
  onOpenOpenClaw: () => void;
  onToggleLang: () => void;
};

const SCENE_LABELS: Record<string, string> = {
  shelter: 'Shelter',
  task: 'Task Terminal',
  pk: 'Arena',
  market: 'Market Wall',
  archive: 'Dossier',
};

const STATUS_COPY: Record<GameStatus, string> = {
  loading: 'Initializing engine.',
  ready: 'Shell online. Connect wallet and run /sync.',
  connected: 'Wallet linked. Run /sync to fetch your NFAs.',
  booting: 'Syncing on-chain state and inventory.',
  'no-nfa': 'No NFA found for this wallet. Mint first.',
  'select-nfa': 'Sync complete. Run /list or /enter <id>.',
  'loading-nfa': 'Reading NFA state and opening shelter session.',
  playing: 'Shelter linked. Try /task /pk /market /listings /my-matches.',
  error: 'Session error. Reload recommended.',
};

const HELP_LINES = [
  '/help show command list',
  '/connect [wallet] connect wallet',
  '/sync fetch on-chain state',
  '/list list wallet NFAs',
  '/enter <id> enter selected NFA',
  '/status show current session state',
  '/listings show active market listings',
  '/my-listings show your active market listings',
  '/listing <id> inspect a specific market listing',
  '/matches show recent active PK matches',
  '/my-matches show active matches for current NFA',
  '/match <id> inspect a specific PK match',
  '/task /pk /market /archive open a terminal',
  '/portal <0-7> switch shelter',
  '/menu /helpui /openclaw /home /nfa /mint /lang /clear',
];

function shortenAddress(address?: string) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatStake(stake: bigint) {
  return Number(formatEther(stake)).toFixed(2);
}

function formatBnb(value: bigint) {
  return Number(formatEther(value)).toFixed(3);
}

function formatMatchLine(match: PKMatch) {
  const phaseName = match.phase <= 3
    ? ['OPEN', 'JOINED', 'COMMITTED', 'REVEALED'][match.phase]
    : match.phase === 4
      ? 'SETTLED'
      : 'CANCELLED';
  return `#${match.matchId} | ${phaseName} | NFA ${match.nfaA} vs ${match.nfaB || '-'} | stake ${formatStake(match.stake)}`;
}

function formatListingLine(listing: MarketListing) {
  const typeName = ['FIXED', 'AUCTION', 'SWAP'][listing.listingType] ?? `TYPE-${listing.listingType}`;
  const statusName = ['ACTIVE', 'SOLD', 'CANCELLED'][listing.status] ?? `STATUS-${listing.status}`;
  const valueText = listing.listingType === 2
    ? `swap for #${listing.swapTargetId}`
    : listing.listingType === 1 && listing.highestBid > 0n
      ? `bid ${formatBnb(listing.highestBid)} BNB`
      : `price ${formatBnb(listing.price)} BNB`;
  return `#${listing.listingId} | ${statusName} | NFA ${listing.nfaId} | ${typeName} | ${valueText}`;
}

function getCommandColor(tone: CommandTone) {
  switch (tone) {
    case 'input':
      return 'text-crt-bright';
    case 'ok':
      return 'text-crt-green';
    case 'warn':
      return 'term-warn';
    case 'error':
      return 'text-red-300';
    default:
      return 'text-crt-green/70';
  }
}

function getCommandPrefix(tone: CommandTone) {
  switch (tone) {
    case 'input':
      return '>';
    case 'ok':
      return '+';
    case 'warn':
      return '!';
    case 'error':
      return 'x';
    default:
      return '*';
  }
}

export function GameCommandShell({
  floating = false,
  lang,
  status,
  isConnected,
  address,
  bootProgress,
  walletOptions,
  selectedConnectorId,
  nfaList,
  nfaSummaries,
  activeNfaId,
  activeSummary,
  pendingTx,
  onConnectWallet,
  onSync,
  onSelectNfa,
  onToggleMenu,
  onOpenHelp,
  onOpenHome,
  onOpenMint,
  onOpenNfa,
  onOpenOpenClaw,
  onToggleLang,
}: GameCommandShellProps) {
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<CommandEntry[]>([]);
  const [sceneKey, setSceneKey] = useState<string | null>(null);
  const nextIdRef = useRef(1);
  const statusRef = useRef<GameStatus | null>(null);
  const activeNfaRef = useRef<number | null>(null);
  const pendingHashRef = useRef<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const appendEntry = useCallback((tone: CommandTone, text: string) => {
    setHistory((current) => {
      const next = [...current, { id: nextIdRef.current++, tone, text }];
      return next.slice(-100);
    });
  }, []);

  useEffect(() => {
    appendEntry('system', STATUS_COPY.loading);
    appendEntry('system', 'Type /help to inspect available commands.');
  }, [appendEntry]);

  useEffect(() => {
    if (statusRef.current === status) {
      return;
    }
    statusRef.current = status;
    appendEntry('system', STATUS_COPY[status]);
  }, [appendEntry, status]);

  useEffect(() => {
    if (!activeNfaId || activeNfaRef.current === activeNfaId) {
      return;
    }
    activeNfaRef.current = activeNfaId;
    appendEntry('ok', `NFA #${activeNfaId} locked into session.`);
  }, [activeNfaId, appendEntry]);

  useEffect(() => {
    if (!pendingTx || pendingHashRef.current === pendingTx.hash) {
      return;
    }
    pendingHashRef.current = pendingTx.hash;
    appendEntry('warn', `${pendingTx.label} ${pendingTx.hash.slice(0, 12)}...`);
  }, [appendEntry, pendingTx]);

  useEffect(() => {
    const unsubscribeScene = eventBus.on('game:scene', (payload: unknown) => {
      const nextScene = (payload as { scene?: string }).scene ?? null;
      if (!nextScene) return;
      setSceneKey(nextScene);
      appendEntry('system', `Switched terminal context to ${SCENE_LABELS[nextScene] ?? nextScene.toUpperCase()}.`);
    });

    const unsubscribeTask = eventBus.on('task:result', (payload: unknown) => {
      const result = payload as { status: 'pending' | 'confirmed' | 'failed'; error?: string; actualClw?: string };
      if (result.status === 'confirmed') {
        appendEntry('ok', result.actualClw
          ? `Task settled. Reward ${Number(result.actualClw).toFixed(2)} Claworld.`
          : 'Task settled.');
      } else if (result.status === 'failed') {
        appendEntry('error', result.error ?? 'Task failed.');
      }
    });

    const unsubscribePk = eventBus.on('pk:result', (payload: unknown) => {
      const result = payload as {
        status: 'pending' | 'confirmed' | 'failed';
        action?: string;
        error?: string;
        matchId?: number;
        winnerNfaId?: number;
        reward?: string;
      };
      if (result.status === 'confirmed') {
        if (result.action === 'settle' && result.winnerNfaId && result.reward) {
          appendEntry('ok', `PK settled. Winner NFA #${result.winnerNfaId}. Reward ${result.reward} Claworld.`);
        } else {
          appendEntry('ok', `PK action ${result.action ?? 'unknown'} confirmed${result.matchId ? ` #${result.matchId}` : ''}.`);
        }
      } else if (result.status === 'failed') {
        appendEntry('error', result.error ?? 'PK failed.');
      }
    });

    const unsubscribeMarket = eventBus.on('market:result', (payload: unknown) => {
      const result = payload as { status: 'pending' | 'confirmed' | 'failed'; action?: string; error?: string; listingId?: number };
      if (result.status === 'confirmed') {
        appendEntry('ok', `Market action ${result.action ?? 'unknown'} confirmed${result.listingId ? ` #${result.listingId}` : ''}.`);
      } else if (result.status === 'failed') {
        appendEntry('error', result.error ?? 'Market action failed.');
      }
    });

    return () => {
      unsubscribeScene();
      unsubscribeTask();
      unsubscribePk();
      unsubscribeMarket();
    };
  }, [appendEntry]);

  useEffect(() => {
    if (!logRef.current) return;
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [history]);

  const quickCommands = useMemo(() => {
    if (!isConnected) {
      return ['/connect', '/sync', '/help'];
    }
    if (status === 'no-nfa') {
      return ['/mint', '/sync', '/help'];
    }
    if (status === 'select-nfa') {
      return ['/list', '/enter', '/status'];
    }
    if (status === 'playing') {
      return ['/task', '/pk', '/market', '/listings', '/my-matches', '/archive'];
    }
    return ['/sync', '/status', '/help'];
  }, [isConnected, status]);

  const executeCommand = useCallback(async (rawCommand: string) => {
    const trimmed = rawCommand.trim();
    if (!trimmed) return;

    appendEntry('input', trimmed);

    const normalized = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
    const [name, ...args] = normalized.split(/\s+/);
    const commandName = name.toLowerCase();

    switch (commandName) {
      case 'help': {
        HELP_LINES.forEach((line) => appendEntry('system', line));
        return;
      }
      case 'clear': {
        setHistory([]);
        return;
      }
      case 'connect': {
        if (isConnected) {
          appendEntry('warn', 'Wallet already connected.');
          return;
        }
        const connected = onConnectWallet(args.join(' '));
        appendEntry(connected ? 'ok' : 'error', connected
          ? 'Wallet connection requested.'
          : 'No matching wallet connector found.');
        return;
      }
      case 'sync': {
        if (!isConnected) {
          appendEntry('error', 'Connect wallet first.');
          return;
        }
        onSync();
        appendEntry('system', 'Syncing on-chain state.');
        return;
      }
      case 'list': {
        if (!nfaList.length) {
          appendEntry('warn', 'No NFA found for this wallet.');
          return;
        }
        nfaList.forEach((id) => {
          const summary = nfaSummaries[id];
          if (!summary) {
            appendEntry('system', `NFA #${id}`);
            return;
          }
          appendEntry(
            'system',
            `NFA #${id} | Lv.${summary.level} | ${getRarityName(summary.rarity, lang === 'zh')} | ${summary.clwBalance.toFixed(0)} Claworld`
          );
        });
        return;
      }
      case 'enter':
      case 'switch': {
        const nfaId = Number(args[0]);
        if (!Number.isInteger(nfaId) || nfaId <= 0) {
          appendEntry('error', 'Usage: /enter <id>');
          return;
        }
        if (!nfaList.includes(nfaId)) {
          appendEntry('error', `Wallet does not own NFA #${nfaId}.`);
          return;
        }
        onSelectNfa(nfaId);
        appendEntry('ok', `Connecting NFA #${nfaId}.`);
        return;
      }
      case 'status': {
        appendEntry('system', `wallet: ${isConnected ? shortenAddress(address) : 'disconnected'}`);
        appendEntry('system', `session: ${sceneKey ? (SCENE_LABELS[sceneKey] ?? sceneKey) : status}`);
        if (activeSummary) {
          appendEntry(
            'system',
            `NFA #${activeSummary.tokenId} | Lv.${activeSummary.level} | ${getShelterName(activeSummary.shelter)} | ${activeSummary.clwBalance.toFixed(0)} Claworld`
          );
        }
        if (pendingTx) {
          appendEntry('warn', `${pendingTx.label} ${pendingTx.hash.slice(0, 12)}...`);
        }
        return;
      }
      case 'listings': {
        const listings = await loadMarketListings();
        if (!listings.length) {
          appendEntry('warn', 'No active market listings.');
          return;
        }
        eventBus.emit('game:command', { name: 'listings', args: [] });
        listings.slice(0, 8).forEach((listing) => appendEntry('system', formatListingLine(listing)));
        return;
      }
      case 'my-listings': {
        if (!address) {
          appendEntry('error', 'Connect wallet first.');
          return;
        }
        const listings = (await loadMarketListings()).filter((listing) => listing.seller.toLowerCase() === address.toLowerCase());
        if (!listings.length) {
          appendEntry('warn', `Wallet ${shortenAddress(address)} has no active listings.`);
          return;
        }
        eventBus.emit('game:command', { name: 'my-listings', args: [] });
        listings.forEach((listing) => appendEntry('system', formatListingLine(listing)));
        return;
      }
      case 'listing': {
        const listingId = Number(args[0]);
        if (!Number.isInteger(listingId) || listingId <= 0) {
          appendEntry('error', 'Usage: /listing <id>');
          return;
        }
        const listing = await loadMarketListing(listingId);
        if (!listing) {
          appendEntry('error', `Listing #${listingId} not found.`);
          return;
        }
        eventBus.emit('game:command', { name: 'listing', args: [String(listingId)] });
        appendEntry('system', formatListingLine(listing));
        appendEntry('system', `seller ${shortenAddress(listing.seller)} | rarity ${listing.rarity} | highest bid ${formatBnb(listing.highestBid)} BNB`);
        return;
      }
      case 'matches': {
        const matches = await loadRecentMatches();
        if (!matches.length) {
          appendEntry('warn', 'No active recent PK matches.');
          return;
        }
        eventBus.emit('game:command', { name: 'matches', args: [] });
        matches.slice(0, 8).forEach((match) => appendEntry('system', formatMatchLine(match)));
        return;
      }
      case 'my-matches': {
        if (!activeNfaId) {
          appendEntry('error', 'Enter an NFA first.');
          return;
        }
        const matches = (await loadRecentMatches()).filter((match) => match.nfaA === activeNfaId || match.nfaB === activeNfaId);
        if (!matches.length) {
          appendEntry('warn', `NFA #${activeNfaId} has no active matches.`);
          return;
        }
        eventBus.emit('game:command', { name: 'my-matches', args: [] });
        matches.forEach((match) => appendEntry('system', formatMatchLine(match)));
        return;
      }
      case 'match': {
        const matchId = Number(args[0]);
        if (!Number.isInteger(matchId) || matchId <= 0) {
          appendEntry('error', 'Usage: /match <id>');
          return;
        }
        const match = await loadMatch(matchId);
        if (!match) {
          appendEntry('error', `Match #${matchId} not found.`);
          return;
        }
        eventBus.emit('game:command', { name: 'match', args: [String(matchId)] });
        appendEntry('system', formatMatchLine(match));
        appendEntry('system', `Reveal state A:${match.revealedA ? 'YES' : 'NO'} B:${match.revealedB ? 'YES' : 'NO'}`);
        return;
      }
      case 'menu': {
        onToggleMenu();
        appendEntry('ok', 'System menu toggled.');
        return;
      }
      case 'helpui': {
        onOpenHelp();
        appendEntry('ok', 'Help panel opened.');
        return;
      }
      case 'openclaw': {
        onOpenOpenClaw();
        appendEntry('ok', 'OpenClaw entry opened.');
        return;
      }
      case 'home': {
        onOpenHome();
        return;
      }
      case 'mint': {
        onOpenMint();
        return;
      }
      case 'nfa': {
        onOpenNfa();
        return;
      }
      case 'lang': {
        onToggleLang();
        appendEntry('ok', `Language switch requested (${lang === 'zh' ? 'EN' : 'ZH'}).`);
        return;
      }
      case 'task':
      case 'pk':
      case 'market':
      case 'archive':
      case 'shelter': {
        if (!activeNfaId) {
          appendEntry('error', 'Enter an NFA first.');
          return;
        }
        eventBus.emit('game:command', { name: commandName, args });
        appendEntry('ok', `Dispatched ${trimmed}.`);
        return;
      }
      case 'portal': {
        if (!activeNfaId) {
          appendEntry('error', 'Enter an NFA first.');
          return;
        }
        const targetShelter = Number(args[0]);
        if (!Number.isInteger(targetShelter) || targetShelter < 0 || targetShelter > 7) {
          appendEntry('error', 'Usage: /portal <0-7>');
          return;
        }
        eventBus.emit('game:command', { name: 'portal', args: [String(targetShelter)] });
        appendEntry('ok', `Requested switch to SHELTER-0${targetShelter}.`);
        return;
      }
      default: {
        appendEntry('error', `Unknown command: ${trimmed}`);
      }
    }
  }, [
    activeNfaId,
    activeSummary,
    address,
    appendEntry,
    isConnected,
    lang,
    nfaList,
    nfaSummaries,
    onConnectWallet,
    onOpenHelp,
    onOpenHome,
    onOpenMint,
    onOpenNfa,
    onOpenOpenClaw,
    onSelectNfa,
    onSync,
    onToggleLang,
    onToggleMenu,
    pendingTx,
    sceneKey,
    status,
  ]);

  const shellClassName = floating
    ? 'pointer-events-auto absolute left-3 top-3 z-[35] w-[min(96vw,32rem)] max-h-[min(58vh,40rem)]'
    : 'w-full max-w-6xl';

  const mainShellClassName = floating
    ? 'grid gap-3 rounded border border-crt-green/25 bg-black/90 p-3 shadow-[0_0_30px_rgba(57,255,20,0.08)] md:grid-cols-[1.45fr,0.95fr]'
    : 'grid gap-4 rounded border border-crt-green/30 bg-black/85 p-4 shadow-[0_0_40px_rgba(57,255,20,0.08)] lg:grid-cols-[1.55fr,0.9fr]';

  const sceneLabel = sceneKey ? (SCENE_LABELS[sceneKey] ?? sceneKey) : (status === 'playing' ? 'ONLINE' : 'BOOT');
  const summaryIdentity = activeSummary ? buildLobsterIdentity(activeSummary, lang) : null;

  return (
    <section className={shellClassName}>
      <div className={mainShellClassName}>
        <div className="min-w-0">
          <div className="mb-3 flex items-start justify-between gap-3 border-b border-crt-green/15 pb-2">
            <div>
              <p className="text-[10px] tracking-[0.28em] text-crt-green/40">SHELTER CLI</p>
              <p className="text-xs text-crt-green/65">Command-driven shell aligned with OpenClaw-style flows</p>
            </div>
            <button onClick={onToggleLang} className="soft-key shrink-0 px-3 py-1 text-[10px]">
              {lang === 'zh' ? 'EN' : 'ZH'}
            </button>
          </div>

          <div
            ref={logRef}
            className={`${floating ? 'h-56 md:h-64' : 'h-[24rem] md:h-[30rem]'} overflow-y-auto rounded border border-crt-green/15 bg-black/70 p-3`}
          >
            <div className="space-y-1.5 text-xs">
              {history.length === 0 ? (
                <div className="text-crt-green/40">awaiting input...</div>
              ) : (
                history.map((entry) => (
                  <div key={entry.id} className={`flex gap-2 ${getCommandColor(entry.tone)}`}>
                    <span className="w-4 shrink-0 text-center text-crt-green/45">{getCommandPrefix(entry.tone)}</span>
                    <span className="min-w-0 break-words">{entry.text}</span>
                  </div>
                ))
              )}
              {status === 'booting' && (
                <div className="flex gap-2 text-crt-green/60">
                  <span className="w-4 shrink-0 text-center text-crt-green/45">*</span>
                  <span>sync progress {bootProgress}%</span>
                </div>
              )}
            </div>
          </div>

          <form
            className="mt-3"
            onSubmit={(event) => {
              event.preventDefault();
              void executeCommand(command);
              setCommand('');
            }}
          >
            <label className="mb-2 block text-[10px] uppercase tracking-[0.28em] text-crt-green/40">
              command
            </label>
            <div className="flex items-center gap-2 rounded border border-crt-green/20 bg-black/75 px-3 py-2">
              <span className="text-sm text-crt-green">&gt;</span>
              <input
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                placeholder="/help /sync /enter 1 /task"
                className="min-w-0 flex-1 bg-transparent text-sm text-crt-bright outline-none placeholder:text-crt-green/20"
              />
              <button type="submit" className="soft-key px-3 py-1 text-[10px]">
                RUN
              </button>
            </div>
          </form>

          <div className="mt-3 flex flex-wrap gap-2">
            {quickCommands.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  const value = item === '/enter' && nfaList[0] ? `/enter ${nfaList[0]}` : item;
                  void executeCommand(value);
                }}
                className="rounded border border-crt-green/20 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-crt-green/65 transition-colors hover:border-crt-green/50 hover:text-crt-bright"
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="min-w-0 space-y-3">
          <div className="term-box" data-title="SESSION">
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="text-crt-green/45">scene</span>
                <span className="text-crt-bright">{sceneLabel}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-crt-green/45">wallet</span>
                <span className="truncate text-crt-green/80">
                  {isConnected ? shortenAddress(address) : 'disconnected'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-crt-green/45">sync</span>
                <span className="text-crt-green/80">{status === 'booting' ? `${bootProgress}%` : status}</span>
              </div>
              {!!selectedConnectorId && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-crt-green/45">connector</span>
                  <span className="truncate text-crt-green/80">{selectedConnectorId}</span>
                </div>
              )}
              {pendingTx && (
                <div className="rounded border border-crt-green/15 bg-crt-green/5 p-2 text-[11px] text-crt-green/75">
                  <div>{pendingTx.label}</div>
                  <div className="text-crt-green/45">{pendingTx.hash.slice(0, 14)}...</div>
                </div>
              )}
            </div>
          </div>

          <div className="term-box" data-title="ACTIVE NFA">
            {activeSummary ? (
              <div className="space-y-2 text-xs text-crt-green/80">
                <div>
                  <div className="text-crt-bright">NFA #{activeSummary.tokenId} | {getLobsterName(activeSummary.tokenId)}</div>
                  {summaryIdentity && <div className="text-crt-green/45">{summaryIdentity.title}</div>}
                </div>
                <div>Lv.{activeSummary.level} | {getRarityName(activeSummary.rarity, lang === 'zh')}</div>
                <div>{getShelterName(activeSummary.shelter)}</div>
                <div>Claworld {activeSummary.clwBalance.toFixed(0)}</div>
                <div>{activeSummary.active ? 'ACTIVE' : 'DORMANT'}</div>
              </div>
            ) : (
              <div className="text-xs text-crt-green/35">none selected</div>
            )}
          </div>

          <div className="term-box" data-title="QUICK ACCESS">
            <div className="space-y-2 text-xs text-crt-green/75">
              <div className="flex flex-wrap gap-2">
                {walletOptions.map((wallet) => (
                  <button
                    key={wallet.id}
                    type="button"
                    onClick={() => void executeCommand(`/connect ${wallet.name}`)}
                    className="rounded border border-crt-green/15 px-2 py-1 text-[10px] text-crt-green/65 transition-colors hover:border-crt-green/50 hover:text-crt-bright"
                  >
                    {wallet.name}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => void executeCommand('/status')} className="term-link block text-left">
                /status
              </button>
              <button type="button" onClick={() => void executeCommand('/listings')} className="term-link block text-left">
                /listings
              </button>
              <button type="button" onClick={() => void executeCommand('/my-matches')} className="term-link block text-left">
                /my-matches
              </button>
              <button type="button" onClick={() => void executeCommand('/archive')} className="term-link block text-left">
                /archive
              </button>
              <button type="button" onClick={() => void executeCommand('/menu')} className="term-link block text-left">
                /menu
              </button>
              <button type="button" onClick={() => void executeCommand('/helpui')} className="term-link block text-left">
                /helpui
              </button>
              <button type="button" onClick={() => void executeCommand('/openclaw')} className="term-link block text-left">
                /openclaw
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
