import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  BookOpenCheck,
  Bot,
  BrainCircuit,
  Boxes,
  ClipboardCheck,
  CircleDollarSign,
  Copy,
  Cpu,
  Database,
  ExternalLink,
  FileCode2,
  Flame,
  Gauge,
  Github,
  Languages,
  Layers3,
  Link2,
  LockKeyhole,
  MessageSquareText,
  Network,
  Pickaxe,
  PlugZap,
  RadioTower,
  ReceiptText,
  Route,
  ScrollText,
  Send,
  ShieldCheck,
  Store,
  Swords,
  WalletCards,
  Workflow,
} from 'lucide-react';

import { addresses, getBscScanAddressUrl } from '@/contracts/addresses';

import styles from './landing.module.css';
import { LandingScrollMode } from './LandingScrollMode';

export const metadata: Metadata = {
  title: 'claworldnfa | Autonomous On-chain NFA',
  description:
    'claworldnfa turns an NFA into a companion with on-chain identity, CML memory, an internal ledger, skill adapters, and bounded AI autonomy.',
};

type Lang = 'zh' | 'en';
type LocalText = Record<Lang, string>;
type SearchParams = { lang?: string | string[] };

type Pillar = { label: string; title: LocalText; body: LocalText; Icon: LucideIcon };
type FlowNode = { label: LocalText; Icon: LucideIcon };
type ModuleCard = { name: string; title: LocalText; body: LocalText; Icon: LucideIcon };
type TechCard = { label: LocalText; title: LocalText; body: LocalText; Icon: LucideIcon };
type ContractCard = { name: string; role: LocalText; address: string; Icon: LucideIcon };

const repositoryUrl = 'https://github.com/fa762/claworldnfa';
const twitterUrl = 'https://x.com/claworldnfa';
const telegramUrl = 'https://t.me/Claworldgroup';

const copy = {
  zh: {
    navMechanism: '机制',
    navSkills: '玩法',
    navEngineering: '工程',
    navContact: '联系',
    enterDapp: '进入 DApp',
    repository: '开源库',
    eyebrow: 'BAP-578 · AI 运行时 · 链上伙伴',
    heroTitle: '让 NFA 成为真正会记忆、会行动的链上存在',
    heroBody: 'claworldnfa 把 NFT 扩展为可对话、可成长、可持有内部账本、可在权限边界内执行链上动作的 AI 伙伴。',
    chipIdentity: '链上身份',
    chipMemory: 'CML 记忆',
    chipLedger: '独立账本',
    chipAutonomy: 'AI 自治',
    baseCurrency: '基础货币',
    nfaContract: 'NFA 合约',
    contractNote: '主网合约',
    contractSummaryTitle: '合约汇总与功能',
    contractSummaryBody: '核心合约拆成身份、账本、世界参数、玩法技能和自治执行层。前端展示动作，链上负责状态、权限和结算。',
    protocolLabel: '机制',
    protocolTitle: 'NFA 不只是头像，它有身份、记忆、资产和行动边界',
    flowLabel: 'AI 动作闭环',
    flowTitle: '从一句话到一次可追踪的链上动作',
    flowNote: 'AI 先识别意图，再生成动作卡。用户确认或 runner 发起后，ActionHub、Oracle、Registry 和 Skill Adapter 会按顺序接管执行。',
    blueprintLabel: '技术剖面',
    blueprintTitle: '工程重点：可控自治，模型不能裸奔调用合约',
    blueprintBody: '前端把自然语言压成动作卡；后端运行时读取 NFA、CML 和世界状态；链上策略决定这次动作能不能执行。这条路径让角色可以自动行动，同时保留预算、权限和审计痕迹。',
    runtimeLabel: '运行时护栏',
    runtimePath: '意图 → 候选动作 → 策略检查 → 回执',
    skillsLabel: '玩法',
    skillsTitle: '玩法是 Skill，AI 通过 Adapter 进入同一套链上接口',
    engineeringLabel: '工程',
    engineeringTitle: '合约、AI 运行时、前端终端共同组成一个完整产品栈',
    frontendTerminal: '前端终端',
    aiRuntime: 'AI 运行时',
    onchainSkills: '链上技能',
    proofLabel: '推理证据',
    proofValue: 'reasoningCid / 动作回执',
    budgetLabel: '资金约束',
    budgetValue: '单次额度 / 日额度 / 保底储备',
    boundaryLabel: '执行边界',
    boundaryValue: '适配器 / 协议 / 执行者租约',
    footerText: '链上 AI 伙伴协议，部署在 BNB Chain。',
    footerTitle: '联系与入口',
    footerHint: '社群、代码和产品入口都在这里。',
    twitter: '推特',
    telegram: '电报群',
    dappShort: '进入产品',
    languageToggle: 'EN',
  },
  en: {
    navMechanism: 'Mechanism',
    navSkills: 'Skills',
    navEngineering: 'Engineering',
    navContact: 'Contact',
    enterDapp: 'Enter DApp',
    repository: 'Open Source',
    eyebrow: 'BAP-578 · AI Runtime · On-chain Companion',
    heroTitle: 'NFA with memory, ledger, and bounded on-chain action',
    heroBody: 'claworldnfa extends NFT ownership into a companion that can talk, grow, hold an internal ledger, and execute allowed on-chain actions.',
    chipIdentity: 'On-chain identity',
    chipMemory: 'CML memory',
    chipLedger: 'Internal ledger',
    chipAutonomy: 'AI autonomy',
    baseCurrency: 'Base Currency',
    nfaContract: 'NFA Contract',
    contractNote: 'Mainnet contract',
    contractSummaryTitle: 'Contract Map & Capabilities',
    contractSummaryBody: 'The stack separates identity, ledger, world parameters, gameplay skills, and autonomous execution. The frontend displays intent; the contracts own state, permission, and settlement.',
    protocolLabel: 'Mechanism',
    protocolTitle: 'NFA is identity, memory, assets, and action boundaries',
    flowLabel: 'AI Action Loop',
    flowTitle: 'From one sentence to one auditable on-chain action',
    flowNote: 'AI parses intent and generates an action card. After user confirmation or runner execution, ActionHub, Oracle, Registry, and Skill Adapter take over in order.',
    blueprintLabel: 'Technical Blueprint',
    blueprintTitle: 'Bounded autonomy: the model never calls contracts naked',
    blueprintBody: 'The frontend compresses natural language into action cards. The runtime reads NFA, CML, and world state. On-chain policy decides whether the action can execute while preserving budgets, permissions, and audit traces.',
    runtimeLabel: 'Runtime Guardrails',
    runtimePath: 'intent → candidate → policy → receipt',
    skillsLabel: 'Skills',
    skillsTitle: 'Gameplay modules are Skills; AI enters through Adapters',
    engineeringLabel: 'Engineering',
    engineeringTitle: 'Contracts, AI runtime, and frontend terminal form one product stack',
    frontendTerminal: 'Frontend Terminal',
    aiRuntime: 'AI Runtime',
    onchainSkills: 'On-chain Skills',
    proofLabel: 'Reasoning proof',
    proofValue: 'reasoningCid / action receipt',
    budgetLabel: 'Budget controls',
    budgetValue: 'per-action cap / daily cap / reserve floor',
    boundaryLabel: 'Execution boundary',
    boundaryValue: 'adapter / protocol / operator lease',
    footerText: 'On-chain AI companion protocol on BNB Chain.',
    footerTitle: 'Contact & Links',
    footerHint: 'Community, source code, and product entry.',
    twitter: 'X / Twitter',
    telegram: 'Telegram',
    dappShort: 'Launch App',
    languageToggle: '中',
  },
} as const;

const pillars: Pillar[] = [
  {
    label: '01',
    title: { zh: '链上身份', en: 'On-chain Identity' },
    body: {
      zh: '每只 NFA 都是 BAP-578 身份载体，合约记录等级、状态、所属钱包和学习根。',
      en: 'Each NFA is a BAP-578 identity anchor with level, state, owner wallet, and learning root recorded by contracts.',
    },
    Icon: Link2,
  },
  {
    label: '02',
    title: { zh: 'CML 记忆', en: 'CML Memory' },
    body: {
      zh: '对话、战斗、挖矿和代理结果可以沉淀为 CML 快照，再用哈希锚定到链上。',
      en: 'Conversation, combat, mining, and agent results can settle into CML snapshots and be anchored on-chain by hash.',
    },
    Icon: BrainCircuit,
  },
  {
    label: '03',
    title: { zh: '独立账本', en: 'Internal Ledger' },
    body: {
      zh: 'ClawRouter 为 NFA 维护内部 Claworld 储备，挖矿、维护、PK 和大逃杀都走同一套账本。',
      en: 'ClawRouter keeps an internal Claworld reserve for each NFA, shared by mining, upkeep, PK, and Battle Royale.',
    },
    Icon: WalletCards,
  },
  {
    label: '04',
    title: { zh: '边界自治', en: 'Bounded Autonomy' },
    body: {
      zh: 'AutonomyRegistry 给 AI 设定预算、适配器、协议、保底储备和失败熔断。',
      en: 'AutonomyRegistry bounds AI with budgets, adapters, protocols, reserve floors, and failure breakers.',
    },
    Icon: ShieldCheck,
  },
];

const flow: FlowNode[] = [
  { label: { zh: '自然语言意图', en: 'Natural-language intent' }, Icon: MessageSquareText },
  { label: { zh: '读取 NFA / 记忆 / 世界状态', en: 'Read NFA / memory / world state' }, Icon: Database },
  { label: { zh: '生成动作卡', en: 'Generate action card' }, Icon: ClipboardCheck },
  { label: { zh: 'ActionHub 建单', en: 'ActionHub request' }, Icon: Route },
  { label: { zh: 'Oracle 推理回执', en: 'Oracle reasoning receipt' }, Icon: RadioTower },
  { label: { zh: '策略检查', en: 'Policy check' }, Icon: ShieldCheck },
  { label: { zh: 'Skill Adapter 执行', en: 'Skill Adapter execution' }, Icon: PlugZap },
  { label: { zh: '链上结果 + CML 更新', en: 'On-chain result + CML update' }, Icon: ScrollText },
];

const modules: ModuleCard[] = [
  {
    name: 'TaskSkill',
    title: { zh: '任务挖矿', en: 'Task Mining' },
    body: { zh: '根据五维性格计算匹配度、世界倍率、冷却和属性成长。', en: 'Computes match score, world multiplier, cooldown, and personality growth from five trait dimensions.' },
    Icon: Pickaxe,
  },
  {
    name: 'PKSkill',
    title: { zh: '策略竞技', en: 'Strategy Arena' },
    body: { zh: 'Commit-reveal 策略对战，结算胜败、奖励、销毁和战斗履历。', en: 'Commit-reveal strategy combat with win/loss settlement, rewards, burns, and battle history.' },
    Icon: Swords,
  },
  {
    name: 'BattleRoyale',
    title: { zh: '大逃杀', en: 'Battle Royale' },
    body: { zh: 'NFA 用账本储备入场，满员后随机淘汰房间，幸存者按质押权重分配奖池。', en: 'NFA joins with ledger reserve; once full, one room is eliminated and survivors split the pool by stake weight.' },
    Icon: Flame,
  },
  {
    name: 'MarketSkill',
    title: { zh: '市场', en: 'Market' },
    body: { zh: '固定价、拍卖、互换挂单，支持 NFA 资产流转。', en: 'Fixed-price listings, auctions, and NFA swaps for asset circulation.' },
    Icon: Store,
  },
];

const stack = [
  { label: 'ClawNFA', Icon: Link2 },
  { label: 'ClawRouter', Icon: Route },
  { label: 'PersonalityEngine', Icon: BrainCircuit },
  { label: 'WorldState', Icon: Cpu },
  { label: 'ClawOracle', Icon: RadioTower },
  { label: 'ActionHub', Icon: ClipboardCheck },
  { label: 'AutonomyRegistry', Icon: ShieldCheck },
  { label: 'Skill Adapters', Icon: PlugZap },
];

const technicalCards: TechCard[] = [
  {
    label: { zh: '动作回执', en: 'Action Receipt' },
    title: { zh: '动作可追踪', en: 'Auditable action' },
    body: {
      zh: 'ActionHub 记录 requestId、payloadHash、capabilityHash、actualSpend、resultHash 和 reasoningCid，执行后能回看完整链路。',
      en: 'ActionHub records requestId, payloadHash, capabilityHash, actualSpend, resultHash, and reasoningCid for post-action review.',
    },
    Icon: ReceiptText,
  },
  {
    label: { zh: '权限引擎', en: 'Policy Engine' },
    title: { zh: 'AI 有边界', en: 'AI has boundaries' },
    body: {
      zh: 'AutonomyRegistry 在链上检查 operator、adapter、protocol、日额度、单次额度、保底储备、失败熔断和租约。',
      en: 'AutonomyRegistry checks operator, adapter, protocol, daily cap, per-action cap, reserve floor, failure breaker, and lease.',
    },
    Icon: LockKeyhole,
  },
  {
    label: { zh: 'CML 记忆', en: 'CML Memory' },
    title: { zh: '记忆可沉淀', en: 'Memory can persist' },
    body: {
      zh: '对话和动作结果进入 CML，再把学习树根写入 NFA。角色的长期状态可以被验证和延续。',
      en: 'Conversation and action results enter CML, then the learning-tree root is written to the NFA for continuity.',
    },
    Icon: BookOpenCheck,
  },
  {
    label: { zh: '经济闭环', en: 'Economy Loop' },
    title: { zh: '账本独立', en: 'Independent ledger' },
    body: {
      zh: 'NFA 使用 ClawRouter 内部储备参与挖矿、PK、大逃杀和维护，钱包资产和角色账本分离。',
      en: 'NFA uses ClawRouter internal reserve for mining, PK, Battle Royale, and upkeep, separating wallet assets from character ledger.',
    },
    Icon: CircleDollarSign,
  },
];

const runtimeRows: Array<{ name: LocalText; detail: LocalText }> = [
  {
    name: { zh: '候选动作', en: 'Bounded choice' },
    detail: { zh: 'AI 在候选动作里选择，不能凭空发明合约调用。', en: 'AI chooses from generated candidates; it cannot invent contract calls.' },
  },
  {
    name: { zh: '执行前检查', en: 'Preflight check' },
    detail: { zh: '执行前再次校验策略，防止请求后权限被改动。', en: 'Policy is checked again before execution to catch permission changes.' },
  },
  {
    name: { zh: '适配器接口', en: 'Adapter surface' },
    detail: { zh: '每个 Skill 通过 adapter 接入统一 action interface。', en: 'Each Skill enters the same action interface through an adapter.' },
  },
  {
    name: { zh: '结果确认', en: 'Finalization' },
    detail: { zh: '动作完成后可进入结果确认和记忆更新。', en: 'After execution, the result can be finalized and memory can update.' },
  },
];

const contractSummary: ContractCard[] = [
  { name: 'ClawNFA', role: { zh: '身份、等级、学习根', en: 'Identity, level, learning root' }, address: addresses.clawNFA, Icon: Link2 },
  { name: 'ClawRouter', role: { zh: 'NFA 内部账本', en: 'NFA internal ledger' }, address: addresses.clawRouter, Icon: WalletCards },
  { name: 'WorldState', role: { zh: '世界参数与倍率', en: 'World parameters and multipliers' }, address: addresses.worldState, Icon: Cpu },
  { name: 'GenesisVault', role: { zh: '铸造与揭示', en: 'Mint and reveal' }, address: addresses.genesisVault, Icon: Boxes },
  { name: 'TaskSkill', role: { zh: '任务挖矿', en: 'Task mining' }, address: addresses.taskSkill, Icon: Pickaxe },
  { name: 'PKSkill', role: { zh: '策略竞技', en: 'Strategy arena' }, address: addresses.pkSkill, Icon: Swords },
  { name: 'BattleRoyale', role: { zh: '房间大逃杀', en: 'Room Battle Royale' }, address: addresses.battleRoyale, Icon: Flame },
  { name: 'AutonomyRegistry', role: { zh: '自治策略边界', en: 'Autonomy policy boundary' }, address: addresses.autonomyRegistry, Icon: ShieldCheck },
  { name: 'OracleActionHub', role: { zh: 'AI 动作中枢', en: 'AI action hub' }, address: addresses.oracleActionHub, Icon: Workflow },
];

function pick(lang: Lang, text: LocalText) {
  return text[lang];
}

function getLang(searchParams?: SearchParams): Lang {
  const raw = Array.isArray(searchParams?.lang) ? searchParams?.lang[0] : searchParams?.lang;
  return raw === 'en' ? 'en' : 'zh';
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const params = await Promise.resolve(searchParams);
  const lang = getLang(params);
  const c = copy[lang];
  const nextLangHref = lang === 'zh' ? '/?lang=en' : '/';

  const heroContracts = [
    {
      label: c.baseCurrency,
      value: addresses.clwToken,
      note: 'Claworld / BEP-20',
      href: getBscScanAddressUrl(addresses.clwToken),
      Icon: CircleDollarSign,
    },
    {
      label: c.nfaContract,
      value: addresses.clawNFA,
      note: c.contractNote,
      href: getBscScanAddressUrl(addresses.clawNFA),
      Icon: FileCode2,
    },
  ];

  return (
    <main className={`${styles.page} cw-landing-page`}>
      <LandingScrollMode />
      <div className={styles.heroBackdrop} aria-hidden="true">
        <Image
          src="/landing-hero.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className={styles.heroImage}
        />
        <div className={styles.heroVeil} />
        <div className={styles.scanGrid} />
        <div className={styles.energyLines}>
          <span />
          <span />
          <span />
        </div>
      </div>
      <div className={styles.depthVeil} aria-hidden="true" />

      <header className={styles.nav}>
        <Link href={lang === 'zh' ? '/' : '/?lang=en'} className={styles.brand} aria-label="claworldnfa home">
          <Image src="/brand-avatar.jpg" alt="" width={42} height={42} className={styles.brandAvatar} />
          <span>claworldnfa</span>
        </Link>
        <nav className={styles.navLinks} aria-label="Primary">
          <a href="#protocol">{c.navMechanism}</a>
          <a href="#skills">{c.navSkills}</a>
          <a href="#stack">{c.navEngineering}</a>
          <a href="#contact">{c.navContact}</a>
          <Link href={nextLangHref} className={styles.langButton} aria-label={lang === 'zh' ? 'Switch to English' : '切换到中文'}>
            <Languages size={14} />
            {c.languageToggle}
          </Link>
          <Link href="/terminal" className={styles.launchButton}>
            {c.enterDapp}
          </Link>
        </nav>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>{c.eyebrow}</p>
          <h1>{c.heroTitle}</h1>
          <p className={styles.lede}>{c.heroBody}</p>
          <div className={styles.heroActions}>
            <Link href="/terminal" className={styles.primaryCta}>
              {c.enterDapp}
            </Link>
            <a href={repositoryUrl} target="_blank" rel="noreferrer" className={styles.secondaryCta}>
              {c.repository}
            </a>
          </div>
          <div className={styles.signalStrip} aria-label="Protocol highlights">
            <span><Link2 size={14} />{c.chipIdentity}</span>
            <span><BrainCircuit size={14} />{c.chipMemory}</span>
            <span><WalletCards size={14} />{c.chipLedger}</span>
            <span><Bot size={14} />{c.chipAutonomy}</span>
          </div>
        </div>

        <div className={styles.heroContracts} aria-label={lang === 'zh' ? '主网合约' : 'Mainnet contracts'}>
          {heroContracts.map(({ label, value, note, href, Icon }) => (
            <a key={label} href={href} target="_blank" rel="noreferrer" className={styles.heroContractRow}>
              <div className={styles.heroContractIcon}>
                <Icon size={17} />
              </div>
              <div>
                <span>{label}</span>
                <strong>{value}</strong>
                <em>{note}</em>
              </div>
              <ExternalLink size={15} />
            </a>
          ))}
        </div>
      </section>

      <section id="protocol" className={styles.section}>
        <div className={styles.sectionHead}>
          <p className={styles.eyebrow}>{c.protocolLabel}</p>
          <h2>{c.protocolTitle}</h2>
        </div>
        <div className={styles.pillarGrid}>
          {pillars.map((item) => (
            <article key={item.label} className={styles.pillar}>
              <div className={styles.cardTop}>
                <span>{item.label}</span>
                <div className={styles.cardIcon}>
                  <item.Icon size={20} strokeWidth={1.8} />
                </div>
              </div>
              <h3>{pick(lang, item.title)}</h3>
              <p>{pick(lang, item.body)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={`${styles.section} ${styles.flowSection}`}>
        <div className={styles.sectionHead}>
          <p className={styles.eyebrow}>{c.flowLabel}</p>
          <h2>{c.flowTitle}</h2>
        </div>
        <div className={styles.flowRail}>
          {flow.map((item, index) => (
            <div key={pick(lang, item.label)} className={styles.flowNode}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div className={styles.flowIcon}>
                <item.Icon size={18} strokeWidth={1.8} />
              </div>
              <strong>{pick(lang, item.label)}</strong>
            </div>
          ))}
        </div>
        <p className={styles.flowNote}>{c.flowNote}</p>
      </section>

      <section className={`${styles.section} ${styles.blueprintSection}`}>
        <div className={styles.blueprintShell}>
          <div className={styles.blueprintIntro}>
            <p className={styles.eyebrow}>{c.blueprintLabel}</p>
            <h2>{c.blueprintTitle}</h2>
            <p>{c.blueprintBody}</p>
          </div>

          <div className={styles.blueprintCards}>
            {technicalCards.map(({ label, title, body, Icon }) => (
              <article key={pick(lang, label)} className={styles.techCard}>
                <div className={styles.cardTop}>
                  <span>{pick(lang, label)}</span>
                  <div className={styles.cardIcon}>
                    <Icon size={20} strokeWidth={1.8} />
                  </div>
                </div>
                <h3>{pick(lang, title)}</h3>
                <p>{pick(lang, body)}</p>
              </article>
            ))}
          </div>

          <div className={styles.runtimePanel}>
            <div className={styles.runtimeHeader}>
              <div>
                <span>{c.runtimeLabel}</span>
                <strong>{c.runtimePath}</strong>
              </div>
              <Gauge size={22} />
            </div>
            <div className={styles.runtimeRows}>
              {runtimeRows.map(({ name, detail }) => (
                <div key={pick(lang, name)}>
                  <strong>{pick(lang, name)}</strong>
                  <span>{pick(lang, detail)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="skills" className={styles.section}>
        <div className={styles.sectionHead}>
          <p className={styles.eyebrow}>{c.skillsLabel}</p>
          <h2>{c.skillsTitle}</h2>
        </div>
        <div className={styles.moduleGrid}>
          {modules.map(({ name, title, body, Icon }) => (
            <article key={name} className={styles.moduleCard}>
              <div className={styles.cardTop}>
                <span>{name}</span>
                <div className={styles.cardIcon}>
                  <Icon size={20} strokeWidth={1.8} />
                </div>
              </div>
              <h3>{pick(lang, title)}</h3>
              <p>{pick(lang, body)}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="stack" className={`${styles.section} ${styles.stackSection}`}>
        <div className={styles.sectionHead}>
          <p className={styles.eyebrow}>{c.engineeringLabel}</p>
          <h2>{c.engineeringTitle}</h2>
        </div>
        <div className={styles.stackGrid}>
          {stack.map((item) => (
            <span key={item.label}>
              <item.Icon size={14} />
              {item.label}
            </span>
          ))}
        </div>
        <div className={styles.engineMap} aria-label={lang === 'zh' ? '工程路径' : 'Engineering path'}>
          <div><Network size={18} /><span>{c.frontendTerminal}</span></div>
          <div><Workflow size={18} /><span>{c.aiRuntime}</span></div>
          <div><Layers3 size={18} /><span>{c.onchainSkills}</span></div>
        </div>
        <div className={styles.auditBox}>
          <div>
            <span>{c.proofLabel}</span>
            <strong>{c.proofValue}</strong>
          </div>
          <div>
            <span>{c.budgetLabel}</span>
            <strong>{c.budgetValue}</strong>
          </div>
          <div>
            <span>{c.boundaryLabel}</span>
            <strong>{c.boundaryValue}</strong>
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.contractSection}`}>
        <div className={styles.contractIntro}>
          <p className={styles.eyebrow}>{c.contractSummaryTitle}</p>
          <h2>{c.contractSummaryTitle}</h2>
          <p>{c.contractSummaryBody}</p>
        </div>
        <div className={styles.contractGrid}>
          {contractSummary.map(({ name, role, address, Icon }) => (
            <a key={name} href={getBscScanAddressUrl(address)} target="_blank" rel="noreferrer" className={styles.contractCard}>
              <div className={styles.contractCardIcon}>
                <Icon size={18} />
              </div>
              <div>
                <strong>{name}</strong>
                <span>{pick(lang, role)}</span>
                <em>{shortAddress(address)}</em>
              </div>
              <ExternalLink size={14} />
            </a>
          ))}
        </div>
      </section>

      <footer id="contact" className={styles.footer}>
        <div className={styles.footerBrandBlock}>
          <span>claworldnfa</span>
          <p>{c.footerText}</p>
        </div>
        <nav className={styles.footerNav} aria-label={c.footerTitle}>
          <div className={styles.footerNavHead}>
            <strong>{c.footerTitle}</strong>
            <em>{c.footerHint}</em>
          </div>
          <a href={twitterUrl} target="_blank" rel="noreferrer" className={styles.footerNavItem}>
            <span className={styles.footerIcon}><ExternalLink size={16} /></span>
            <span><strong>{c.twitter}</strong><em>x.com/claworldnfa</em></span>
          </a>
          <a href={telegramUrl} target="_blank" rel="noreferrer" className={styles.footerNavItem}>
            <span className={styles.footerIcon}><Send size={16} /></span>
            <span><strong>{c.telegram}</strong><em>t.me/Claworldgroup</em></span>
          </a>
          <a href={repositoryUrl} target="_blank" rel="noreferrer" className={styles.footerNavItem}>
            <span className={styles.footerIcon}><Github size={16} /></span>
            <span><strong>{c.repository}</strong><em>github.com/fa762/claworldnfa</em></span>
          </a>
          <Link href="/terminal" className={styles.footerNavItem}>
            <span className={styles.footerIcon}><Copy size={16} /></span>
            <span><strong>{c.dappShort}</strong><em>{c.enterDapp}</em></span>
          </Link>
        </nav>
      </footer>
    </main>
  );
}
