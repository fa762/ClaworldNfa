import * as Phaser from 'phaser';

import { loadNFAState } from '../chain/wallet';
import type { GameLang } from '../data/npc-dialogues';
import { buildIdentityFromState } from '@/lib/lobsterIdentity';
import { getRarityName } from '@/lib/rarity';
import { getShelterName, getShelterSpecialty } from '@/lib/shelter';

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

interface ArchiveSceneData {
  nfaId: number;
  shelter: number;
  personality?: Personality;
  playerPosition?: PlayerPosition;
  lang?: GameLang;
}

export class ArchiveScene extends Phaser.Scene {
  private nfaId = 0;
  private shelter = 0;
  private personality?: Personality;
  private playerPosition?: PlayerPosition;
  private lang: GameLang = 'zh';

  constructor() {
    super({ key: 'ArchiveScene' });
  }

  init(data: ArchiveSceneData) {
    this.nfaId = data.nfaId || (this.registry.get('nfaId') as number) || 1;
    this.shelter = data.shelter || (this.registry.get('shelter') as number) || 0;
    this.personality = data.personality || (this.registry.get('personality') as Personality | undefined);
    this.playerPosition = data.playerPosition || (this.registry.get('playerPosition') as PlayerPosition | undefined);
    this.lang = data.lang || (this.registry.get('gameLang') as GameLang) || 'zh';
  }

  create() {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    this.add.rectangle(W / 2, H / 2, W, H, 0x070909, 0.96);
    this.add.text(W / 2, 28, this.lang === 'zh' ? '[ 龙虾档案 ]' : '[ LOBSTER DOSSIER ]', {
      fontSize: '24px', fontFamily: 'monospace', color: '#39ff14',
    }).setOrigin(0.5);

    this.add.text(W / 2, 52, this.lang === 'zh' ? `NFA #${this.nfaId} · 链上身份档案` : `NFA #${this.nfaId} · Onchain identity dossier`, {
      fontSize: '13px', fontFamily: 'monospace', color: '#7adf8b',
    }).setOrigin(0.5).setAlpha(0.7);

    const loading = this.add.text(W / 2, H / 2, this.lang === 'zh' ? '读取档案中...' : 'Loading dossier...', {
      fontSize: '16px', fontFamily: 'monospace', color: '#ffd700',
    }).setOrigin(0.5);

    void (async () => {
      const state = await loadNFAState(this.nfaId);
      loading.destroy();

      const identity = buildIdentityFromState(state, this.lang);
      const specialty = getShelterSpecialty(state.shelter, this.lang);

      this.add.rectangle(W / 2, H / 2 + 8, Math.min(W - 28, 560), Math.min(H - 120, 420), 0x10151a, 0.92)
        .setStrokeStyle(1, 0x39ff14, 0.25);

      this.add.text(32, 86, identity.title, {
        fontSize: '22px', fontFamily: 'monospace', color: '#ffffff',
      });
      this.add.text(32, 114, identity.subtitle, {
        fontSize: '13px', fontFamily: 'monospace', color: '#7adf8b',
      });

      const meta = [
        `${this.lang === 'zh' ? '稀有度' : 'Rarity'}: ${getRarityName(state.rarity, this.lang === 'zh')}`,
        `${this.lang === 'zh' ? '避难所' : 'Shelter'}: ${getShelterName(state.shelter)}`,
        `${this.lang === 'zh' ? '状态' : 'Status'}: ${state.active ? (this.lang === 'zh' ? '激活' : 'Active') : (this.lang === 'zh' ? '休眠' : 'Dormant')}`,
        `CLW: ${state.clwBalance.toFixed(0)}`,
      ];

      meta.forEach((line, index) => {
        this.add.text(32, 152 + index * 22, line, {
          fontSize: '12px', fontFamily: 'monospace', color: '#b3c5b7',
        });
      });

      this.add.text(32, 250, this.lang === 'zh' ? `避难所偏向：${specialty.text}` : `Shelter bias: ${specialty.text}`, {
        fontSize: '12px', fontFamily: 'monospace', color: specialty.color,
      });

      this.renderBar(32, 290, this.lang === 'zh' ? '勇气' : 'Courage', state.courage, 0xff6666);
      this.renderBar(32, 320, this.lang === 'zh' ? '智慧' : 'Wisdom', state.wisdom, 0x66b3ff);
      this.renderBar(32, 350, this.lang === 'zh' ? '社交' : 'Social', state.social, 0xffcc66);
      this.renderBar(32, 380, this.lang === 'zh' ? '创造' : 'Create', state.create, 0xc081ff);
      this.renderBar(32, 410, this.lang === 'zh' ? '毅力' : 'Grit', state.grit, 0x66ff99);

      this.add.text(W - 196, 152, 'STR', { fontSize: '14px', fontFamily: 'monospace', color: '#ff8585' });
      this.add.text(W - 120, 152, String(state.str), { fontSize: '14px', fontFamily: 'monospace', color: '#ffffff' });
      this.add.text(W - 196, 180, 'DEF', { fontSize: '14px', fontFamily: 'monospace', color: '#89d4ff' });
      this.add.text(W - 120, 180, String(state.def), { fontSize: '14px', fontFamily: 'monospace', color: '#ffffff' });
      this.add.text(W - 196, 208, 'SPD', { fontSize: '14px', fontFamily: 'monospace', color: '#ffe084' });
      this.add.text(W - 120, 208, String(state.spd), { fontSize: '14px', fontFamily: 'monospace', color: '#ffffff' });
      this.add.text(W - 196, 236, 'VIT', { fontSize: '14px', fontFamily: 'monospace', color: '#8cffb5' });
      this.add.text(W - 120, 236, String(state.vit), { fontSize: '14px', fontFamily: 'monospace', color: '#ffffff' });

      const summary = this.lang === 'zh'
        ? '这只龙虾的身份由其主导性格、所在避难所与稀有度共同塑造。'
        : 'This lobster identity is shaped by its dominant traits, shelter origin, and rarity.';

      this.add.text(W - 196, 286, summary, {
        fontSize: '12px', fontFamily: 'monospace', color: '#8ea694',
        wordWrap: { width: 160 },
      });
    })().catch((error) => {
      console.error('Failed to load dossier:', error);
      loading.setText(this.lang === 'zh' ? '读取档案失败' : 'Failed to load dossier');
      loading.setColor('#ff6666');
    });

    this.add.text(W / 2, H - 24, this.lang === 'zh' ? '[ ESC 返回避难所 ]' : '[ ESC BACK TO SHELTER ]', {
      fontSize: '14px', fontFamily: 'monospace', color: '#39ff14',
    }).setOrigin(0.5).setAlpha(0.6).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.goBack());

    this.input.keyboard?.on('keydown-ESC', () => this.goBack());
  }

  private renderBar(x: number, y: number, label: string, value: number, color: number) {
    this.add.text(x, y, label, {
      fontSize: '12px', fontFamily: 'monospace', color: '#a7b8aa',
    });
    this.add.rectangle(x + 112, y + 8, 120, 8, 0x1c2225, 1).setOrigin(0, 0.5);
    this.add.rectangle(x + 112, y + 8, Math.min(120, (value / 100) * 120), 8, color, 0.95).setOrigin(0, 0.5);
    this.add.text(x + 242, y, String(value), {
      fontSize: '12px', fontFamily: 'monospace', color: '#ffffff',
    });
  }

  private goBack() {
    this.scene.start('ShelterScene', {
      nfaId: this.nfaId,
      shelter: this.shelter,
      personality: this.personality,
      playerPosition: this.playerPosition,
      lang: this.lang,
    });
  }
}
