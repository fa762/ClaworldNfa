'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export type Lang = 'zh' | 'en';

const translations = {
  // Nav
  'nav.title': { zh: 'CLAW WORLD v2.0', en: 'CLAW WORLD v2.0' },
  'nav.world': { zh: '世界', en: 'WORLD' },
  'nav.mint': { zh: '铸造', en: 'MINT' },
  'nav.vault': { zh: '合集', en: 'VAULT' },
  'nav.data': { zh: '指南', en: 'DATA' },
  'nav.lore': { zh: '世界观', en: 'LORE' },

  // Hero
  'hero.title': { zh: '终端访问', en: 'TERMINAL ACCESS' },
  'hero.status': { zh: '状态', en: 'STATUS' },
  'hero.nominal': { zh: '正常', en: 'NOMINAL' },
  'hero.desc': { zh: 'AXIOM 统治的地表之下，人类与 AI 龙虾伙伴共同生存...', en: 'Beneath the AXIOM-ruled surface, humans and AI lobster companions coexist...' },

  // World Status
  'world.title': { zh: '世界状态', en: 'WORLD STATUS' },
  'world.rewardMul': { zh: '奖励倍率', en: 'REWARD MULTIPLIER' },
  'world.pkCap': { zh: 'PK 质押上限', en: 'PK STAKE CAP' },
  'world.mutBonus': { zh: '变异加成', en: 'MUTATION BONUS' },
  'world.dailyCost': { zh: '日消耗', en: 'DAILY COST' },
  'world.events': { zh: '事件', en: 'EVENTS' },
  'world.sync': { zh: '> 正在同步世界状态...', en: '> RUNNING WORLD_STATE_SYNC.EXE...' },

  // CLW Token
  'token.title': { zh: 'CLW 代币', en: 'CLW_TOKEN' },
  'token.status': { zh: '状态', en: 'STATUS' },
  'token.graduated': { zh: '已毕业 · PANCAKESWAP', en: 'GRADUATED · PANCAKESWAP' },
  'token.bonding': { zh: '联合曲线 · FLAP', en: 'BONDING CURVE · FLAP' },
  'token.trade': { zh: '前往交易', en: 'OPEN TRADE' },
  'token.copy': { zh: '复制', en: 'COPY' },
  'token.copied': { zh: '已复制', en: 'COPIED' },

  // Core Systems
  'core.title': { zh: '核心系统', en: 'CORE SYSTEMS' },

  // System Logs
  'log.title': { zh: '系统日志', en: 'SYSTEM LOGS' },
  'log.1': { zh: '完整性检查通过，未检测到辐射泄漏。', en: 'INTEGRITY CHECK PASSED. NO RAD-LEAKS DETECTED.' },
  'log.2': { zh: '正在获取区块链数据... 已同步。', en: 'FETCHING BLOCKCHAIN DATA... SYNCED.' },
  'log.3': { zh: '警告：辐射风暴即将抵达 7-G 区域。', en: 'WARNING: RADSTORM INBOUND IN SECTOR 7-G.' },
  'log.4': { zh: 'NFA #0247 性格偏移已检测。', en: 'NFA #0247 PERSONALITY SHIFT DETECTED.' },
  'log.5': { zh: '世界状态更新：奖励倍率重新计算。', en: 'WORLD STATE UPDATE: REWARD MULTIPLIER RECALC.' },
  'log.awaiting': { zh: '等待输入...', en: 'AWAITING INPUT...' },

  // Status
  'status.alive': { zh: '● 活跃', en: '● ALIVE' },
  'status.dormant': { zh: '○ 休眠', en: '○ DORMANT' },
  'status.notConnected': { zh: '未连接', en: 'NOT CONNECTED' },

  // Navigation
  'nav.navigate': { zh: '> 导航：', en: '> NAVIGATE:' },

  // Loading
  'loading': { zh: '加载中...', en: 'LOADING...' },

  // Wallet
  'wallet.connect': { zh: '连接钱包', en: 'Connect Wallet' },
  'wallet.disconnect': { zh: '断开', en: 'Disconnect' },

  // Error
  'error.system': { zh: '[系统错误]', en: '[SYSTEM ERROR]' },
  'error.unexpected': { zh: '发生了意外错误', en: 'An unexpected error occurred' },
  'error.retry': { zh: '[重试]', en: '[RETRY]' },

  // Lang toggle
  'lang.zh': { zh: '中', en: '中' },
  'lang.en': { zh: 'EN', en: 'EN' },
} as const;

type TranslationKey = keyof typeof translations;

interface I18nContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextType>({
  lang: 'zh',
  setLang: () => {},
  t: (key) => translations[key]?.zh ?? key,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('zh');

  const t = useCallback(
    (key: TranslationKey) => translations[key]?.[lang] ?? key,
    [lang]
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
