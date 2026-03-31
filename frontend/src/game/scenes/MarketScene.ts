import * as Phaser from 'phaser';
import { eventBus } from '../EventBus';

interface Personality {
  courage: number;
  wisdom: number;
  social: number;
  create: number;
  grit: number;
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
  rarity: number;
}

const RARITY_COLORS = ['#aaaaaa', '#3399ff', '#aa44ff', '#ffd700', '#ff4444'];
const RARITY_NAMES = ['Common', 'Rare', 'Epic', 'Legendary', 'Mythic'];
const TYPE_NAMES = ['固定价', '拍卖', '互换'];

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

  constructor() {
    super({ key: 'MarketScene' });
  }

  init(data: { nfaId: number; shelter: number; personality?: Personality }) {
    this.nfaId = data.nfaId || (this.registry.get('nfaId') as number) || 1;
    this.shelter = data.shelter || (this.registry.get('shelter') as number) || 0;
    this.walletAddress = (this.registry.get('walletAddress') as string) || '';
    if (data.personality) this.personality = data.personality;
    else {
      const cached = this.registry.get('personality') as Personality | undefined;
      if (cached) this.personality = cached;
    }
  }

  create() {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    this.add.rectangle(W / 2, H / 2, W, H, 0x0a0a0a, 0.95);

    this.add.text(W / 2, 24, '[ 交易墙 ]', {
      fontSize: '16px', fontFamily: 'monospace', color: '#3399ff',
    }).setOrigin(0.5);

    this.add.text(W / 2, 46, `NFA #${this.nfaId} — 全真链上市场`, {
      fontSize: '10px', fontFamily: 'monospace', color: '#3399ff',
    }).setOrigin(0.5).setAlpha(0.6);

    const buttons = [
      { label: '[ 固定价挂售 ]', x: W * 0.25, action: () => this.promptList('fixed') },
      { label: '[ 拍卖挂售 ]', x: W * 0.5, action: () => this.promptList('auction') },
      { label: '[ 刷新列表 ]', x: W * 0.75, action: () => this.requestListings() },
    ];

    for (const button of buttons) {
      this.add.text(button.x, 70, button.label, {
        fontSize: '11px', fontFamily: 'monospace', color: '#39ff14',
        backgroundColor: '#001a00', padding: { x: 8, y: 4 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', button.action);
    }

    this.add.text(14, 98, 'ID     NFA     RARITY      TYPE       PRICE/BID           SELLER        ACTION', {
      fontSize: '9px', fontFamily: 'monospace', color: '#555555',
    });
    this.add.rectangle(W / 2, 110, W - 28, 1, 0x333333);

    const prevBtn = this.add.text(W / 2 - 60, H - 52, '[ ← 上一页 ]', {
      fontSize: '10px', fontFamily: 'monospace', color: '#39ff14',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const nextBtn = this.add.text(W / 2 + 60, H - 52, '[ 下一页 → ]', {
      fontSize: '10px', fontFamily: 'monospace', color: '#39ff14',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    prevBtn.on('pointerdown', () => {
      if (this.page > 0) {
        this.page--;
        this.renderListings();
      }
    });
    nextBtn.on('pointerdown', () => {
      if ((this.page + 1) * this.PER_PAGE < this.listings.length) {
        this.page++;
        this.renderListings();
      }
    });

    this.statusText = this.add.text(W / 2, H - 76, '读取链上市场中...', {
      fontSize: '10px', fontFamily: 'monospace', color: '#ffaa00',
      align: 'center', wordWrap: { width: W - 40 },
    }).setOrigin(0.5);

    this.add.text(W / 2, H - 24, '[ ESC 返回避难所 ]', {
      fontSize: '10px', fontFamily: 'monospace', color: '#39ff14',
    }).setOrigin(0.5).setAlpha(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.goBack());
    this.input.keyboard!.on('keydown-ESC', () => this.goBack());

    const offListings = eventBus.on('market:listings', (data: unknown) => {
      this.listings = data as Listing[];
      this.page = 0;
      this.renderListings();
      this.showStatus(this.listings.length > 0 ? '已同步链上挂单列表' : '当前没有活跃挂单', this.listings.length > 0 ? '#39ff14' : '#666666');
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
        this.showStatus(`${result.action.toUpperCase()} 提交中... ${result.txHash?.slice(0, 10)}...`, '#ffaa00');
        return;
      }

      if (result.status === 'failed') {
        this.showStatus(`失败: ${result.error}`, '#ff4444');
        return;
      }

      if (result.action === 'list') {
        this.showStatus(`挂售成功，Listing #${result.listingId ?? '?'}`, '#39ff14');
      } else if (result.action === 'buy') {
        this.showStatus('购买成功，链上所有权已更新', '#39ff14');
      } else if (result.action === 'bid') {
        this.showStatus('出价成功，已写入链上', '#39ff14');
      } else if (result.action === 'settle') {
        this.showStatus('拍卖已结算', '#39ff14');
      } else if (result.action === 'cancel') {
        this.showStatus('挂单已取消', '#39ff14');
      }

      this.requestListings();
    });

    const offWallet = eventBus.on('wallet:connected', (data: unknown) => {
      const wallet = data as { address: string };
      this.walletAddress = wallet.address;
      this.registry.set('walletAddress', wallet.address);
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offListings();
      offResult();
      offWallet();
    });

    this.requestListings();
  }

  private requestListings() {
    this.showStatus('读取链上市场中...', '#ffaa00');
    eventBus.emit('market:requestListings');
  }

  private promptList(mode: 'fixed' | 'auction') {
    const defaultValue = mode === 'fixed' ? '0.10' : '0.05';
    const price = window.prompt(mode === 'fixed' ? '输入固定价 BNB' : '输入拍卖起拍价 BNB', defaultValue);
    if (!price) return;
    eventBus.emit('market:list', { nfaId: this.nfaId, price, mode });
  }

  private renderListings() {
    this.rows.forEach((row) => row.destroy());
    this.rows = [];

    const W = this.cameras.main.width;
    const pageItems = this.listings.slice(this.page * this.PER_PAGE, this.page * this.PER_PAGE + this.PER_PAGE);

    if (pageItems.length === 0) {
      const empty = this.add.text(W / 2, 180, '没有活跃中的链上挂单', {
        fontSize: '12px', fontFamily: 'monospace', color: '#666666',
      }).setOrigin(0.5);
      const pageInfo = this.add.text(W / 2, this.cameras.main.height - 96, '第 0 / 0 页', {
        fontSize: '9px', fontFamily: 'monospace', color: '#555555',
      }).setOrigin(0.5);
      this.rows.push(empty, pageInfo);
      return;
    }

    pageItems.forEach((item, index) => {
      const y = 126 + index * 40;
      const rarityColor = RARITY_COLORS[item.rarity] || '#aaaaaa';
      const sellerShort = `${item.seller.slice(0, 6)}...${item.seller.slice(-4)}`;
      const isMine = Boolean(this.walletAddress) && item.seller.toLowerCase() === this.walletAddress.toLowerCase();
      const auctionEnded = item.listingType === 1 && item.endTime > 0 && Math.floor(Date.now() / 1000) >= item.endTime;
      const mainValue = item.listingType === 1 && Number(item.highestBid) > 0 ? `${item.highestBid} BNB` : `${item.price} BNB`;

      const rowBg = this.add.rectangle(W / 2, y + 8, W - 30, 34, 0x111122, 0.5)
        .setStrokeStyle(1, 0x222233)
        .setInteractive({ useHandCursor: true });
      rowBg.on('pointerover', () => rowBg.setFillStyle(0x222244, 0.8));
      rowBg.on('pointerout', () => rowBg.setFillStyle(0x111122, 0.5));

      const rowText = this.add.text(16, y,
        `${String(item.listingId).padEnd(6)} ${String(item.nfaId).padEnd(7)} ${RARITY_NAMES[item.rarity].padEnd(11)} ${TYPE_NAMES[item.listingType].padEnd(10)} ${mainValue.padEnd(18)} ${sellerShort.padEnd(13)}`,
        { fontSize: '9px', fontFamily: 'monospace', color: rarityColor },
      );

      this.rows.push(rowBg, rowText);

      if (item.listingType === 2) {
        const swapLabel = this.add.text(W - 72, y + 1, '[ SWAP ]', {
          fontSize: '9px', fontFamily: 'monospace', color: '#777777', backgroundColor: '#111111', padding: { x: 4, y: 2 },
        }).setOrigin(0.5);
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
      const actionBtn = this.add.text(W - 72, y + 1, actionLabel, {
        fontSize: '9px', fontFamily: 'monospace', color: actionColor,
        backgroundColor: isMine ? '#1a0000' : '#1a1a00', padding: { x: 4, y: 2 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      actionBtn.on('pointerdown', () => this.handleListingAction(item, isMine, auctionEnded));
      this.rows.push(actionBtn);
    });

    const totalPages = Math.ceil(this.listings.length / this.PER_PAGE);
    const pageInfo = this.add.text(W / 2, this.cameras.main.height - 96,
      `第 ${this.page + 1} / ${totalPages} 页  (共 ${this.listings.length} 条)`, {
        fontSize: '9px', fontFamily: 'monospace', color: '#555555',
      }).setOrigin(0.5);
    this.rows.push(pageInfo);
  }

  private handleListingAction(item: Listing, isMine: boolean, auctionEnded: boolean) {
    if (isMine) {
      eventBus.emit('market:cancel', { listingId: item.listingId });
      return;
    }

    if (item.listingType === 0) {
      eventBus.emit('market:buy', { listingId: item.listingId, price: item.price });
      return;
    }

    if (item.listingType === 1 && auctionEnded) {
      eventBus.emit('market:settle', { listingId: item.listingId });
      return;
    }

    if (item.listingType === 1) {
      const base = Number(item.highestBid) > 0 ? Number(item.highestBid) * 1.05 : Number(item.price);
      const bidAmount = window.prompt('输入出价 BNB', base.toFixed(4));
      if (!bidAmount) return;
      eventBus.emit('market:bid', { listingId: item.listingId, amount: bidAmount });
    }
  }

  private showStatus(text: string, color = '#39ff14') {
    this.statusText.setColor(color);
    this.statusText.setText(text);
  }

  private goBack() {
    this.scene.start('ShelterScene', { nfaId: this.nfaId, shelter: this.shelter, personality: this.personality });
  }
}
