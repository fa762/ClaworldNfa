import * as Phaser from 'phaser';
import { eventBus } from '../EventBus';

interface Listing {
  listingId: number;
  nfaId: number;
  seller: string;
  price: string;     // BNB
  listingType: number; // 0=fixed, 1=auction
  name: string;
  rarity: number;
}

const RARITY_COLORS = ['#aaaaaa', '#3399ff', '#aa44ff', '#ffd700', '#ff4444'];
const RARITY_NAMES = ['Common', 'Rare', 'Epic', 'Legendary', 'Mythic'];

/**
 * MarketScene — 交易墙
 * 显示当前市场挂售列表，支持购买/挂售
 */
export class MarketScene extends Phaser.Scene {
  private nfaId = 0;
  private shelter = 0;
  private listings: Listing[] = [];
  private page = 0;
  private readonly PER_PAGE = 5;

  constructor() {
    super({ key: 'MarketScene' });
  }

  init(data: { nfaId: number; shelter: number }) {
    this.nfaId = data.nfaId || 1;
    this.shelter = data.shelter || 0;
  }

  create() {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    this.add.rectangle(W / 2, H / 2, W, H, 0x0a0a0a, 0.95);

    // 标题
    this.add.text(W / 2, 24, '[ 交易墙 ]', {
      fontSize: '16px', fontFamily: 'monospace', color: '#3399ff',
    }).setOrigin(0.5);

    this.add.text(W / 2, 46, 'MARKET — 浏览 / 购买 / 挂售', {
      fontSize: '10px', fontFamily: 'monospace', color: '#3399ff',
    }).setOrigin(0.5).setAlpha(0.6);

    // 操作按钮栏
    const btnY = 68;
    const listBtn = this.add.text(W / 2 - 100, btnY, '[ 挂售我的 NFA ]', {
      fontSize: '11px', fontFamily: 'monospace', color: '#ffd700',
      backgroundColor: '#1a1a00', padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    const refreshBtn = this.add.text(W / 2 + 100, btnY, '[ 刷新列表 ]', {
      fontSize: '11px', fontFamily: 'monospace', color: '#39ff14',
      backgroundColor: '#001a00', padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    listBtn.on('pointerdown', () => this.showListPanel());
    refreshBtn.on('pointerdown', () => this.requestListings());

    // 列表区域
    this.add.text(16, 95, '  ID    NAME              RARITY      PRICE       TYPE', {
      fontSize: '9px', fontFamily: 'monospace', color: '#555555',
    });
    this.add.rectangle(W / 2, 105, W - 32, 1, 0x333333);

    // 请求市场数据
    this.requestListings();

    // 监听市场数据
    eventBus.on('market:listings', (data: unknown) => {
      this.listings = data as Listing[];
      this.renderListings();
    });

    // 监听购买结果
    eventBus.on('market:buyResult', (res: unknown) => {
      const result = res as { success: boolean; error?: string };
      const msg = result.success ? '购买成功!' : `失败: ${result.error}`;
      const color = result.success ? '#39ff14' : '#ff4444';
      this.add.text(W / 2, H / 2, msg, {
        fontSize: '14px', fontFamily: 'monospace', color,
        backgroundColor: '#000000', padding: { x: 12, y: 8 },
      }).setOrigin(0.5).setDepth(100);
      if (result.success) this.time.delayedCall(1500, () => this.requestListings());
    });

    // 分页
    const prevBtn = this.add.text(W / 2 - 60, H - 50, '[ ← 上一页 ]', {
      fontSize: '10px', fontFamily: 'monospace', color: '#39ff14',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const nextBtn = this.add.text(W / 2 + 60, H - 50, '[ 下一页 → ]', {
      fontSize: '10px', fontFamily: 'monospace', color: '#39ff14',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    prevBtn.on('pointerdown', () => { if (this.page > 0) { this.page--; this.renderListings(); } });
    nextBtn.on('pointerdown', () => {
      if ((this.page + 1) * this.PER_PAGE < this.listings.length) { this.page++; this.renderListings(); }
    });

    // 返回
    this.add.text(W / 2, H - 25, '[ ESC 返回避难所 ]', {
      fontSize: '10px', fontFamily: 'monospace', color: '#39ff14',
    }).setOrigin(0.5).setAlpha(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.goBack());
    this.input.keyboard!.on('keydown-ESC', () => this.goBack());
  }

  private requestListings() {
    eventBus.emit('market:requestListings');
    // 同时生成模拟数据（MVP，后续从链上读取）
    this.listings = this.generateMockListings();
    this.renderListings();
  }

  private renderListings() {
    const W = this.cameras.main.width;
    // 清除旧列表（tag 标记的对象）
    this.children.list
      .filter(c => c.getData('listingRow'))
      .forEach(c => c.destroy());

    const start = this.page * this.PER_PAGE;
    const pageItems = this.listings.slice(start, start + this.PER_PAGE);

    if (pageItems.length === 0) {
      const empty = this.add.text(W / 2, 180, '暂无挂售', {
        fontSize: '12px', fontFamily: 'monospace', color: '#555555',
      }).setOrigin(0.5);
      empty.setData('listingRow', true);
      return;
    }

    pageItems.forEach((item, i) => {
      const y = 118 + i * 36;
      const rarityColor = RARITY_COLORS[item.rarity] || '#aaaaaa';
      const typeLabel = item.listingType === 0 ? '固定价' : '拍卖';

      // 行背景（悬停高亮）
      const rowBg = this.add.rectangle(W / 2, y + 8, W - 40, 32, 0x111122, 0.5)
        .setInteractive({ useHandCursor: true })
        .setData('listingRow', true);

      const text = this.add.text(20, y,
        `  #${String(item.nfaId).padEnd(5)} ${item.name.padEnd(18)} ${RARITY_NAMES[item.rarity].padEnd(12)} ${item.price.padEnd(12)} ${typeLabel}`, {
        fontSize: '10px', fontFamily: 'monospace', color: rarityColor,
      }).setData('listingRow', true);

      // 购买按钮
      const buyBtn = this.add.text(W - 60, y + 2, '[ 购买 ]', {
        fontSize: '9px', fontFamily: 'monospace', color: '#ffd700',
        backgroundColor: '#1a1a00', padding: { x: 4, y: 2 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setData('listingRow', true);

      rowBg.on('pointerover', () => rowBg.setFillStyle(0x222244, 0.8));
      rowBg.on('pointerout', () => rowBg.setFillStyle(0x111122, 0.5));

      buyBtn.on('pointerdown', () => {
        eventBus.emit('market:buy', { listingId: item.listingId, price: item.price, nfaId: item.nfaId });
      });
    });

    // 页码
    const pageInfo = this.add.text(this.cameras.main.width / 2, this.cameras.main.height - 68,
      `第 ${this.page + 1} / ${Math.ceil(this.listings.length / this.PER_PAGE)} 页  (共 ${this.listings.length} 条)`, {
      fontSize: '9px', fontFamily: 'monospace', color: '#555555',
    }).setOrigin(0.5).setData('listingRow', true);
  }

  private showListPanel() {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.7).setDepth(50);
    const panel = this.add.rectangle(W / 2, H / 2, 280, 150, 0x111122).setDepth(51)
      .setStrokeStyle(1, 0xffd700);

    this.add.text(W / 2, H / 2 - 50, `挂售 NFA #${this.nfaId}`, {
      fontSize: '13px', fontFamily: 'monospace', color: '#ffd700',
    }).setOrigin(0.5).setDepth(52);

    this.add.text(W / 2, H / 2 - 20, '价格将在钱包确认时输入', {
      fontSize: '9px', fontFamily: 'monospace', color: '#888888',
    }).setOrigin(0.5).setDepth(52);

    const confirmBtn = this.add.text(W / 2 - 50, H / 2 + 30, '[ 确认挂售 ]', {
      fontSize: '11px', fontFamily: 'monospace', color: '#39ff14',
    }).setOrigin(0.5).setDepth(52).setInteractive({ useHandCursor: true });

    const cancelBtn = this.add.text(W / 2 + 50, H / 2 + 30, '[ 取消 ]', {
      fontSize: '11px', fontFamily: 'monospace', color: '#ff4444',
    }).setOrigin(0.5).setDepth(52).setInteractive({ useHandCursor: true });

    confirmBtn.on('pointerdown', () => {
      eventBus.emit('market:list', { nfaId: this.nfaId, price: '0.1' });
      overlay.destroy(); panel.destroy(); confirmBtn.destroy(); cancelBtn.destroy();
    });

    cancelBtn.on('pointerdown', () => {
      overlay.destroy(); panel.destroy(); confirmBtn.destroy(); cancelBtn.destroy();
    });
  }

  private generateMockListings(): Listing[] {
    const names = ['CW-0042', 'CW-0187', 'CW-0331', 'CW-0099', 'CW-0556', 'CW-0712', 'CW-0028'];
    return names.map((name, i) => ({
      listingId: 1000 + i,
      nfaId: 42 + i * 30,
      seller: `0x${(i + 1).toString(16).padStart(4, '0')}...`,
      price: (0.05 + Math.random() * 0.5).toFixed(3) + ' BNB',
      listingType: i % 3 === 0 ? 1 : 0,
      name,
      rarity: Math.min(i % 5, 4),
    }));
  }

  private goBack() {
    this.scene.start('ShelterScene', { nfaId: this.nfaId, shelter: this.shelter });
  }
}
