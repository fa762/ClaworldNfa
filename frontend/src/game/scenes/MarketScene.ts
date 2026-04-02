import * as Phaser from 'phaser';
import { eventBus } from '../EventBus';
import { TerminalModal } from '../ui/TerminalModal';
import { loadMarketListing, type NFASummary } from '../chain/wallet';
import type { GameLang } from '../data/npc-dialogues';
import { buildLobsterIdentity } from '@/lib/lobsterIdentity';
import { getShelterSceneHint, getShelterSpecialty } from '@/lib/shelter';

interface Personality {
  courage: number;
  wisdom: number;
  social: number;
  create: number;
  grit: number;
}

interface PlayerPosition {
  x: number;
  y: number;
}

interface SwitchNfaPayload {
  nfaId: number;
  shelter: number;
  personality: Personality;
  lang?: GameLang;
}

interface Listing {
  listingId: number;
  nfaId: number;
  seller: string;
  listingType: number; // 0=fixed, 1=auction, 2=swap
  price: string;
  highestBid: string;
  highestBidder: string;
  endTime: number;
  swapTargetId: number;
  rarity: number;
}

const RARITY_COLORS = ['#aaaaaa', '#3399ff', '#aa44ff', '#ffd700', '#ff4444'];
const RARITY_NAMES_ZH = ['普通', '稀有', '史诗', '传说', '神话'];
const RARITY_NAMES_EN = ['Common', 'Rare', 'Epic', 'Legendary', 'Mythic'];
const TYPE_NAMES_ZH = ['固定价', '拍卖', '互换'];
const TYPE_NAMES_EN = ['Fixed', 'Auction', 'Swap'];
const STATUS_NAMES_ZH = ['进行中', '已成交', '已取消'];
const STATUS_NAMES_EN = ['ACTIVE', 'SOLD', 'CANCELLED'];

/**
 * MarketScene — 全真链上市场
 */
export class MarketScene extends Phaser.Scene {
  private nfaId = 0;
  private shelter = 0;
  private personality: Personality = { courage: 50, wisdom: 50, social: 50, create: 50, grit: 50 };
  private walletAddress = '';
  private listings: Listing[] = [];
  private page = 0;
  private readonly PER_PAGE = 5;
  private rows: Phaser.GameObjects.GameObject[] = [];
  private statusText!: Phaser.GameObjects.Text;
  private playerPosition?: PlayerPosition;
  private entryAction?: string;
  private walletNfaIds: number[] = [];
  private walletSummaries: Record<number, NFASummary> = {};
  private modal!: TerminalModal;
  private lang: GameLang = 'zh';
  private showOnlyMine = false;
  private listingFilterButton?: Phaser.GameObjects.Text;
  private listingTableY = 0;

  constructor() {
    super({ key: 'MarketScene' });
  }

  init(data: { nfaId: number; shelter: number; personality?: Personality; playerPosition?: PlayerPosition; entryAction?: string; lang?: GameLang }) {
    this.nfaId = data.nfaId || (this.registry.get('nfaId') as number) || 1;
    this.shelter = data.shelter || (this.registry.get('shelter') as number) || 0;
    this.walletAddress = (this.registry.get('walletAddress') as string) || '';
    if (data.personality) this.personality = data.personality;
    else {
      const cached = this.registry.get('personality') as Personality | undefined;
      if (cached) this.personality = cached;
    }
    this.playerPosition = data.playerPosition || (this.registry.get('playerPosition') as PlayerPosition | undefined);
    this.entryAction = data.entryAction;
    this.lang = data.lang || (this.registry.get('gameLang') as GameLang) || 'zh';
  }

  create() {
    eventBus.emit('game:scene', { scene: 'market', nfaId: this.nfaId, shelter: this.shelter });

    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    this.add.rectangle(W / 2, H / 2, W, H, 0x101014, 0.9);

    this.add.text(W / 2, 24, this.lang === 'zh' ? '[ 交易墙 ]' : '[ MARKET WALL ]', {
      fontSize: '24px', fontFamily: 'monospace', color: '#3399ff',
    }).setOrigin(0.5);

    this.add.text(W / 2, 46, this.lang === 'zh' ? `NFA #${this.nfaId} — 全真链上市场` : `NFA #${this.nfaId} — Full Onchain Market`, {
      fontSize: '14px', fontFamily: 'monospace', color: '#3399ff',
    }).setOrigin(0.5).setAlpha(0.6);

    this.add.text(W / 2, 62, this.lang === 'zh' ? '固定价 / 拍卖 / 互换 都在链上结算' : 'Fixed / Auction / Swap all settle onchain', {
      fontSize: '12px', fontFamily: 'monospace', color: '#9fb7ff',
    }).setOrigin(0.5).setAlpha(0.75);

    const specialty = getShelterSpecialty(this.shelter, this.lang);
    this.add.text(W / 2, 78, this.lang === 'zh' ? `当前避难所偏向：${specialty.text}` : `Current shelter bias: ${specialty.text}`, {
      fontSize: '11px', fontFamily: 'monospace', color: specialty.color,
    }).setOrigin(0.5).setAlpha(0.75);

    this.add.text(W / 2, 94, getShelterSceneHint(this.shelter, 'market', this.lang), {
      fontSize: '10px', fontFamily: 'monospace', color: '#9fb7ff',
      align: 'center', wordWrap: { width: W - 40 },
    }).setOrigin(0.5).setAlpha(0.62);

    this.modal = new TerminalModal(this);
    const compactHeader = W < 760;

    const buttons = [
      { label: this.lang === 'zh' ? '[ 固定价挂售 ]' : '[ FIXED LIST ]', x: W * 0.2, action: () => this.promptList('fixed') },
      { label: this.lang === 'zh' ? '[ 拍卖挂售 ]' : '[ AUCTION ]', x: W * 0.4, action: () => this.promptList('auction') },
      { label: this.lang === 'zh' ? '[ 互换挂售 ]' : '[ SWAP LIST ]', x: W * 0.6, action: () => this.promptList('swap') },
      { label: this.lang === 'zh' ? '[ 刷新列表 ]' : '[ REFRESH ]', x: W * 0.8, action: () => this.requestListings() },
    ];

    buttons.forEach((button, index) => {
      const col = compactHeader ? index % 2 : index;
      const row = compactHeader ? Math.floor(index / 2) : 0;
      const x = compactHeader ? W * (0.3 + col * 0.4) : button.x;
      const y = compactHeader ? 106 + row * 34 : 104;

      this.add.text(x, y, button.label, {
        fontSize: '14px', fontFamily: 'monospace', color: '#39ff14',
        backgroundColor: '#001a00', padding: { x: 10, y: 6 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', button.action);
    });

    const toolsY = compactHeader ? 176 : 140;
    this.listingFilterButton = this.add.text(14, toolsY, '', {
      fontSize: '11px', fontFamily: 'monospace', color: '#39ff14',
      backgroundColor: '#001a00', padding: { x: 8, y: 4 },
    }).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.toggleListingFilter());

    this.add.text(W - 14, toolsY, this.lang === 'zh' ? '[ 搜索挂单 ]' : '[ FIND ID ]', {
      fontSize: '11px', fontFamily: 'monospace', color: '#7ad7ff',
      backgroundColor: '#00131a', padding: { x: 8, y: 4 },
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.promptFindListing());

    const headerY = toolsY + 28;
    this.add.text(14, headerY, this.lang === 'zh' ? 'ID     NFA     稀有度      类型       价格/出价          卖家          操作' : 'ID     NFA     RARITY      TYPE       PRICE/BID           SELLER        ACTION', {
      fontSize: '11px', fontFamily: 'monospace', color: '#555555',
    });
    this.add.rectangle(W / 2, headerY + 12, W - 28, 1, 0x333333);
    this.listingTableY = headerY + 22;
    this.refreshListingFilterButton();

    const prevBtn = this.add.text(W / 2 - 60, H - 52, this.lang === 'zh' ? '[ ← 上一页 ]' : '[ ← PREV ]', {
      fontSize: '14px', fontFamily: 'monospace', color: '#39ff14',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const nextBtn = this.add.text(W / 2 + 60, H - 52, this.lang === 'zh' ? '[ 下一页 → ]' : '[ NEXT → ]', {
      fontSize: '14px', fontFamily: 'monospace', color: '#39ff14',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    prevBtn.on('pointerdown', () => {
      if (this.page > 0) {
        this.page--;
        this.renderListings();
      }
    });
    nextBtn.on('pointerdown', () => {
      if ((this.page + 1) * this.PER_PAGE < this.getVisibleListings().length) {
        this.page++;
        this.renderListings();
      }
    });

    this.statusText = this.add.text(W / 2, H - 76, this.lang === 'zh' ? '读取链上市场中...' : 'Loading onchain market...', {
      fontSize: '14px', fontFamily: 'monospace', color: '#ffaa00',
      align: 'center', wordWrap: { width: W - 40 },
    }).setOrigin(0.5);

    this.add.text(W / 2, H - 24, this.lang === 'zh' ? '[ ESC 返回避难所 ]' : '[ ESC BACK TO SHELTER ]', {
      fontSize: '14px', fontFamily: 'monospace', color: '#39ff14',
    }).setOrigin(0.5).setAlpha(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.goBack());
    this.input.keyboard!.on('keydown-ESC', () => this.goBack());

    const offListings = eventBus.on('market:listings', (data: unknown) => {
      this.listings = data as Listing[];
      this.page = 0;
      this.renderListings();
      this.showStatus(this.listings.length > 0 ? (this.lang === 'zh' ? '已同步链上挂单列表' : 'Loaded onchain listings') : (this.lang === 'zh' ? '当前没有活跃挂单' : 'No active listings'), this.listings.length > 0 ? '#39ff14' : '#666666');
    });

    const offResult = eventBus.on('market:result', (data: unknown) => {
      const result = data as {
        status: 'pending' | 'confirmed' | 'failed';
        action: string;
        txHash?: string;
        error?: string;
        listingId?: number;
      };

      if (result.status === 'pending') {
        this.showStatus(`${this.pendingActionText(result.action)} ${this.lang === 'zh' ? '提交中' : 'pending'}... ${result.txHash?.slice(0, 10)}...`, '#ffaa00');
        return;
      }

      if (result.status === 'failed') {
        this.showStatus(this.lang === 'zh' ? `失败: ${result.error}` : `Failed: ${result.error}`, '#ff4444');
        return;
      }

      if (result.action === 'list') {
        this.showStatus(this.lang === 'zh' ? `挂售成功，Listing #${result.listingId ?? '?'}` : `Listed successfully, listing #${result.listingId ?? '?'}`, '#39ff14');
      } else if (result.action === 'buy') {
        this.showStatus(this.lang === 'zh' ? '购买成功，链上所有权已更新' : 'Purchase successful, ownership updated', '#39ff14');
      } else if (result.action === 'bid') {
        this.showStatus(this.lang === 'zh' ? '出价成功，已写入链上' : 'Bid submitted onchain', '#39ff14');
      } else if (result.action === 'settle') {
        this.showStatus(this.lang === 'zh' ? '拍卖已结算' : 'Auction settled', '#39ff14');
      } else if (result.action === 'cancel') {
        this.showStatus(this.lang === 'zh' ? '挂单已取消' : 'Listing cancelled', '#39ff14');
      } else if (result.action === 'acceptSwap') {
        this.showStatus(this.lang === 'zh' ? '互换成功，链上所有权已更新' : 'Swap accepted, ownership updated', '#39ff14');
      }

      this.requestListings();
    });

    const offWallet = eventBus.on('wallet:connected', (data: unknown) => {
      const wallet = data as { address: string };
      this.walletAddress = wallet.address;
      this.registry.set('walletAddress', wallet.address);
    });

    const offWalletNfas = eventBus.on('wallet:nfas', (data: unknown) => {
      const payload = data as { ids: number[]; summaries: Record<number, NFASummary> };
      this.walletNfaIds = payload.ids;
      this.walletSummaries = payload.summaries;
    });

    const offSwitchNfa = eventBus.on('game:switchNfa', (data: unknown) => {
      const payload = data as SwitchNfaPayload;
      this.scene.start('ShelterScene', {
        nfaId: payload.nfaId,
        shelter: payload.shelter,
        personality: payload.personality,
        playerPosition: this.playerPosition,
        lang: payload.lang ?? this.lang,
      });
    });

    const offCommand = eventBus.on('game:command', (data: unknown) => {
      const payload = data as { name?: string; args?: string[] };
      if (!payload.name) return;
      this.handleCliCommand(payload.name, payload.args ?? []);
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offListings();
      offResult();
      offWallet();
      offWalletNfas();
      offSwitchNfa();
      offCommand();
      this.modal.destroy();
    });

    eventBus.emit('wallet:nfas:request');
    this.requestListings();

    if (this.entryAction === 'market:list') {
      this.time.delayedCall(150, () => this.promptListingMode());
    }
  }

  private promptListingMode() {
    this.modal.showMenu({
      title: this.lang === 'zh' ? '选择挂售模式' : 'Choose listing mode',
      subtitle: this.lang === 'zh' ? '固定价立即成交，拍卖持续 24 小时，互换指定另一只 NFA。' : 'Fixed price sells instantly, auctions last 24 hours, swaps target another NFA.',
      options: [
        { label: this.lang === 'zh' ? '固定价挂售' : 'Fixed price listing', description: this.lang === 'zh' ? '输入一个 BNB 价格，任何人都能直接购买。' : 'Set a BNB price for instant purchase.', onSelect: () => this.promptList('fixed') },
        { label: this.lang === 'zh' ? '拍卖挂售' : 'Auction listing', description: this.lang === 'zh' ? '设置起拍价，24 小时后由最高出价者成交。' : 'Set a start price; highest bid wins after 24h.', onSelect: () => this.promptList('auction') },
        { label: this.lang === 'zh' ? '互换挂售' : 'Swap listing', description: this.lang === 'zh' ? '指定另一只 NFA，只有目标 NFA 的持有者能接受。' : 'Target another NFA for a direct swap.', onSelect: () => this.promptList('swap') },
      ],
    });
  }

  private requestListings() {
    this.showStatus(this.lang === 'zh' ? '读取链上市场中...' : 'Loading onchain market...', '#ffaa00');
    eventBus.emit('market:requestListings');
  }

  private typeName(type: number) {
    return (this.lang === 'zh' ? TYPE_NAMES_ZH : TYPE_NAMES_EN)[type] ?? `TYPE ${type}`;
  }

  private rarityName(rarity: number) {
    return (this.lang === 'zh' ? RARITY_NAMES_ZH : RARITY_NAMES_EN)[rarity] ?? `${rarity}`;
  }

  private statusName(status: number) {
    return (this.lang === 'zh' ? STATUS_NAMES_ZH : STATUS_NAMES_EN)[status] ?? `${status}`;
  }

  private pendingActionText(action: string) {
    if (this.lang !== 'zh') return action.toUpperCase();
    const labels: Record<string, string> = {
      list: '创建挂单',
      buy: '购买',
      bid: '出价',
      settle: '结算拍卖',
      cancel: '取消挂单',
      acceptSwap: '接受互换',
    };
    return labels[action] ?? action;
  }

  private getVisibleListings() {
    if (!this.showOnlyMine || !this.walletAddress) {
      return this.listings;
    }

    const owner = this.walletAddress.toLowerCase();
    return this.listings.filter((item) => item.seller.toLowerCase() === owner);
  }

  private refreshListingFilterButton() {
    this.listingFilterButton?.setText(
      this.showOnlyMine
        ? (this.lang === 'zh' ? '[ 我的挂单 ]' : '[ MY LISTINGS ]')
        : (this.lang === 'zh' ? '[ 全部挂单 ]' : '[ ALL LISTINGS ]')
    );
  }

  private toggleListingFilter() {
    this.showOnlyMine = !this.showOnlyMine;
    this.page = 0;
    this.refreshListingFilterButton();
    this.renderListings();
    this.showStatus(
      this.showOnlyMine
        ? (this.lang === 'zh' ? '仅显示当前钱包的挂单' : 'Showing listings from the connected wallet')
        : (this.lang === 'zh' ? '显示全部活跃挂单' : 'Showing all active listings'),
      '#39ff14',
    );
  }

  private promptFindListing() {
    this.modal.showForm({
      title: this.lang === 'zh' ? '搜索挂单' : 'Find listing',
      subtitle: this.lang === 'zh' ? '输入 listing id，查看这条市场挂单的链上详情。' : 'Enter a listing id to inspect the on-chain market entry.',
      fields: [
        { name: 'listingId', label: this.lang === 'zh' ? '挂单 ID' : 'Listing ID', type: 'number', placeholder: '1' },
      ],
      submitLabel: this.lang === 'zh' ? '查看' : 'Inspect',
      onSubmit: (values) => {
        const listingId = Number(values.listingId);
        if (!Number.isInteger(listingId) || listingId <= 0) {
          this.showStatus(this.lang === 'zh' ? '请输入有效的挂单 ID' : 'Enter a valid listing id', '#ff4444');
          return;
        }
        void this.inspectListing(listingId);
      },
    });
  }

  private async inspectListing(listingId: number) {
    this.showStatus(this.lang === 'zh' ? `读取挂单 #${listingId} 中...` : `Loading listing #${listingId}...`, '#7ad7ff');

    const listing = await loadMarketListing(listingId);
    if (!listing) {
      this.showStatus(this.lang === 'zh' ? `未找到挂单 #${listingId}` : `Listing #${listingId} not found`, '#ff4444');
      return;
    }

    const item: Listing = {
      listingId: listing.listingId,
      nfaId: listing.nfaId,
      seller: listing.seller,
      listingType: listing.listingType,
      price: (Number(listing.price) / 1e18).toFixed(4),
      highestBid: (Number(listing.highestBid) / 1e18).toFixed(4),
      highestBidder: listing.highestBidder,
      endTime: listing.endTime,
      swapTargetId: listing.swapTargetId,
      rarity: listing.rarity,
    };

    const isMine = Boolean(this.walletAddress) && item.seller.toLowerCase() === this.walletAddress.toLowerCase();
    const auctionEnded = item.listingType === 1 && item.endTime > 0 && Math.floor(Date.now() / 1000) >= item.endTime;
    const typeName = this.typeName(item.listingType);
    const valueText = item.listingType === 2
      ? `NFA #${item.swapTargetId}`
      : item.listingType === 1 && Number(item.highestBid) > 0
        ? `${item.highestBid} BNB`
        : `${item.price} BNB`;

    const options: Array<{ label: string; description?: string; disabled?: boolean; onSelect: () => void }> = [
      {
        label: `NFA #${item.nfaId} | ${typeName}`,
        description: this.lang === 'zh'
          ? `状态 ${this.statusName(listing.status)} | ${valueText}`
          : `Status ${['ACTIVE', 'SOLD', 'CANCELLED'][listing.status] ?? listing.status} | ${valueText}`,
        disabled: true,
        onSelect: () => {},
      },
      {
        label: `${this.lang === 'zh' ? '卖家' : 'Seller'} ${item.seller.slice(0, 6)}...${item.seller.slice(-4)}`,
        description: item.listingType === 1
          ? `${this.lang === 'zh' ? '最高出价' : 'Highest bid'} ${item.highestBid} BNB`
          : `${this.lang === 'zh' ? '稀有度' : 'Rarity'} ${this.rarityName(item.rarity)}`,
        disabled: true,
        onSelect: () => {},
      },
    ];

    if (listing.status === 0) {
      options.push({
        label: isMine
          ? (this.lang === 'zh' ? '[ 操作此挂单 ]' : '[ MANAGE LISTING ]')
          : item.listingType === 0
            ? (this.lang === 'zh' ? '[ 购买 ]' : '[ BUY ]')
            : item.listingType === 1
              ? (auctionEnded ? (this.lang === 'zh' ? '[ 结算 ]' : '[ SETTLE ]') : (this.lang === 'zh' ? '[ 出价 ]' : '[ BID ]'))
              : (this.lang === 'zh' ? '[ 互换 ]' : '[ SWAP ]'),
        description: this.lang === 'zh' ? '打开该挂单的可执行操作。' : 'Open the actions available for this listing.',
        disabled: false,
        onSelect: () => this.handleListingAction(item, isMine, auctionEnded),
      });
    }

    this.modal.showMenu({
      title: this.lang === 'zh' ? `挂单 #${listingId}` : `Listing #${listingId}`,
      subtitle: this.lang === 'zh'
        ? '你可以在这里查看挂单状态，并直接执行买入、出价、结算或取消。'
        : 'Inspect the listing and directly buy, bid, settle, or cancel from here.',
      options,
      cancelLabel: this.lang === 'zh' ? '关闭' : 'Close',
    });
    this.showStatus(this.lang === 'zh' ? `已打开挂单 #${listingId}` : `Opened listing #${listingId}`, '#39ff14');
  }

  private promptList(mode: 'fixed' | 'auction' | 'swap') {
    if (mode === 'swap') {
      const candidates = this.walletNfaIds.filter((id) => id !== this.nfaId);
      if (candidates.length === 0) {
        this.showStatus(this.lang === 'zh' ? '你没有其他 NFA 可作为互换目标' : 'No other NFA available as a swap target', '#666666');
        return;
      }

      this.modal.showMenu({
        title: this.lang === 'zh' ? '互换挂售' : 'Swap listing',
        subtitle: this.lang === 'zh' ? `当前挂出的 NFA 是 #${this.nfaId}。选择你想换到手的目标 NFA。` : `You are listing NFA #${this.nfaId}. Choose the NFA you want in return.`,
        options: candidates.map((id) => ({
          label: `目标 NFA #${id}`,
          description: this.walletSummaries[id]
            ? `Lv.${this.walletSummaries[id].level} · ${this.lang === 'zh' ? '互换目标' : 'swap target'}`
            : '链上可用 NFA',
          onSelect: () => eventBus.emit('market:list', { nfaId: this.nfaId, mode: 'swap', targetNfaId: id }),
        })),
      });
      return;
    }

    const defaultValue = mode === 'fixed' ? '0.10' : '0.05';
    this.modal.showForm({
      title: mode === 'fixed' ? (this.lang === 'zh' ? '固定价挂售' : 'Fixed price listing') : (this.lang === 'zh' ? '拍卖挂售' : 'Auction listing'),
      subtitle: mode === 'fixed'
        ? (this.lang === 'zh' ? `挂售 NFA #${this.nfaId}，输入你希望收到的 BNB 固定价。` : `List NFA #${this.nfaId} and set the BNB fixed price you want.`)
        : (this.lang === 'zh' ? `挂售 NFA #${this.nfaId}，输入拍卖起拍价。拍卖持续 24 小时。` : `List NFA #${this.nfaId} and set the starting price. Auction lasts 24 hours.`),
      fields: [
        {
          name: 'price',
          label: mode === 'fixed' ? (this.lang === 'zh' ? '固定价 BNB' : 'Fixed price BNB') : (this.lang === 'zh' ? '起拍价 BNB' : 'Starting bid BNB'),
          type: 'number',
          value: defaultValue,
          placeholder: defaultValue,
        },
      ],
      submitLabel: this.lang === 'zh' ? '发起挂售' : 'Create listing',
      onSubmit: (values) => {
        if (!values.price || Number(values.price) <= 0) {
          this.showStatus(this.lang === 'zh' ? '请输入有效价格' : 'Enter a valid price', '#ff4444');
          return;
        }
        eventBus.emit('market:list', { nfaId: this.nfaId, price: values.price, mode });
      },
    });
  }

  private renderListings() {
    this.rows.forEach((row) => row.destroy());
    this.rows = [];

    const W = this.cameras.main.width;
    const isCompact = W < 760;
    const visibleListings = this.getVisibleListings();
    const pageItems = visibleListings.slice(this.page * this.PER_PAGE, this.page * this.PER_PAGE + this.PER_PAGE);

    if (pageItems.length === 0) {
      const empty = this.add.text(W / 2, this.listingTableY + 24, this.showOnlyMine ? (this.lang === 'zh' ? '当前钱包没有活跃挂单' : 'This wallet has no active listings') : '没有活跃中的链上挂单', {
        fontSize: '16px', fontFamily: 'monospace', color: '#666666',
      }).setOrigin(0.5);
      const pageInfo = this.add.text(W / 2, this.cameras.main.height - 96, '第 0 / 0 页', {
        fontSize: '12px', fontFamily: 'monospace', color: '#555555',
      }).setOrigin(0.5);
      this.rows.push(empty, pageInfo);
      return;
    }

    pageItems.forEach((item, index) => {
      const baseY = this.listingTableY;
      const y = isCompact ? baseY + index * 76 : baseY + index * 48;
      const rarityColor = RARITY_COLORS[item.rarity] || '#aaaaaa';
      const sellerShort = `${item.seller.slice(0, 6)}...${item.seller.slice(-4)}`;
      const isMine = Boolean(this.walletAddress) && item.seller.toLowerCase() === this.walletAddress.toLowerCase();
      const hasSwapTarget = item.listingType === 2 && this.walletNfaIds.includes(item.swapTargetId);
      const auctionEnded = item.listingType === 1 && item.endTime > 0 && Math.floor(Date.now() / 1000) >= item.endTime;
      const mainValue = item.listingType === 2
        ? `换 NFA #${item.swapTargetId}`
        : item.listingType === 1 && Number(item.highestBid) > 0
          ? `${item.highestBid} BNB`
          : `${item.price} BNB`;
      const identity = buildLobsterIdentity({
        rarity: item.rarity,
        shelter: (item.nfaId + this.shelter) % 8,
        level: 8 + (item.nfaId % 21),
        courage: 30 + ((item.nfaId * 7) % 60),
        wisdom: 30 + ((item.nfaId * 11) % 60),
        social: 30 + ((item.nfaId * 13) % 60),
        create: 30 + ((item.nfaId * 17) % 60),
        grit: 30 + ((item.nfaId * 19) % 60),
      }, this.lang);

      const rowBg = this.add.rectangle(W / 2, y + (isCompact ? 18 : 10), W - 30, isCompact ? 68 : 40, 0x111122, 0.5)
        .setStrokeStyle(1, 0x222233)
        .setInteractive({ useHandCursor: true });
      rowBg.on('pointerover', () => rowBg.setFillStyle(0x222244, 0.8));
      rowBg.on('pointerout', () => rowBg.setFillStyle(0x111122, 0.5));

      const rowText = this.add.text(
        16,
        y,
        isCompact
          ? `#${item.listingId}  NFA ${item.nfaId}  ${this.typeName(item.listingType)}\n${identity.title}  ·  ${mainValue}\n${this.lang === 'zh' ? '卖家' : 'Seller'} ${sellerShort}`
          : `${String(item.listingId).padEnd(6)} ${String(item.nfaId).padEnd(7)} ${identity.title.padEnd(18)} ${this.typeName(item.listingType).padEnd(10)} ${mainValue.padEnd(18)} ${sellerShort.padEnd(13)}`,
        { fontSize: isCompact ? '11px' : '11px', fontFamily: 'monospace', color: rarityColor, lineSpacing: 4 },
      );

      this.rows.push(rowBg, rowText);

      if (item.listingType === 2) {
        const swapLabel = this.add.text(W - 80, y + (isCompact ? 18 : 1), isMine ? '[ 取消 ]' : hasSwapTarget ? '[ 接受 ]' : `[ 需 #${item.swapTargetId} ]`, {
          fontSize: '11px', fontFamily: 'monospace', color: isMine ? '#ff6666' : hasSwapTarget ? '#39ff14' : '#777777', backgroundColor: '#111111', padding: { x: 6, y: 4 },
        }).setOrigin(0.5);
        if (isMine || hasSwapTarget) {
          swapLabel.setInteractive({ useHandCursor: true });
          swapLabel.on('pointerdown', () => this.handleListingAction(item, isMine, auctionEnded));
        }
        this.rows.push(swapLabel);
        return;
      }

      const actionLabel = isMine
        ? '[ 取消 ]'
        : item.listingType === 0
          ? '[ 购买 ]'
          : auctionEnded
            ? '[ 结算 ]'
            : '[ 出价 ]';

      const actionColor = isMine ? '#ff4444' : '#ffd700';
      const actionBtn = this.add.text(W - 80, y + (isCompact ? 18 : 1), actionLabel, {
        fontSize: '11px', fontFamily: 'monospace', color: actionColor,
        backgroundColor: isMine ? '#1a0000' : '#1a1a00', padding: { x: 6, y: 4 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      actionBtn.on('pointerdown', () => this.handleListingAction(item, isMine, auctionEnded));
      this.rows.push(actionBtn);
    });

    const totalPages = Math.ceil(visibleListings.length / this.PER_PAGE);
    const pageInfo = this.add.text(W / 2, this.cameras.main.height - 96,
      `第 ${this.page + 1} / ${totalPages} 页  (共 ${visibleListings.length} 条)`, {
        fontSize: '12px', fontFamily: 'monospace', color: '#555555',
      }).setOrigin(0.5);
    this.rows.push(pageInfo);
  }

  private handleListingAction(item: Listing, isMine: boolean, auctionEnded: boolean) {
    const identity = buildLobsterIdentity({
      rarity: item.rarity,
      shelter: (item.nfaId + this.shelter) % 8,
      level: 8 + (item.nfaId % 21),
      courage: 30 + ((item.nfaId * 7) % 60),
      wisdom: 30 + ((item.nfaId * 11) % 60),
      social: 30 + ((item.nfaId * 13) % 60),
      create: 30 + ((item.nfaId * 17) % 60),
      grit: 30 + ((item.nfaId * 19) % 60),
    }, this.lang);

    if (isMine) {
      this.modal.showMenu({
        title: '取消挂单',
        subtitle: `${identity.title} · ${this.lang === 'zh' ? `确认取消 Listing #${item.listingId} 吗？链上托管的 NFA 会返回给卖家。` : `Cancel listing #${item.listingId}? The escrowed NFA will return to the seller.`}`,
        options: [
          { label: '确认取消', description: `NFA #${item.nfaId}`, onSelect: () => eventBus.emit('market:cancel', { listingId: item.listingId }) },
        ],
      });
      return;
    }

    if (item.listingType === 0) {
      this.modal.showMenu({
        title: '购买 NFA',
        subtitle: `${identity.title} · ${this.lang === 'zh' ? `确认用 ${item.price} BNB 购买 NFA #${item.nfaId} 吗？` : `Buy NFA #${item.nfaId} for ${item.price} BNB?`}`,
        options: [
          { label: '确认购买', description: `Listing #${item.listingId}`, onSelect: () => eventBus.emit('market:buy', { listingId: item.listingId, price: item.price }) },
        ],
      });
      return;
    }

    if (item.listingType === 1 && auctionEnded) {
      this.modal.showMenu({
        title: '结算拍卖',
        subtitle: `${identity.title} · ${this.lang === 'zh' ? `拍卖已结束。确认结算 Listing #${item.listingId} 吗？` : `Auction ended. Settle listing #${item.listingId}?`}`,
        options: [
          { label: '确认结算', description: `NFA #${item.nfaId}`, onSelect: () => eventBus.emit('market:settle', { listingId: item.listingId }) },
        ],
      });
      return;
    }

    if (item.listingType === 1) {
      const base = Number(item.highestBid) > 0 ? Number(item.highestBid) * 1.05 : Number(item.price);
      this.modal.showForm({
        title: '出价竞拍',
        subtitle: `${identity.title} · ${this.lang === 'zh' ? `当前最低有效出价约为 ${base.toFixed(4)} BNB。` : `Current minimum viable bid is about ${base.toFixed(4)} BNB.`}`,
        fields: [
          { name: 'amount', label: '出价 BNB', type: 'number', value: base.toFixed(4), placeholder: base.toFixed(4) },
        ],
        submitLabel: '提交出价',
        onSubmit: (values) => {
          if (!values.amount || Number(values.amount) <= 0) {
            this.showStatus('请输入有效出价', '#ff4444');
            return;
          }
          eventBus.emit('market:bid', { listingId: item.listingId, amount: values.amount });
        },
      });
      return;
    }

    if (item.listingType === 2) {
      this.modal.showMenu({
        title: '接受互换',
        subtitle: `${identity.title} · ${this.lang === 'zh' ? `你将交出 NFA #${item.swapTargetId}，换入对方的 NFA #${item.nfaId}。` : `You will trade NFA #${item.swapTargetId} for their NFA #${item.nfaId}.`}`,
        options: [
          {
            label: '确认互换',
            description: `Listing #${item.listingId}`,
            onSelect: () => eventBus.emit('market:acceptSwap', { listingId: item.listingId, targetNfaId: item.swapTargetId }),
          },
        ],
      });
    }
  }

  private showStatus(text: string, color = '#39ff14') {
    this.statusText.setColor(color);
    this.statusText.setText(text);
  }

  private goBack() {
    this.scene.start('ShelterScene', { nfaId: this.nfaId, shelter: this.shelter, personality: this.personality, playerPosition: this.playerPosition, lang: this.lang });
  }

  private handleCliCommand(name: string, args: string[]) {
    const sceneData = {
      nfaId: this.nfaId,
      shelter: this.shelter,
      personality: this.personality,
      playerPosition: this.playerPosition,
      lang: this.lang,
    };

    switch (name) {
      case 'task':
        this.scene.start('TaskScene', sceneData);
        break;
      case 'pk':
        this.scene.start('PKScene', sceneData);
        break;
      case 'market':
        this.scene.restart(sceneData);
        break;
      case 'listings':
        this.showOnlyMine = false;
        this.page = 0;
        this.refreshListingFilterButton();
        this.requestListings();
        break;
      case 'my-listings':
        this.showOnlyMine = true;
        this.page = 0;
        this.refreshListingFilterButton();
        this.requestListings();
        break;
      case 'listing': {
        const listingId = Number(args[0]);
        if (Number.isInteger(listingId) && listingId > 0) {
          void this.inspectListing(listingId);
        }
        break;
      }
      case 'archive':
        this.scene.start('ArchiveScene', sceneData);
        break;
      case 'shelter':
        this.scene.start('ShelterScene', sceneData);
        break;
      case 'portal': {
        const targetShelter = Number(args[0]);
        if (Number.isInteger(targetShelter) && targetShelter >= 0 && targetShelter <= 7) {
          this.scene.start('ShelterScene', { ...sceneData, shelter: targetShelter });
        }
        break;
      }
      case 'openclaw':
        eventBus.emit('game:openclaw');
        break;
      default:
        break;
    }
  }

  private getTypeNames() {
    return this.lang === 'zh' ? TYPE_NAMES_ZH : TYPE_NAMES_EN;
  }
}
