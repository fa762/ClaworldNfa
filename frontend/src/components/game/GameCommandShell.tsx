'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatEther } from 'viem';

import { eventBus } from '@/game/EventBus';
import {
  loadMarketListing,
  loadMarketListings,
  loadMatch,
  loadRecentMatches,
  type MarketListing,
  type NFASummary,
  type PKMatch,
} from '@/game/chain/wallet';
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
type Tone = 'system' | 'ok' | 'warn' | 'error';

type LogEntry = {
  id: number;
  tone: Tone;
  text: string;
};

type Props = {
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

const actionButtonClass =
  'rounded border border-crt-green/20 bg-black/70 px-3 py-2 text-left text-xs text-crt-green/75 transition-colors hover:border-crt-green/60 hover:bg-crt-green/5 hover:text-crt-bright disabled:cursor-not-allowed disabled:opacity-35';
const inputClass =
  'w-full rounded border border-crt-green/20 bg-black/75 px-3 py-2 text-xs text-crt-bright outline-none placeholder:text-crt-green/25';

function shortenAddress(address?: string) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function connectorName(name: string, zh: boolean) {
  return name === 'Injected' ? (zh ? '浏览器钱包' : 'Browser Wallet') : name;
}

function toneClass(tone: Tone) {
  if (tone === 'ok') return 'text-crt-bright';
  if (tone === 'warn') return 'term-warn';
  if (tone === 'error') return 'text-red-300';
  return 'text-crt-green/70';
}

function txLabel(label: string, zh: boolean) {
  const labels: Record<string, string> = {
    'PROCESSING UPKEEP': zh ? '结算日常维护' : 'Processing upkeep',
    'SUBMITTING TASK': zh ? '提交任务' : 'Submitting task',
    'CREATING PK MATCH': zh ? '创建 PK 对局' : 'Creating PK match',
    'JOINING PK MATCH': zh ? '加入 PK 对局' : 'Joining PK match',
    'REVEALING STRATEGY': zh ? '揭示策略' : 'Revealing strategy',
    'SETTLING PK MATCH': zh ? '结算 PK 对局' : 'Settling PK match',
    'CANCELLING PK MATCH': zh ? '取消 PK 对局' : 'Cancelling PK match',
    'BUYING NFA': zh ? '购买 NFA' : 'Buying NFA',
    'PLACING BID': zh ? '提交出价' : 'Placing bid',
    'SETTLING AUCTION': zh ? '结算拍卖' : 'Settling auction',
    'CANCELLING LISTING': zh ? '取消挂单' : 'Cancelling listing',
    'APPROVING SWAP NFA': zh ? '授权互换 NFA' : 'Approving swap NFA',
    'ACCEPTING SWAP': zh ? '接受互换' : 'Accepting swap',
    'APPROVING NFA': zh ? '授权 NFA' : 'Approving NFA',
    'LISTING SWAP': zh ? '创建互换挂单' : 'Creating swap listing',
    'CREATING AUCTION': zh ? '创建拍卖挂单' : 'Creating auction',
    'LISTING NFA': zh ? '创建固定价挂单' : 'Listing NFA',
  };
  return labels[label] ?? label;
}

function statusText(status: GameStatus, zh: boolean) {
  const map: Record<GameStatus, string> = {
    loading: zh ? '正在初始化游戏画布。' : 'Initializing game canvas.',
    ready: zh ? '控制台已就绪，先连接钱包。' : 'Console ready. Connect wallet first.',
    connected: zh ? '钱包已连接，点击同步读取链上数据。' : 'Wallet linked. Click sync to read chain data.',
    booting: zh ? '正在同步链上状态与 NFA 清单。' : 'Syncing on-chain state and NFAs.',
    'no-nfa': zh ? '当前钱包没有 NFA，需先铸造。' : 'No NFA found for this wallet.',
    'select-nfa': zh ? '同步完成，请选择一只龙虾进入避难所。' : 'Sync complete. Select a lobster to enter.',
    'loading-nfa': zh ? '正在读取龙虾状态并进入场景。' : 'Reading lobster state and entering scene.',
    playing: zh ? '已进入游戏，可直接切换任务、PK、市场和档案。' : 'In session. Use buttons to switch systems.',
    error: zh ? '会话加载失败，建议刷新重试。' : 'Session failed to load. Refresh recommended.',
  };
  return map[status];
}

function sceneLabel(scene: string | null, status: GameStatus, zh: boolean) {
  const map: Record<string, string> = {
    ready: zh ? '大厅' : 'Lobby',
    shelter: zh ? '避难所' : 'Shelter',
    task: zh ? '任务终端' : 'Task',
    pk: zh ? '竞技场' : 'Arena',
    market: zh ? '交易墙' : 'Market',
    archive: zh ? '档案室' : 'Archive',
  };
  if (scene) return map[scene] ?? scene;
  return status === 'playing' ? map.shelter : map.ready;
}

function formatMatchLine(match: PKMatch, zh: boolean) {
  const phaseName = match.phase <= 3
    ? ['OPEN', 'JOINED', 'COMMITTED', 'REVEALED'][match.phase]
    : match.phase === 4
      ? 'SETTLED'
      : 'CANCELLED';
  return zh
    ? `对局 #${match.matchId} | ${phaseName} | NFA ${match.nfaA} vs ${match.nfaB || '-'} | 赌注 ${Number(formatEther(match.stake)).toFixed(2)} Claworld`
    : `#${match.matchId} | ${phaseName} | NFA ${match.nfaA} vs ${match.nfaB || '-'} | stake ${Number(formatEther(match.stake)).toFixed(2)} Claworld`;
}

function formatListingLine(listing: MarketListing, zh: boolean) {
  const typeName = ['FIXED', 'AUCTION', 'SWAP'][listing.listingType] ?? `TYPE-${listing.listingType}`;
  const statusName = ['ACTIVE', 'SOLD', 'CANCELLED'][listing.status] ?? `STATUS-${listing.status}`;
  const valueText = listing.listingType === 2
    ? (zh ? `互换 #${listing.swapTargetId}` : `swap for #${listing.swapTargetId}`)
    : listing.listingType === 1 && listing.highestBid > 0n
      ? (zh ? `出价 ${Number(formatEther(listing.highestBid)).toFixed(3)} BNB` : `bid ${Number(formatEther(listing.highestBid)).toFixed(3)} BNB`)
      : (zh ? `价格 ${Number(formatEther(listing.price)).toFixed(3)} BNB` : `price ${Number(formatEther(listing.price)).toFixed(3)} BNB`);
  return zh
    ? `挂单 #${listing.listingId} | ${statusName} | NFA ${listing.nfaId} | ${typeName} | ${valueText}`
    : `#${listing.listingId} | ${statusName} | NFA ${listing.nfaId} | ${typeName} | ${valueText}`;
}

export function GameCommandShell({
  floating: _floating = false,
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
}: Props) {
  const zh = lang === 'zh';
  const [history, setHistory] = useState<LogEntry[]>([]);
  const [scene, setScene] = useState<string | null>(null);
  const [matchId, setMatchId] = useState('');
  const [listingId, setListingId] = useState('');
  const [portalId, setPortalId] = useState('');
  const nextIdRef = useRef(1);
  const initializedRef = useRef(false);
  const lastStatusRef = useRef<GameStatus | null>(null);
  const lastNfaRef = useRef<number | null>(null);
  const lastTxHashRef = useRef<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const pushLog = useCallback((tone: Tone, text: string) => {
    setHistory((current) => [...current, { id: nextIdRef.current++, tone, text }].slice(-60));
  }, []);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    pushLog('system', zh ? '控制台已接入，点击按钮即可执行。' : 'Console linked. Use buttons to trigger actions.');
  }, [pushLog, zh]);

  useEffect(() => {
    if (lastStatusRef.current === status) return;
    lastStatusRef.current = status;
    pushLog('system', statusText(status, zh));
  }, [pushLog, status, zh]);

  useEffect(() => {
    if (!activeNfaId || lastNfaRef.current === activeNfaId) return;
    lastNfaRef.current = activeNfaId;
    pushLog('ok', zh ? `已锁定 NFA #${activeNfaId}` : `Locked NFA #${activeNfaId}`);
  }, [activeNfaId, pushLog, zh]);

  useEffect(() => {
    if (!pendingTx || lastTxHashRef.current === pendingTx.hash) return;
    lastTxHashRef.current = pendingTx.hash;
    pushLog('warn', `${txLabel(pendingTx.label, zh)} ${pendingTx.hash.slice(0, 12)}...`);
  }, [pendingTx, pushLog, zh]);

  useEffect(() => {
    const offScene = eventBus.on('game:scene', (payload: unknown) => {
      const nextScene = (payload as { scene?: string }).scene ?? null;
      if (!nextScene) return;
      setScene(nextScene);
      pushLog('system', zh ? `已切换到${sceneLabel(nextScene, status, zh)}` : `Switched to ${sceneLabel(nextScene, status, zh)}`);
    });
    const offTask = eventBus.on('task:result', (payload: unknown) => {
      const result = payload as { status: 'pending' | 'confirmed' | 'failed'; error?: string; actualClw?: string };
      if (result.status === 'confirmed') {
        pushLog('ok', result.actualClw
          ? (zh ? `任务结算完成，奖励 ${Number(result.actualClw).toFixed(2)} Claworld` : `Task settled. Reward ${Number(result.actualClw).toFixed(2)} Claworld`)
          : (zh ? '任务结算完成' : 'Task settled'));
      } else if (result.status === 'failed') {
        pushLog('error', result.error ?? (zh ? '任务失败' : 'Task failed'));
      }
    });
    const offPk = eventBus.on('pk:result', (payload: unknown) => {
      const result = payload as { status: 'pending' | 'confirmed' | 'failed'; error?: string; matchId?: number; winnerNfaId?: number; reward?: string; action?: string };
      if (result.status === 'confirmed') {
        if (result.action === 'settle' && result.winnerNfaId && result.reward) {
          pushLog('ok', zh ? `PK 结算完成，胜者 NFA #${result.winnerNfaId}，奖励 ${result.reward} Claworld` : `PK settled. Winner NFA #${result.winnerNfaId}. Reward ${result.reward} Claworld`);
        } else {
          pushLog('ok', zh ? `PK 操作已确认${result.matchId ? ` #${result.matchId}` : ''}` : `PK action confirmed${result.matchId ? ` #${result.matchId}` : ''}`);
        }
      } else if (result.status === 'failed') {
        pushLog('error', result.error ?? (zh ? 'PK 失败' : 'PK failed'));
      }
    });
    const offMarket = eventBus.on('market:result', (payload: unknown) => {
      const result = payload as { status: 'pending' | 'confirmed' | 'failed'; error?: string; listingId?: number };
      if (result.status === 'confirmed') {
        pushLog('ok', zh ? `市场操作已确认${result.listingId ? ` #${result.listingId}` : ''}` : `Market action confirmed${result.listingId ? ` #${result.listingId}` : ''}`);
      } else if (result.status === 'failed') {
        pushLog('error', result.error ?? (zh ? '市场操作失败' : 'Market action failed'));
      }
    });
    return () => {
      offScene();
      offTask();
      offPk();
      offMarket();
    };
  }, [pushLog, status, zh]);

  useEffect(() => {
    if (!logRef.current) return;
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [history]);

  const runAction = useCallback(async (action: string, value?: string) => {
    if (action === 'sync') {
      if (!isConnected) return pushLog('error', zh ? '请先连接钱包。' : 'Connect wallet first.');
      onSync();
      return pushLog('system', zh ? '开始同步链上数据。' : 'Syncing on-chain data.');
    }

    if (action === 'connect') {
      if (isConnected) return pushLog('warn', zh ? '钱包已连接。' : 'Wallet already connected.');
      const connected = onConnectWallet(value);
      return pushLog(connected ? 'ok' : 'error', connected ? (zh ? '已发起钱包连接请求。' : 'Wallet connection requested.') : (zh ? '没有匹配到可用钱包。' : 'No matching wallet connector found.'));
    }

    if (action === 'select') {
      const nfaId = Number(value);
      if (!Number.isInteger(nfaId) || nfaId <= 0) return pushLog('error', zh ? '请先选择有效 NFA。' : 'Select a valid NFA.');
      onSelectNfa(nfaId);
      return pushLog('ok', `NFA #${nfaId}`);
    }

    if (action === 'scene') {
      if (!activeNfaId) return pushLog('error', zh ? '请先选择一只龙虾。' : 'Select an NFA first.');
      eventBus.emit('game:command', { name: value, args: [] });
      return pushLog('ok', sceneLabel(value ?? null, status, zh));
    }

    if (action === 'matches') {
      const matches = await loadRecentMatches();
      if (!matches.length) return pushLog('warn', zh ? '当前没有活跃对局。' : 'No active matches.');
      eventBus.emit('game:command', { name: 'matches', args: [] });
      matches.slice(0, 8).forEach((match) => pushLog('system', formatMatchLine(match, zh)));
      return;
    }

    if (action === 'my-matches') {
      if (!activeNfaId) return pushLog('error', zh ? '请先选择一只龙虾。' : 'Select an NFA first.');
      const matches = (await loadRecentMatches()).filter((match) => match.nfaA === activeNfaId || match.nfaB === activeNfaId);
      if (!matches.length) return pushLog('warn', zh ? '当前龙虾暂无活跃对局。' : 'This NFA has no active matches.');
      eventBus.emit('game:command', { name: 'my-matches', args: [] });
      matches.forEach((match) => pushLog('system', formatMatchLine(match, zh)));
      return;
    }

    if (action === 'match') {
      const target = Number(value ?? matchId);
      if (!Number.isInteger(target) || target <= 0) return pushLog('error', zh ? '请输入有效的对局 ID。' : 'Enter a valid match id.');
      const match = await loadMatch(target);
      if (!match) return pushLog('error', zh ? '未找到该对局。' : 'Match not found.');
      eventBus.emit('game:command', { name: 'match', args: [String(target)] });
      pushLog('system', formatMatchLine(match, zh));
      pushLog('system', zh ? `揭示状态 A:${match.revealedA ? '是' : '否'} B:${match.revealedB ? '是' : '否'}` : `Reveal A:${match.revealedA ? 'YES' : 'NO'} B:${match.revealedB ? 'YES' : 'NO'}`);
      return;
    }

    if (action === 'listings') {
      const listings = await loadMarketListings();
      if (!listings.length) return pushLog('warn', zh ? '当前没有有效挂单。' : 'No active listings.');
      eventBus.emit('game:command', { name: 'listings', args: [] });
      listings.slice(0, 8).forEach((listing) => pushLog('system', formatListingLine(listing, zh)));
      return;
    }

    if (action === 'my-listings') {
      if (!address) return pushLog('error', zh ? '请先连接钱包。' : 'Connect wallet first.');
      const listings = (await loadMarketListings()).filter((listing) => listing.seller.toLowerCase() === address.toLowerCase());
      if (!listings.length) return pushLog('warn', zh ? '当前钱包没有挂单。' : 'This wallet has no active listings.');
      eventBus.emit('game:command', { name: 'my-listings', args: [] });
      listings.forEach((listing) => pushLog('system', formatListingLine(listing, zh)));
      return;
    }

    if (action === 'listing') {
      const target = Number(value ?? listingId);
      if (!Number.isInteger(target) || target <= 0) return pushLog('error', zh ? '请输入有效的挂单 ID。' : 'Enter a valid listing id.');
      const listing = await loadMarketListing(target);
      if (!listing) return pushLog('error', zh ? '未找到该挂单。' : 'Listing not found.');
      eventBus.emit('game:command', { name: 'listing', args: [String(target)] });
      pushLog('system', formatListingLine(listing, zh));
      pushLog('system', `${zh ? '卖家' : 'Seller'} ${shortenAddress(listing.seller)} | ${zh ? '最高出价' : 'Highest bid'} ${Number(formatEther(listing.highestBid)).toFixed(3)} BNB`);
      return;
    }

    if (action === 'portal') {
      if (!activeNfaId) return pushLog('error', zh ? '请先选择一只龙虾。' : 'Select an NFA first.');
      const shelter = Number(value ?? portalId);
      if (!Number.isInteger(shelter) || shelter < 0 || shelter > 7) return pushLog('error', zh ? '避难所编号需在 0 到 7 之间。' : 'Shelter id must be between 0 and 7.');
      eventBus.emit('game:command', { name: 'portal', args: [String(shelter)] });
      return pushLog('ok', zh ? `已发送 SHELTER-0${shelter} 切换请求` : `Requested SHELTER-0${shelter}`);
    }

    if (action === 'help') {
      onOpenHelp();
      return pushLog('ok', zh ? '已打开帮助面板。' : 'Help panel opened.');
    }

    if (action === 'openclaw') {
      onOpenOpenClaw();
      return pushLog('ok', zh ? '已打开 OpenClaw 入口。' : 'OpenClaw opened.');
    }

    if (action === 'home') return onOpenHome();
    if (action === 'mint') return onOpenMint();
    if (action === 'nfa') return onOpenNfa();
    if (action === 'lang') {
      onToggleLang();
      return pushLog('ok', zh ? '已切换界面语言。' : 'Language switched.');
    }
    if (action === 'clear') return setHistory([]);
  }, [
    activeNfaId,
    address,
    isConnected,
    listingId,
    matchId,
    onConnectWallet,
    onOpenHelp,
    onOpenHome,
    onOpenMint,
    onOpenNfa,
    onOpenOpenClaw,
    onSelectNfa,
    onSync,
    onToggleLang,
    portalId,
    pushLog,
    status,
    zh,
  ]);

  const identity = activeSummary ? buildLobsterIdentity(activeSummary, lang) : null;

  return (
    <section className="flex h-full flex-col bg-black/96 font-mono text-crt-green/80">
      <div className="flex items-start justify-between gap-3 border-b border-crt-green/20 px-4 py-4">
        <div>
          <p className="text-[10px] tracking-[0.28em] text-crt-green/40">{zh ? '快捷控制台' : 'QUICK CONSOLE'}</p>
          <p className="mt-1 text-xs text-crt-green/65">{zh ? 'Tab 打开 / 收起，按钮直接调用同一套链上逻辑' : 'Tab toggle. Buttons call the same on-chain flows.'}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={() => void runAction('lang')} className="soft-key px-3 py-1 text-[10px]">
            {zh ? 'EN' : '中文'}
          </button>
          <button type="button" onClick={onToggleMenu} className="soft-key px-3 py-1 text-[10px]">
            {zh ? '收起' : 'Close'}
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <div className="term-box" data-title={zh ? '当前状态' : 'SESSION'}>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between gap-3">
              <span className="text-crt-green/45">{zh ? '钱包' : 'Wallet'}</span>
              <span className="truncate text-crt-bright">{isConnected ? shortenAddress(address) : (zh ? '未连接' : 'Disconnected')}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-crt-green/45">{zh ? '场景' : 'Scene'}</span>
              <span className="text-crt-green/80">{sceneLabel(scene, status, zh)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-crt-green/45">{zh ? '同步' : 'Sync'}</span>
              <span className="text-crt-green/80">{status === 'booting' ? `${bootProgress}%` : statusText(status, zh)}</span>
            </div>
            {!!selectedConnectorId && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-crt-green/45">{zh ? '连接器' : 'Connector'}</span>
                <span className="truncate text-crt-green/80">{selectedConnectorId}</span>
              </div>
            )}
            {pendingTx && (
              <div className="rounded border border-crt-green/15 bg-crt-green/5 p-2 text-[11px] text-crt-green/75">
                <div>{txLabel(pendingTx.label, zh)}</div>
                <div className="text-crt-green/45">{pendingTx.hash.slice(0, 14)}...</div>
              </div>
            )}
          </div>
        </div>

        <div className="term-box" data-title={zh ? '钱包与同步' : 'WALLET'}>
          <div className="space-y-2">
            <button type="button" onClick={() => void runAction('sync')} className={`${actionButtonClass} w-full`}>
              {zh ? '同步链上数据' : 'Sync Chain Data'}
            </button>
            {!isConnected && (
              <div className="grid gap-2">
                {walletOptions.map((wallet) => (
                  <button key={wallet.id} type="button" onClick={() => void runAction('connect', wallet.name)} className={actionButtonClass}>
                    {zh ? '连接钱包' : 'Connect Wallet'}: {connectorName(wallet.name, zh)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="term-box" data-title={zh ? '当前龙虾' : 'ACTIVE NFA'}>
          {activeSummary ? (
            <div className="space-y-2 text-xs text-crt-green/80">
              <div>
                <div className="text-crt-bright">NFA #{activeSummary.tokenId} | {getLobsterName(activeSummary.tokenId)}</div>
                {identity && <div className="text-crt-green/45">{identity.title}</div>}
              </div>
              <div>{zh ? '等级' : 'Level'} {activeSummary.level}</div>
              <div>{zh ? '稀有度' : 'Rarity'} {getRarityName(activeSummary.rarity, zh)}</div>
              <div>{zh ? '避难所' : 'Shelter'} {getShelterName(activeSummary.shelter)}</div>
              <div>{zh ? '余额' : 'Balance'} Claworld {activeSummary.clwBalance.toFixed(0)}</div>
              <div>{zh ? '状态' : 'State'} {activeSummary.active ? (zh ? '活跃' : 'Active') : (zh ? '休眠' : 'Dormant')}</div>
            </div>
          ) : (
            <div className="text-xs text-crt-green/35">{zh ? '尚未选中龙虾' : 'No lobster selected'}</div>
          )}
        </div>

        <div className="term-box" data-title={zh ? '选择 NFA' : 'SELECT NFA'}>
          <div className="space-y-2">
            {nfaList.length === 0 ? (
              <div className="text-xs text-crt-green/35">{zh ? '当前钱包没有可用 NFA' : 'No NFA in this wallet'}</div>
            ) : (
              nfaList.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => void runAction('select', String(id))}
                  className={`${actionButtonClass} w-full ${id === activeNfaId ? 'border-crt-green/60 bg-crt-green/8 text-crt-bright' : ''}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span>NFA #{id}</span>
                    {id === activeNfaId && <span className="text-[10px] text-crt-green/55">{zh ? '活跃' : 'Active'}</span>}
                  </div>
                  {nfaSummaries[id] && (
                    <div className="mt-1 text-[11px] text-crt-green/45">
                      Lv.{nfaSummaries[id].level} | {getRarityName(nfaSummaries[id].rarity, zh)} | Claworld {nfaSummaries[id].clwBalance.toFixed(0)}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="term-box" data-title={zh ? '场景切换' : 'SCENE'}>
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: 'shelter', label: zh ? '避难所' : 'Shelter' },
              { key: 'task', label: zh ? '任务' : 'Task' },
              { key: 'pk', label: zh ? 'PK' : 'Arena' },
              { key: 'market', label: zh ? '市场' : 'Market' },
              { key: 'archive', label: zh ? '档案' : 'Archive' },
            ].map((item) => (
              <button key={item.key} type="button" onClick={() => void runAction('scene', item.key)} className={actionButtonClass}>
                {item.label}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input value={portalId} onChange={(event) => setPortalId(event.target.value)} className={inputClass} placeholder={zh ? '避难所 0-7' : 'Shelter 0-7'} inputMode="numeric" />
            <button type="button" onClick={() => void runAction('portal')} className={`${actionButtonClass} shrink-0`}>
              {zh ? '切换避难所' : 'Portal'}
            </button>
          </div>
        </div>

        <div className="term-box" data-title={zh ? '检索' : 'SEARCH'}>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => void runAction('matches')} className={actionButtonClass}>{zh ? '全部对局' : 'All Matches'}</button>
            <button type="button" onClick={() => void runAction('my-matches')} className={actionButtonClass}>{zh ? '我的对局' : 'My Matches'}</button>
            <button type="button" onClick={() => void runAction('listings')} className={actionButtonClass}>{zh ? '全部挂单' : 'All Listings'}</button>
            <button type="button" onClick={() => void runAction('my-listings')} className={actionButtonClass}>{zh ? '我的挂单' : 'My Listings'}</button>
          </div>
          <div className="mt-2 flex gap-2">
            <input value={matchId} onChange={(event) => setMatchId(event.target.value)} className={inputClass} placeholder={zh ? '对局 ID' : 'Match ID'} inputMode="numeric" />
            <button type="button" onClick={() => void runAction('match')} className={`${actionButtonClass} shrink-0`}>{zh ? '查看对局' : 'View Match'}</button>
          </div>
          <div className="mt-2 flex gap-2">
            <input value={listingId} onChange={(event) => setListingId(event.target.value)} className={inputClass} placeholder={zh ? '挂单 ID' : 'Listing ID'} inputMode="numeric" />
            <button type="button" onClick={() => void runAction('listing')} className={`${actionButtonClass} shrink-0`}>{zh ? '查看挂单' : 'View Listing'}</button>
          </div>
        </div>

        <div className="term-box" data-title={zh ? '系统' : 'SYSTEM'}>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => void runAction('nfa')} className={actionButtonClass}>{zh ? 'NFA 详情' : 'NFA Detail'}</button>
            <button type="button" onClick={() => void runAction('mint')} className={actionButtonClass}>{zh ? '去铸造' : 'Mint'}</button>
            <button type="button" onClick={() => void runAction('home')} className={actionButtonClass}>{zh ? '返回首页' : 'Home'}</button>
            <button type="button" onClick={() => void runAction('help')} className={actionButtonClass}>{zh ? '帮助说明' : 'Help'}</button>
            <button type="button" onClick={() => void runAction('openclaw')} className={`${actionButtonClass} col-span-2`}>OpenClaw</button>
          </div>
        </div>

        <div className="term-box" data-title={zh ? '执行记录' : 'ACTIVITY'}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-[11px] text-crt-green/45">{statusText(status, zh)}</div>
            <button type="button" onClick={() => void runAction('clear')} className="term-link text-[10px]">
              {zh ? '清空记录' : 'Clear'}
            </button>
          </div>
          <div ref={logRef} className="h-40 space-y-1 overflow-y-auto rounded border border-crt-green/15 bg-black/70 p-3 text-xs">
            {history.length === 0 ? (
              <div className="text-crt-green/35">{zh ? '等待操作...' : 'Awaiting action...'}</div>
            ) : (
              history.map((entry) => (
                <div key={entry.id} className={`break-words ${toneClass(entry.tone)}`}>
                  {entry.text}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
