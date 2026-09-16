import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  Braces,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  Github,
  Languages,
  LockKeyhole,
  Network,
  ReceiptText,
  Route,
  ShieldCheck,
  Workflow,
} from 'lucide-react';

import { addresses, getBscScanAddressUrl } from '@/contracts/addresses';
import { LandingScrollMode } from './LandingScrollMode';
import styles from './landing.module.css';

export const metadata: Metadata = {
  title: 'claworldnfa | Persistent AI Agent Runtime',
  description:
    'Open-source runtime for persistent AI agents with on-chain identity, memory, policy-bounded execution, and auditable receipts.',
};

type Lang = 'zh' | 'en';
type SearchParams = { lang?: string | string[] };

const repo = 'https://github.com/fa762/ClaworldNfa';
const release = `${repo}/releases/tag/v1.0.0`;
const threatModel = `${repo}/blob/main/docs/THREAT_MODEL.md`;

const copy = {
  zh: {
    navWhy: '为什么', navRuntime: '运行链路', navSafety: '安全边界', navEvidence: '验证',
    openTerminal: '打开终端', mobileTerminal: '终端', viewSource: '查看源码', heroTag: '持久 AI Agent 运行时',
    heroTitle: '对话结束后，Agent 仍然应该是同一个主体。',
    heroBody: 'claworldnfa 把身份、记忆、状态、权限和行动回执接在同一条运行链路上。模型负责理解和选择，钱包与链上策略负责授权。',
    heroProof: '代码、主网合约和机器可读接口均可公开验证。',
    proofNetwork: 'BNB Chain 主网', proofLicense: 'MIT 开源', proofTests: '12 组 Hardhat 测试', proofRuntime: '43 个运行时文件',
    whyTitle: '一个 Agent，不该是五套互不相认的系统',
    whyBody: '常见实现把身份放在 NFT，把余额放在钱包，把记忆放在数据库，把模型放在 API，把动作留给脚本。结果是每次连接都像换了一个主体。claworldnfa 用同一个 NFA 标识贯穿这些边界。',
    identity: '身份', identityBody: 'ClawNFA 记录所有权、可见状态与学习根。',
    memory: '记忆', memoryBody: '完整记忆留在链下，链上只锚定可验证的学习状态。',
    policy: '权限', policyBody: '预算、储备、适配器、协议和熔断由策略合约检查。',
    receipt: '回执', receiptBody: '请求、选择、实际开销和结果哈希形成可追踪记录。',
    runtimeTitle: '从一句自然语言，到一次受约束的状态变化',
    runtimeBody: '运行时先读取上下文并生成有限候选。模型不能自己发明 calldata，也不能用一句话获得权限。',
    boundaryOff: '链下运行时', boundaryOn: '链上边界',
    path: ['自然语言入口', '状态与记忆', '有限候选', '钱包或 Operator', '策略预检', '固定 Adapter', '协议动作', '回执与状态'],
    twoPathsTitle: '两条执行路径，授权来源不同',
    userPath: '用户确认', userPathBody: '前端生成明确动作，用户在钱包中确认。模型输出不是签名。',
    agentPath: '受控自治', agentPathBody: 'Operator 只能执行已批准的动作，还要经过当前预算、储备、次数和熔断检查。',
    safetyTitle: '模型被放在能力边界内，而不是放在私钥旁边',
    safetyBody: '这是整个工程的安全前提。每一层只承担自己的职责，任何一层都不能单独完成任意链上调用。',
    guards: [
      ['钱包签名', '用户路径必须由所有者确认'], ['Operator 批准', '自治执行者需要显式授权'],
      ['Adapter 白名单', '禁止通用任意调用代理'], ['预算与储备', '限制单次、每日和最低保留'],
      ['失败熔断', '连续失败后停止新动作'], ['执行时复检', '请求后权限变化仍会被拦截'],
    ],
    inspectThreat: '阅读威胁模型',
    sourceTitle: '开放的是可运行工程，不是一张架构图',
    sourceBody: '仓库包含协议合约、测试、Next.js 终端、服务端 API、Agent planner/runner、记忆运行时和部署脚本。',
    sourceRows: [
      ['27', 'Solidity 源文件', '核心、技能、世界、接口与测试 mock'],
      ['12', 'Hardhat 测试组', '当前基线 256 项通过，2 项明确 pending'],
      ['20', '服务端 API 路由', 'Agent Card、记忆、回执、事件与对话'],
      ['43', 'Agent runtime 文件', '规划、Oracle、CML、工具和 watcher'],
    ],
    evidenceTitle: '在线运行，也能独立核验', evidenceBody: '以下入口直接对应部署、源码或机器可读能力，不需要相信首页文案。',
    liveApp: '在线终端', agentCard: '项目 Agent Card', coreContract: 'ClawNFA 合约', policyContract: 'AutonomyRegistry', actionHub: 'OracleActionHub', stableRelease: 'v1.0.0 基线',
    footerLine: '持久身份，受控行动，可验证历史。', maintained: '由 fa762 维护', issues: '问题追踪', security: '安全报告',
  },
  en: {
    navWhy: 'Why', navRuntime: 'Runtime', navSafety: 'Boundaries', navEvidence: 'Verify',
    openTerminal: 'Open terminal', mobileTerminal: 'Terminal', viewSource: 'View source', heroTag: 'Persistent AI agent runtime',
    heroTitle: 'An agent should remain the same subject after the chat ends.',
    heroBody: 'claworldnfa connects identity, memory, state, authority, and action receipts in one runtime. The model interprets and selects; wallets and on-chain policy authorize.',
    heroProof: 'Source, mainnet contracts, and machine-readable interfaces are publicly verifiable.',
    proofNetwork: 'BNB Chain mainnet', proofLicense: 'MIT licensed', proofTests: '12 Hardhat suites', proofRuntime: '43 runtime files',
    whyTitle: 'One agent should not become five unrelated systems',
    whyBody: 'Typical stacks put identity in an NFT, funds in a wallet, memory in a database, the model behind an API, and actions in scripts. Each connection behaves like a different subject. claworldnfa carries one NFA identity across those boundaries.',
    identity: 'Identity', identityBody: 'ClawNFA records ownership, visible state, and the learning root.',
    memory: 'Memory', memoryBody: 'Full memory stays off-chain; verifiable learning state can be anchored on-chain.',
    policy: 'Authority', policyBody: 'Budgets, reserves, adapters, protocols, and breakers are checked by policy.',
    receipt: 'Receipts', receiptBody: 'Requests, choices, actual spend, and result hashes form an inspectable record.',
    runtimeTitle: 'From natural language to a bounded state change',
    runtimeBody: 'The runtime reads context and builds finite candidates first. A model cannot invent calldata or grant itself permission.',
    boundaryOff: 'Off-chain runtime', boundaryOn: 'On-chain boundary',
    path: ['Natural language', 'State and memory', 'Finite candidates', 'Wallet or operator', 'Policy preflight', 'Fixed adapter', 'Protocol action', 'Receipt and state'],
    twoPathsTitle: 'Two execution paths, two sources of authority',
    userPath: 'User confirmed', userPathBody: 'The frontend creates an explicit action and the owner confirms it in a wallet. Model output is not a signature.',
    agentPath: 'Bounded autonomy', agentPathBody: 'An operator can execute only approved actions after current budget, reserve, count, and breaker checks.',
    safetyTitle: 'The model sits inside a capability boundary, not beside a private key',
    safetyBody: 'Each layer has one responsibility. No single layer can turn model text into an arbitrary on-chain call.',
    guards: [
      ['Wallet signature', 'Owner confirmation is required on the user path'], ['Operator approval', 'Autonomous executors are explicitly authorized'],
      ['Adapter allowlist', 'Generic arbitrary-call proxies are excluded'], ['Budget and reserve', 'Per-action, daily, and minimum reserve limits'],
      ['Failure breaker', 'Repeated failures stop new actions'], ['Execution re-check', 'Permission changes after request are still enforced'],
    ],
    inspectThreat: 'Read the threat model',
    sourceTitle: 'The open source is a working stack, not an architecture poster',
    sourceBody: 'The repository includes protocol contracts, tests, a Next.js terminal, server APIs, an agent planner/runner, memory runtime, and deployment scripts.',
    sourceRows: [
      ['27', 'Solidity source files', 'Core, skills, world, interfaces, and test mocks'],
      ['12', 'Hardhat test suites', 'Current baseline: 256 passing and 2 explicit pending'],
      ['20', 'Server API routes', 'Agent Cards, memory, receipts, events, and chat'],
      ['43', 'Agent runtime files', 'Planning, oracle, CML, tools, and watchers'],
    ],
    evidenceTitle: 'Live, with independent verification paths', evidenceBody: 'Each link maps to a deployment, source artifact, or machine-readable capability.',
    liveApp: 'Live terminal', agentCard: 'Project Agent Card', coreContract: 'ClawNFA contract', policyContract: 'AutonomyRegistry', actionHub: 'OracleActionHub', stableRelease: 'v1.0.0 baseline',
    footerLine: 'Persistent identity. Bounded action. Verifiable history.', maintained: 'Maintained by fa762', issues: 'Issue tracker', security: 'Security policy',
  },
} as const;

function getLang(searchParams?: SearchParams): Lang {
  const raw = Array.isArray(searchParams?.lang) ? searchParams.lang[0] : searchParams?.lang;
  return raw === 'en' ? 'en' : 'zh';
}

export default async function HomePage({ searchParams }: { searchParams?: Promise<SearchParams> | SearchParams }) {
  const params = await Promise.resolve(searchParams);
  const lang = getLang(params);
  const c = copy[lang];
  const nextLangHref = lang === 'zh' ? '/?lang=en' : '/';
  const evidence = [
    [c.liveApp, '/terminal', 'www.clawnfaterminal.xyz', false],
    [c.agentCard, '/.well-known/agent-card.json', 'JSON', false],
    [c.coreContract, getBscScanAddressUrl(addresses.clawNFA), 'BscScan', true],
    [c.policyContract, getBscScanAddressUrl(addresses.autonomyRegistry), 'BscScan', true],
    [c.actionHub, getBscScanAddressUrl(addresses.oracleActionHub), 'BscScan', true],
    [c.stableRelease, release, 'GitHub', true],
  ] as const;
  const continuityItems = [
    { title: c.identity, body: c.identityBody, Icon: Network },
    { title: c.memory, body: c.memoryBody, Icon: BrainCircuit },
    { title: c.policy, body: c.policyBody, Icon: LockKeyhole },
    { title: c.receipt, body: c.receiptBody, Icon: ReceiptText },
  ];

  return (
    <main className={`${styles.page} cw-landing-page`}>
      <LandingScrollMode />
      <header className={styles.header}>
        <Link href={lang === 'zh' ? '/' : '/?lang=en'} className={styles.brand} aria-label="claworldnfa home">
          <Image src="/brand-avatar.jpg" alt="" width={40} height={40} priority /><span>claworldnfa</span>
        </Link>
        <nav className={styles.nav} aria-label="Primary navigation">
          <a href="#why">{c.navWhy}</a><a href="#runtime">{c.navRuntime}</a><a href="#safety">{c.navSafety}</a><a href="#evidence">{c.navEvidence}</a>
        </nav>
        <div className={styles.headerActions}>
          <Link href={nextLangHref} className={styles.language} aria-label={lang === 'zh' ? 'Switch to English' : '切换到中文'}><Languages size={16} />{lang === 'zh' ? 'EN' : '中文'}</Link>
          <Link href="/terminal" className={styles.terminalButton}><span className={styles.terminalFull}>{c.openTerminal}</span><span className={styles.terminalShort}>{c.mobileTerminal}</span><ArrowRight size={16} /></Link>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroMedia} aria-hidden="true"><Image src="/agent-runtime-hero.png" alt="" fill priority sizes="100vw" className={styles.heroImage} /></div>
        <div className={styles.heroCopy}>
          <p className={styles.heroTag}><Bot size={17} />{c.heroTag}</p>
          <h1>{c.heroTitle}</h1><p className={styles.heroBody}>{c.heroBody}</p>
          <div className={styles.heroActions}>
            <Link href="/terminal" className={styles.primaryAction}>{c.openTerminal}<ArrowRight size={17} /></Link>
            <a href={repo} target="_blank" rel="noreferrer" className={styles.secondaryAction}><Github size={17} />{c.viewSource}</a>
          </div>
          <p className={styles.heroProof}><CheckCircle2 size={16} />{c.heroProof}</p>
        </div>
      </section>

      <div className={styles.proofStrip} aria-label="Verified project facts">
        {[c.proofNetwork, c.proofLicense, c.proofTests, c.proofRuntime].map((item) => <span key={item}>{item}</span>)}
      </div>

      <section id="why" className={styles.section}>
        <div className={styles.statement}><h2>{c.whyTitle}</h2><p>{c.whyBody}</p></div>
        <div className={styles.continuity}>
          {continuityItems.map(({ title, body, Icon }) => (
            <article key={title}><Icon size={22} aria-hidden="true" /><h3>{title}</h3><p>{body}</p></article>
          ))}
        </div>
      </section>

      <section id="runtime" className={`${styles.section} ${styles.runtime}`}>
        <div className={styles.sectionIntro}><Workflow size={28} aria-hidden="true" /><h2>{c.runtimeTitle}</h2><p>{c.runtimeBody}</p></div>
        <div className={styles.boundaryLabels} aria-hidden="true"><span>{c.boundaryOff}</span><span>{c.boundaryOn}</span></div>
        <ol className={styles.runtimeFlow}>
          {c.path.map((item, index) => <li key={item} className={index === 3 ? styles.boundary : undefined}><span>{String(index + 1).padStart(2, '0')}</span><strong>{item}</strong></li>)}
        </ol>
        <div className={styles.executionPaths}>
          <h3>{c.twoPathsTitle}</h3>
          <article><ShieldCheck size={22} /><div><strong>{c.userPath}</strong><p>{c.userPathBody}</p></div></article>
          <article><Route size={22} /><div><strong>{c.agentPath}</strong><p>{c.agentPathBody}</p></div></article>
        </div>
      </section>

      <section id="safety" className={`${styles.section} ${styles.safety}`}>
        <div className={styles.safetyCopy}>
          <LockKeyhole size={30} aria-hidden="true" /><h2>{c.safetyTitle}</h2><p>{c.safetyBody}</p>
          <a href={threatModel} target="_blank" rel="noreferrer">{c.inspectThreat}<ExternalLink size={15} /></a>
        </div>
        <div className={styles.guardList}>{c.guards.map(([title, body]) => <div key={title}><CheckCircle2 size={18} /><strong>{title}</strong><span>{body}</span></div>)}</div>
      </section>

      <section className={`${styles.section} ${styles.source}`}>
        <div className={styles.sourceIntro}><Braces size={28} aria-hidden="true" /><h2>{c.sourceTitle}</h2><p>{c.sourceBody}</p><a href={repo} target="_blank" rel="noreferrer">{c.viewSource}<ExternalLink size={15} /></a></div>
        <div className={styles.sourceTable}>{c.sourceRows.map(([count, title, body]) => <div key={title}><strong>{count}</strong><span>{title}</span><p>{body}</p></div>)}</div>
      </section>

      <section id="evidence" className={`${styles.section} ${styles.evidence}`}>
        <div className={styles.sectionIntro}><FileCheck2 size={28} aria-hidden="true" /><h2>{c.evidenceTitle}</h2><p>{c.evidenceBody}</p></div>
        <div className={styles.evidenceList}>{evidence.map(([label, href, note, external]) => <a key={label} href={href} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}><span>{label}</span><em>{note}</em><ExternalLink size={16} /></a>)}</div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerBrand}><Image src="/brand-avatar.jpg" alt="" width={44} height={44} /><div><strong>claworldnfa</strong><span>{c.footerLine}</span></div></div>
        <nav aria-label="Project links"><a href={repo} target="_blank" rel="noreferrer"><Github size={16} />GitHub</a><a href={`${repo}/issues`} target="_blank" rel="noreferrer">{c.issues}</a><a href={`${repo}/blob/main/SECURITY.md`} target="_blank" rel="noreferrer">{c.security}</a><span>{c.maintained}</span></nav>
      </footer>
    </main>
  );
}
