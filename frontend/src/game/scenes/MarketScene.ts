import * as Phaser from 'phaser';
import { eventBus } from '../EventBus';
import { TerminalModal } from '../ui/TerminalModal';
import type { NFASummary } from '../chain/wallet';

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
  private playerPosition?: PlayerPosition;
  private entryAction?: string;
  private walletNfaIds: number[] = [];
  private walletSummaries: Record<number, NFASummary> = {};
  private modal!: TerminalModal;

  constructor() {
    super({ key: 'MarketScene' });
  }

  init(data: { nfaId: number; shelter: number; personality?: Personality; playerPosition?: PlayerPosition; entryAction?: string }) {
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
  }

  create() {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    this.add.rectangle(W / 2, H / 2, W, H, 0x0a0a0a, 0.95);

    this.add.text(W / 2, 24, '[ 交易墙 ]', {
      fontSize: '24px', fontFamily: 'monospace', color: '#3399ff',
    }).setOrigin(0.5);

    this.add.text(W / 2, 46, `NFA #${this.nfaId} — 全真链上市场`, {
      fontSize: '14px', fontFamily: 'monospace', color: '#3399ff',
    }).setOrigin(0.5).setAlpha(0.6);

    this.add.text(W / 2, 62, '固定价 / 拍卖 / 互换 都在链上结算', {
      fontSize: '12px', fontFamily: 'monospace', color: '#9fb7ff',
    }).setOrigin(0.5).setAlpha(0.75);

    this.modal = new TerminalModal(this);
    const compactHeader = W < 760;

    const buttons = [
      { label: '[ 固定价挂售 ]', x: W * 0.2, action: () => this.promptList('fixed') },
      { label: '[ 拍卖挂售 ]', x: W * 0.4, action: () => this.promptList('auction') },
      { label: '[ 互换挂售 ]', x: W * 0.6, action: () => this.promptList('swap') },
      { label: '[ 刷新列表 ]', x: W * 0.8, action: () => this.requestListings() },
    ];

    buttons.forEach((button, index) => {
      const col = compactHeader ? index % 2 : index;
      const row = compactHeader ? Math.floor(index / 2) : 0;
      const x = compactHeader ? W * (0.3 + col * 0.4) : button.x;
      const y = compactHeader ? 72 + row * 34 : 70;

      this.add.text(x, y, button.label, {
        fontSize: '14px', fontFamily: 'monospace', color: '#39ff14',
        backgroundColor: '#001a00', padding: { x: 10, y: 6 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', button.action);
    });

    this.add.text(14, compactHeader ? 134 : 98, 'ID     NFA     RARITY      TYPE       PRICE/BID           SELLER        ACTION', {
      fontSize: '11px', fontFamily: 'monospace', color: '#555555',
    });
    this.add.rectangle(W / 2, compactHeader ? 146 : 110, W - 28, 1, 0x333333);

    const prevBtn = this.add.text(W / 2 - 60, H - 52, '[ ← 上一页 ]', {
      fontSize: '14px', fontFamily: 'monospace', color: '#39ff14',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const nextBtn = this.add.text(W / 2 + 60, H - 52, '[ 下一页 → ]', {
      fontSize: '14px', fontFamily: 'monospace', color: '#39ff14',
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
      fontSize: '14px', fontFamily: 'monospace', color: '#ffaa00',
      align: 'center', wordWrap: { width: W - 40 },
    }).setOrigin(0.5);

    this.add.text(W / 2, H - 24, '[ ESC 返回避难所 ]', {
      fontSize: '14px', fontFamily: 'monospace', color: '#39ff14',
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
      } else if (result.action === 'acceptSwap') {
        this.showStatus('互换成功，链上所有权已更新', '#39ff14');
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
      });
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offListings();
      offResult();
      offWallet();
      offWalletNfas();
      offSwitchNfa();
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
      title: '选择挂售模式',
      subtitle: '固定价立即成交，拍卖持续 24 小时，互换指定另一只 NFA。',
      options: [
        { label: '固定价挂售', description: '输入一个 BNB 价格，任何人都能直接购买。', onSelect: () => this.promptList('fixed') },
        { label: '拍卖挂售', description: '设置起拍价，24 小时后由最高出价者成交。', onSelect: () => this.promptList('auction') },
        { label: '互换挂售', description: '指定另一只 NFA，只有目标 NFA 的持有者能接受。', onSelect: () => this.promptList('swap') },
      ],
    });
  }

  private requestListings() {
    this.showStatus('读取链上市场中...', '#ffaa00');
    eventBus.emit('market:requestListings');
  }

  private promptList(mode: 'fixed' | 'auction' | 'swap') {
    if (mode === 'swap') {
      const candidates = this.walletNfaIds.filter((id) => id !== this.nfaId);
      if (candidates.length === 0) {
        this.showStatus('你没有其他 NFA 可作为互换目标', '#666666');
        return;
      }

      this.modal.showMenu({
        title: '互换挂售',
        subtitle: `当前挂出的 NFA 是 #${this.nfaId}。选择你想换到手的目标 NFA。`,
        options: candidates.map((id) => ({
          label: `目标 NFA #${id}`,
          description: this.walletSummaries[id]
            ? `Lv.${this.walletSummaries[id].level} · ${TYPE_NAMES[2]}目标`
            : '链上可用 NFA',
          onSelect: () => eventBus.emit('market:list', { nfaId: this.nfaId, mode: 'swap', targetNfaId: id }),
        })),
      });
      return;
    }

    const defaultValue = mode === 'fixed' ? '0.10' : '0.05';
    this.modal.showForm({
      title: mode === 'fixed' ? '固定价挂售' : '拍卖挂售',
      subtitle: mode === 'fixed'
        ? `挂售 NFA #${this.nfaId}，输入你希望收到的 BNB 固定价。`
        : `挂售 NFA #${this.nfaId}，输入拍卖起拍价。拍卖持续 24 小时。`,
      fields: [
        {
          name: 'price',
          label: mode === 'fixed' ? '固定价 BNB' : '起拍价 BNB',
          type: 'number',
          value: defaultValue,
          placeholder: defaultValue,
        },
      ],
      submitLabel: '发起挂售',
      onSubmit: (values) => {
        if (!values.price || Number(values.price) <= 0) {
          this.showStatus('请输入有效价格', '#ff4444');
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
    const compactHeader = W < 760;
    const pageItems = this.listings.slice(this.page * this.PER_PAGE, this.page * this.PER_PAGE + this.PER_PAGE);

    if (pageItems.length === 0) {
      const empty = this.add.text(W / 2, 180, '没有活跃中的链上挂单', {
        fontSize: '16px', fontFamily: 'monospace', color: '#666666',
      }).setOrigin(0.5);
      const pageInfo = this.add.text(W / 2, this.cameras.main.height - 96, '第 0 / 0 页', {
        fontSize: '12px', fontFamily: 'monospace', color: '#555555',
      }).setOrigin(0.5);
      this.rows.push(empty, pageInfo);
      return;
    }

    pageItems.forEach((item, index) => {
      const baseY = compactHeader ? 164 : 126;
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

      const rowBg = this.add.rectangle(W / 2, y + (isCompact ? 18 : 10), W - 30, isCompact ? 68 : 40, 0x111122, 0.5)
        .setStrokeStyle(1, 0x222233)
        .setInteractive({ useHandCursor: true });
      rowBg.on('pointerover', () => rowBg.setFillStyle(0x222244, 0.8));
      rowBg.on('pointerout', () => rowBg.setFillStyle(0x111122, 0.5));

      const rowText = this.add.text(
        16,
        y,
        isCompact
          ? `#${item.listingId}  NFA ${item.nfaId}  ${TYPE_NAMES[item.listingType]}\n${RARITY_NAMES[item.rarity]}  ·  ${mainValue}\n卖家 ${sellerShort}`
          : `${String(item.listingId).padEnd(6)} ${String(item.nfaId).padEnd(7)} ${RARITY_NAMES[item.rarity].padEnd(11)} ${TYPE_NAMES[item.listingType].padEnd(10)} ${mainValue.padEnd(18)} ${sellerShort.padEnd(13)}`,
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

    const totalPages = Math.ceil(this.listings.length / this.PER_PAGE);
    const pageInfo = this.add.text(W / 2, this.cameras.main.height - 96,
      `第 ${this.page + 1} / ${totalPages} 页  (共 ${this.listings.length} 条)`, {
        fontSize: '12px', fontFamily: 'monospace', color: '#555555',
      }).setOrigin(0.5);
    this.rows.push(pageInfo);
  }

  private handleListingAction(item: Listing, isMine: boolean, auctionEnded: boolean) {
    if (isMine) {
      this.modal.showMenu({
        title: '取消挂单',
        subtitle: `确认取消 Listing #${item.listingId} 吗？链上托管的 NFA 会返回给卖家。`,
        options: [
          { label: '确认取消', description: `NFA #${item.nfaId}`, onSelect: () => eventBus.emit('market:cancel', { listingId: item.listingId }) },
        ],
      });
      return;
    }

    if (item.listingType === 0) {
      this.modal.showMenu({
        title: '购买 NFA',
        subtitle: `确认用 ${item.price} BNB 购买 NFA #${item.nfaId} 吗？`,
        options: [
          { label: '确认购买', description: `Listing #${item.listingId}`, onSelect: () => eventBus.emit('market:buy', { listingId: item.listingId, price: item.price }) },
        ],
      });
      return;
    }

    if (item.listingType === 1 && auctionEnded) {
      this.modal.showMenu({
        title: '结算拍卖',
        subtitle: `拍卖已结束。确认结算 Listing #${item.listingId} 吗？`,
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
        subtitle: `当前最低有效出价约为 ${base.toFixed(4)} BNB。`,
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
        subtitle: `你将交出 NFA #${item.swapTargetId}，换入对方的 NFA #${item.nfaId}。`,
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
    this.scene.start('ShelterScene', { nfaId: this.nfaId, shelter: this.shelter, personality: this.personality, playerPosition: this.playerPosition });
  }
}
