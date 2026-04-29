import { formatUnits, getAddress, isAddress, type Address } from 'viem';

import { publicClient } from '@/app/api/_lib/chain';
import { ERC20ABI } from '@/contracts/abis/ERC20';
import type { TerminalCard, TerminalDetailRow, TerminalTone } from '@/lib/terminal-cards';

type TokenRiskLang = 'zh' | 'en';

type TokenRiskInput = {
  input: string;
  slashCommand?: string;
  lang?: TokenRiskLang;
};

type GoPlusSecurity = Record<string, unknown>;

type BscScanSource = {
  contractName?: string;
  sourceVerified?: boolean;
  proxy?: boolean;
  implementation?: string;
};

type AddressKind = 'wallet' | 'contract' | 'token';

type AddressIdentity = {
  kind: AddressKind;
  bytecode?: string;
  name?: string;
  symbol?: string;
  decimals?: number;
  totalSupply?: bigint;
};

type DexPair = {
  url?: string;
  dexId?: string;
  priceUsd?: string;
  liquidityUsd?: number;
  volume24h?: number;
  marketCap?: number;
  fdv?: number;
  websites: string[];
  socials: string[];
};

type RiskSignal = {
  label: string;
  severity: 'high' | 'medium' | 'low';
};

const BSC_CHAIN_ID = '56';
const CA_RE = /0x[a-fA-F0-9]{40}/;

const ERC20_NAME_ABI = [
  {
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

function pick<T>(lang: TokenRiskLang, zh: T, en: T) {
  return lang === 'en' ? en : zh;
}

function cardId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return '';
}

function asFlag(value: unknown): boolean | null {
  const raw = asString(value).toLowerCase();
  if (!raw) return null;
  if (raw === '1' || raw === 'true' || raw === 'yes') return true;
  if (raw === '0' || raw === 'false' || raw === 'no') return false;
  return null;
}

function asNumber(value: unknown): number | null {
  const raw = asString(value);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatPercent(value: unknown) {
  const parsed = asNumber(value);
  if (parsed === null) return '--';
  const percent = parsed <= 1 ? parsed * 100 : parsed;
  if (percent >= 100) return `${percent.toFixed(0)}%`;
  if (percent >= 10) return `${percent.toFixed(1).replace(/\.0$/, '')}%`;
  return `${percent.toFixed(2).replace(/\.00$/, '')}%`;
}

function taxPercent(value: unknown) {
  const parsed = asNumber(value);
  if (parsed === null) return null;
  return parsed <= 1 ? parsed * 100 : parsed;
}

function boolText(lang: TokenRiskLang, value: boolean | null, positive = true) {
  if (value === null) return '--';
  if (positive) return value ? pick(lang, '是', 'Yes') : pick(lang, '否', 'No');
  return value ? pick(lang, '有', 'Yes') : pick(lang, '无', 'No');
}

function firstString(source: GoPlusSecurity, keys: string[]) {
  for (const key of keys) {
    const value = asString(source[key]);
    if (value) return value;
  }
  return '';
}

function money(value: number | null | undefined) {
  if (!value || value <= 0) return '--';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return `$${value.toFixed(0)}`;
}

function compactSupply(value: bigint | undefined, decimals: number | undefined) {
  if (value === undefined || decimals === undefined) return '--';
  const formatted = Number(formatUnits(value, decimals));
  if (!Number.isFinite(formatted)) return '--';
  if (formatted >= 1_000_000_000) return `${(formatted / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
  if (formatted >= 1_000_000) return `${(formatted / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (formatted >= 1_000) return `${(formatted / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return formatted.toFixed(0);
}

function scoreTone(score: number): TerminalTone {
  if (score < 45) return 'alert';
  if (score < 70) return 'warm';
  return 'growth';
}

function sourceText(lang: TokenRiskLang, value: boolean | null) {
  if (value === null) return '--';
  return value ? pick(lang, '已开源', 'Verified') : pick(lang, '未开源', 'Not verified');
}

export function extractBscTokenAddress(input: string, slashCommand?: string) {
  const source = `${slashCommand ?? ''} ${input}`;
  const match = source.match(CA_RE);
  if (!match || !isAddress(match[0])) return null;
  return getAddress(match[0]);
}

export function looksLikeTokenRiskRequest(input: string, slashCommand?: string) {
  const address = extractBscTokenAddress(input, slashCommand);
  if (!address) return false;

  const source = `${slashCommand ?? ''} ${input}`.trim().toLowerCase();
  const withoutAddress = source.replace(address.toLowerCase(), '').replace(CA_RE, '').trim();
  if (!withoutAddress) return true;

  return /ca|contract|token|coin|meme|security|risk|safe|honeypot|tax|audit|flap|four|four\.meme|gmgn|source|opensource|open source|owner|renounce|liquidity|holder|social|x\.com|twitter|telegram|地址|合约|代币|币|土狗|税|税率|安全|风险|开源|审计|蜜罐|貔貅|黑名单|权限|池子|流动性|持仓|持有人|社媒|官网|能不能冲|能买吗|查一下|看一下|查ca|查 ca/.test(
    source,
  );
}

async function readContractString(address: Address, functionName: 'symbol' | 'name') {
  const abi = functionName === 'symbol' ? ERC20ABI : ERC20_NAME_ABI;
  return publicClient
    .readContract({
      address,
      abi,
      functionName,
    })
    .then((value) => (typeof value === 'string' ? value.trim() : ''))
    .catch(() => '');
}

async function readTokenIdentity(address: Address): Promise<AddressIdentity> {
  const bytecode = await publicClient.getBytecode({ address }).catch(() => undefined);
  if (!bytecode || bytecode === '0x') return { kind: 'wallet' };

  const [symbol, name, decimals, totalSupply] = await Promise.all([
    readContractString(address, 'symbol'),
    readContractString(address, 'name'),
    publicClient
      .readContract({ address, abi: ERC20ABI, functionName: 'decimals' })
      .then((value) => Number(value))
      .catch(() => null),
    publicClient
      .readContract({ address, abi: ERC20ABI, functionName: 'totalSupply' })
      .then((value) => BigInt(value))
      .catch(() => null),
  ]);

  if (symbol && decimals !== null && totalSupply !== null) {
    return {
      kind: 'token',
      bytecode,
      name,
      symbol,
      decimals,
      totalSupply,
    };
  }

  return { kind: 'contract', bytecode };
}

async function fetchGoPlusSecurity(address: string) {
  const url = new URL(`https://api.gopluslabs.io/api/v1/token_security/${BSC_CHAIN_ID}`);
  url.searchParams.set('contract_addresses', address);

  const headers: Record<string, string> = { accept: 'application/json' };
  const token = process.env.GOPLUS_API_KEY || process.env.GOPLUS_ACCESS_TOKEN || '';
  if (token) headers.authorization = `Bearer ${token}`;

  const response = await fetch(url, { headers, cache: 'no-store' });
  if (!response.ok) throw new Error(`GoPlus ${response.status}`);

  const payload = (await response.json()) as Record<string, unknown>;
  const result = asRecord(payload.result);
  if (!result) return null;

  const lower = address.toLowerCase();
  const exact = asRecord(result[lower]) || asRecord(result[address]);
  if (exact) return exact;

  return Object.values(result).map(asRecord).find(Boolean) ?? null;
}

async function fetchBscScanSource(address: string): Promise<BscScanSource | null> {
  const apiKey = process.env.BSCSCAN_API_KEY || process.env.BSC_SCAN_API_KEY || '';
  if (!apiKey) return null;

  const url = new URL('https://api.bscscan.com/api');
  url.searchParams.set('module', 'contract');
  url.searchParams.set('action', 'getsourcecode');
  url.searchParams.set('address', address);
  url.searchParams.set('apikey', apiKey);

  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) return null;

  const payload = (await response.json()) as Record<string, unknown>;
  const rows = Array.isArray(payload.result) ? payload.result : [];
  const row = asRecord(rows[0]);
  if (!row) return null;

  const sourceCode = asString(row.SourceCode);
  const abi = asString(row.ABI);
  const contractName = asString(row.ContractName);
  const proxy = asFlag(row.Proxy);
  const implementation = asString(row.Implementation);

  return {
    contractName: contractName || undefined,
    sourceVerified: Boolean(sourceCode && abi && abi !== 'Contract source code not verified'),
    proxy: proxy ?? undefined,
    implementation: implementation || undefined,
  };
}

function parseDexPair(value: unknown): DexPair | null {
  const pair = asRecord(value);
  if (!pair) return null;
  if (asString(pair.chainId).toLowerCase() !== 'bsc') return null;

  const liquidity = asRecord(pair.liquidity);
  const volume = asRecord(pair.volume);
  const info = asRecord(pair.info);
  const websites = Array.isArray(info?.websites)
    ? info.websites
        .map((item) => asString(asRecord(item)?.url))
        .filter(Boolean)
    : [];
  const socials = Array.isArray(info?.socials)
    ? info.socials
        .map((item) => asString(asRecord(item)?.url))
        .filter(Boolean)
    : [];

  return {
    url: asString(pair.url) || undefined,
    dexId: asString(pair.dexId) || undefined,
    priceUsd: asString(pair.priceUsd) || undefined,
    liquidityUsd: asNumber(liquidity?.usd) ?? undefined,
    volume24h: asNumber(volume?.h24) ?? undefined,
    marketCap: asNumber(pair.marketCap) ?? undefined,
    fdv: asNumber(pair.fdv) ?? undefined,
    websites,
    socials,
  };
}

async function fetchDexPair(address: string) {
  const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`, {
    headers: { accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) return null;

  const payload = (await response.json()) as Record<string, unknown>;
  const pairs = Array.isArray(payload.pairs) ? payload.pairs.map(parseDexPair).filter(Boolean) : [];
  return (pairs as DexPair[]).sort((left, right) => (right.liquidityUsd ?? 0) - (left.liquidityUsd ?? 0))[0] ?? null;
}

function riskSignals(security: GoPlusSecurity, source: BscScanSource | null, lang: TokenRiskLang) {
  const signals: RiskSignal[] = [];
  const honeypot = asFlag(security.is_honeypot);
  const openSource = asFlag(security.is_open_source);
  const hiddenOwner = asFlag(security.hidden_owner);
  const canTakeBackOwnership = asFlag(security.can_take_back_ownership);
  const ownerChangeBalance = asFlag(security.owner_change_balance);
  const blacklist = asFlag(security.is_blacklisted);
  const whitelist = asFlag(security.is_whitelisted);
  const proxy = asFlag(security.is_proxy) ?? source?.proxy ?? null;
  const externalCall = asFlag(security.external_call);
  const slippageModifiable = asFlag(security.slippage_modifiable);
  const selfdestruct = asFlag(security.selfdestruct);
  const tradingCooldown = asFlag(security.trading_cooldown);
  const buyTax = taxPercent(security.buy_tax);
  const sellTax = taxPercent(security.sell_tax);

  if (honeypot) signals.push({ label: pick(lang, '疑似蜜罐', 'Honeypot risk'), severity: 'high' });
  if (sellTax !== null && sellTax >= 50) signals.push({ label: pick(lang, `卖税 ${formatPercent(security.sell_tax)}`, `Sell tax ${formatPercent(security.sell_tax)}`), severity: 'high' });
  else if (sellTax !== null && sellTax >= 15) signals.push({ label: pick(lang, `卖税 ${formatPercent(security.sell_tax)}`, `Sell tax ${formatPercent(security.sell_tax)}`), severity: 'medium' });
  if (buyTax !== null && buyTax >= 20) signals.push({ label: pick(lang, `买税 ${formatPercent(security.buy_tax)}`, `Buy tax ${formatPercent(security.buy_tax)}`), severity: 'medium' });
  if (openSource === false && source?.sourceVerified !== true) signals.push({ label: pick(lang, '合约未开源', 'Source not verified'), severity: 'high' });
  if (hiddenOwner) signals.push({ label: pick(lang, '隐藏 owner', 'Hidden owner'), severity: 'high' });
  if (canTakeBackOwnership) signals.push({ label: pick(lang, '可取回 owner', 'Owner can be recovered'), severity: 'high' });
  if (blacklist) signals.push({ label: pick(lang, '黑名单逻辑', 'Blacklist logic'), severity: 'medium' });
  if (whitelist) signals.push({ label: pick(lang, '白名单限制', 'Whitelist logic'), severity: 'medium' });
  if (ownerChangeBalance) signals.push({ label: pick(lang, 'owner 可改余额', 'Owner can change balances'), severity: 'high' });
  if (proxy) signals.push({ label: pick(lang, '代理合约', 'Proxy contract'), severity: 'medium' });
  if (externalCall) signals.push({ label: pick(lang, '外部调用', 'External calls'), severity: 'medium' });
  if (slippageModifiable) signals.push({ label: pick(lang, '税率可调', 'Tax can change'), severity: 'medium' });
  if (selfdestruct) signals.push({ label: pick(lang, '自毁风险', 'Selfdestruct risk'), severity: 'high' });
  if (tradingCooldown) signals.push({ label: pick(lang, '交易冷却', 'Trading cooldown'), severity: 'low' });

  return signals;
}

function scoreContract(security: GoPlusSecurity, source: BscScanSource | null, signals: RiskSignal[]) {
  let score = 100;
  for (const signal of signals) score -= signal.severity === 'high' ? 24 : signal.severity === 'medium' ? 11 : 4;
  const openSource = asFlag(security.is_open_source) ?? source?.sourceVerified ?? null;
  if (openSource === false) score -= 20;
  if (openSource === null) score -= 8;
  return clampScore(score);
}

function scoreTax(security: GoPlusSecurity) {
  const buy = taxPercent(security.buy_tax);
  const sell = taxPercent(security.sell_tax);
  if (buy === null && sell === null) return 55;
  const worst = Math.max(buy ?? 0, sell ?? 0);
  if (worst >= 50) return 5;
  if (worst >= 25) return 25;
  if (worst >= 15) return 45;
  if (worst >= 8) return 70;
  if (worst > 0) return 84;
  return 95;
}

function scoreLiquidity(pair: DexPair | null) {
  const usd = pair?.liquidityUsd ?? 0;
  if (usd >= 250_000) return 90;
  if (usd >= 80_000) return 78;
  if (usd >= 20_000) return 62;
  if (usd >= 5_000) return 44;
  if (usd > 0) return 28;
  return 20;
}

function scoreSocial(pair: DexPair | null) {
  const links = new Set([...(pair?.websites ?? []), ...(pair?.socials ?? [])]);
  if (links.size >= 3) return 88;
  if (links.size === 2) return 72;
  if (links.size === 1) return 55;
  return 30;
}

function scoreHolder(security: GoPlusSecurity) {
  const holders = asNumber(security.holder_count);
  if (holders === null) return 45;
  if (holders >= 10_000) return 88;
  if (holders >= 2_000) return 75;
  if (holders >= 500) return 62;
  if (holders >= 100) return 48;
  return 28;
}

function verdict(overall: number, signals: RiskSignal[], lang: TokenRiskLang) {
  const high = signals.some((signal) => signal.severity === 'high');
  if (high || overall < 45) {
    return {
      tone: 'alert' as TerminalTone,
      label: pick(lang, '高风险', 'High risk'),
      body: pick(lang, '别急着冲，先把红灯逐个确认。', 'Do not rush in. Check each red flag first.'),
    };
  }
  if (overall < 70) {
    return {
      tone: 'warm' as TerminalTone,
      label: pick(lang, '中风险', 'Medium risk'),
      body: pick(lang, '可以继续看盘口，但别只凭热度进。', 'Keep checking the market. Do not rely on hype alone.'),
    };
  }
  return {
    tone: 'growth' as TerminalTone,
    label: pick(lang, '低风险信号', 'Lower-risk signals'),
    body: pick(lang, '基础体检没看到明显红灯，但这不等于保赚。', 'No obvious base-scan red flags. That still does not mean guaranteed upside.'),
  };
}

function socialText(pair: DexPair | null, lang: TokenRiskLang) {
  const links = [...(pair?.websites ?? []), ...(pair?.socials ?? [])];
  if (!links.length) return pick(lang, '未发现', 'None found');
  const labels: string[] = [];
  if (pair?.websites.length) labels.push(pick(lang, '官网', 'Website'));
  if (pair?.socials.some((item) => /x\.com|twitter/i.test(item))) labels.push('X');
  if (pair?.socials.some((item) => /t\.me|telegram/i.test(item))) labels.push(pick(lang, '电报', 'Telegram'));
  return labels.length ? labels.join(' / ') : pick(lang, `${links.length} 个链接`, `${links.length} link(s)`);
}

function tokenTypeText(security: GoPlusSecurity, lang: TokenRiskLang) {
  const buy = taxPercent(security.buy_tax) ?? 0;
  const sell = taxPercent(security.sell_tax) ?? 0;
  if (buy > 0 || sell > 0) return pick(lang, '税币', 'Tax token');
  return pick(lang, 'BEP20 代币', 'BEP20 token');
}

function riskText(signals: RiskSignal[], lang: TokenRiskLang) {
  if (!signals.length) return pick(lang, '暂无硬红灯', 'No hard red flags');
  return signals.slice(0, 3).map((item) => item.label).join(' / ');
}

function buildTokenDetails(
  address: string,
  identity: AddressIdentity,
  security: GoPlusSecurity,
  source: BscScanSource | null,
  pair: DexPair | null,
  signals: RiskSignal[],
  scores: { contract: number; tax: number; liquidity: number; holders: number; social: number; overall: number },
  lang: TokenRiskLang,
): TerminalDetailRow[] {
  const openSource = asFlag(security.is_open_source) ?? source?.sourceVerified ?? null;
  const ownerAddress = firstString(security, ['owner_address']);
  const hasOwner = Boolean(ownerAddress && !/^0x0{40}$/i.test(ownerAddress));
  const supply = compactSupply(identity.totalSupply, identity.decimals);

  return [
    { label: pick(lang, '综合', 'Overall'), value: `${scores.overall}/100`, tone: scoreTone(scores.overall) },
    { label: pick(lang, '类型', 'Type'), value: tokenTypeText(security, lang), tone: taxPercent(security.sell_tax) ? 'warm' : 'cool' },
    { label: pick(lang, '合约', 'Contract'), value: `${shortAddress(address)} · ${sourceText(lang, openSource)}`, tone: openSource === false ? 'alert' : 'growth' },
    { label: pick(lang, '交易税', 'Tax'), value: `${pick(lang, '买', 'Buy')} ${formatPercent(security.buy_tax)} / ${pick(lang, '卖', 'Sell')} ${formatPercent(security.sell_tax)}`, tone: scoreTone(scores.tax) },
    { label: pick(lang, '权限', 'Owner'), value: hasOwner ? pick(lang, '仍有 owner', 'Owner exists') : ownerAddress ? pick(lang, '已放弃', 'Renounced') : '--', tone: hasOwner ? 'warm' : 'cool' },
    { label: pick(lang, '流动性', 'Liquidity'), value: money(pair?.liquidityUsd), tone: scoreTone(scores.liquidity) },
    { label: pick(lang, '社媒', 'Social'), value: socialText(pair, lang), tone: scoreTone(scores.social) },
    { label: pick(lang, '持有人', 'Holders'), value: firstString(security, ['holder_count']) || '--', tone: scoreTone(scores.holders) },
    { label: pick(lang, '供应量', 'Supply'), value: supply },
    { label: pick(lang, '主要风险', 'Main risk'), value: riskText(signals, lang), tone: signals.some((item) => item.severity === 'high') ? 'alert' : signals.length ? 'warm' : 'growth' },
  ];
}

function scorePlainContract(identity: AddressIdentity, source: BscScanSource | null) {
  let score = 62;
  if (source?.sourceVerified) score += 26;
  if (source?.sourceVerified === false) score -= 24;
  if (source?.proxy) score -= 12;
  const bytecodeBytes = Math.max(0, ((identity.bytecode?.length ?? 2) - 2) / 2);
  if (bytecodeBytes > 24_000) score -= 8;
  if (bytecodeBytes > 0 && bytecodeBytes < 120) score -= 10;
  return clampScore(score);
}

function plainContractSignals(identity: AddressIdentity, source: BscScanSource | null, lang: TokenRiskLang): RiskSignal[] {
  const signals: RiskSignal[] = [];
  if (source?.sourceVerified === false) signals.push({ label: pick(lang, '源码未验证', 'Source not verified'), severity: 'high' });
  if (source === null) signals.push({ label: pick(lang, '源码状态未知', 'Source status unknown'), severity: 'medium' });
  if (source?.proxy) signals.push({ label: pick(lang, '代理合约', 'Proxy contract'), severity: 'medium' });
  const bytecodeBytes = Math.max(0, ((identity.bytecode?.length ?? 2) - 2) / 2);
  if (bytecodeBytes > 24_000) signals.push({ label: pick(lang, '字节码接近上限', 'Large bytecode'), severity: 'medium' });
  if (bytecodeBytes > 0 && bytecodeBytes < 120) signals.push({ label: pick(lang, '极短字节码', 'Very short bytecode'), severity: 'low' });
  return signals;
}

function buildNonTokenCard(address: string, identity: AddressIdentity, source: BscScanSource | null, lang: TokenRiskLang): TerminalCard[] {
  const isWallet = identity.kind === 'wallet';
  const signals = plainContractSignals(identity, source, lang);
  const score = isWallet ? 0 : scorePlainContract(identity, source);
  const bytecodeBytes = Math.max(0, ((identity.bytecode?.length ?? 2) - 2) / 2);
  const contractDetails: TerminalDetailRow[] = isWallet
    ? []
    : [
        { label: pick(lang, '合约评分', 'Contract score'), value: `${score}/100`, tone: scoreTone(score) },
        { label: pick(lang, '源码', 'Source'), value: sourceText(lang, source?.sourceVerified ?? null), tone: source?.sourceVerified ? 'growth' : 'alert' },
        { label: pick(lang, '代理', 'Proxy'), value: boolText(lang, source?.proxy ?? null, false), tone: source?.proxy ? 'warm' : 'cool' },
        { label: pick(lang, '字节码', 'Bytecode'), value: bytecodeBytes ? `${Math.round(bytecodeBytes).toLocaleString('en-US')} bytes` : '--' },
        { label: pick(lang, '主要风险', 'Main risk'), value: riskText(signals, lang), tone: signals.some((item) => item.severity === 'high') ? 'alert' : signals.length ? 'warm' : 'growth' },
      ];
  const title = isWallet ? pick(lang, '钱包地址', 'Wallet address') : pick(lang, '普通合约', 'Contract address');
  const body = isWallet
    ? pick(lang, '链上没有合约代码，不是 BEP20 代币 CA。', 'No contract bytecode was found. This is not a BEP20 token CA.')
    : pick(
        lang,
        `这不是标准代币。合约体检 ${score}/100，重点看源码是否验证、是否代理、字节码是否异常。`,
        `This is not a standard token. Contract scan ${score}/100. Check source verification, proxy status, and bytecode shape.`,
      );

  return [
    {
      id: cardId('address-scan'),
      type: 'receipt',
      label: pick(lang, '地址识别', 'Address scan'),
      title,
      body,
      details: [
        { label: pick(lang, '地址', 'Address'), value: shortAddress(address), tone: 'cool' },
        { label: pick(lang, '类型', 'Type'), value: isWallet ? pick(lang, '钱包', 'Wallet') : pick(lang, '合约', 'Contract') },
        ...contractDetails,
      ],
      cta: { label: pick(lang, '打开 BscScan', 'Open BscScan'), href: `https://bscscan.com/address/${address}` },
    },
  ];
}

export async function buildTokenRiskCards(input: TokenRiskInput): Promise<TerminalCard[] | null> {
  const lang = input.lang === 'en' ? 'en' : 'zh';
  const address = extractBscTokenAddress(input.input, input.slashCommand);
  if (!address || !looksLikeTokenRiskRequest(input.input, input.slashCommand)) return null;

  try {
    const [identity, securityMaybe, source, pair] = await Promise.all([
      readTokenIdentity(address as Address),
      fetchGoPlusSecurity(address).catch(() => null),
      fetchBscScanSource(address).catch(() => null),
      fetchDexPair(address).catch(() => null),
    ]);

    if (identity.kind !== 'token') return buildNonTokenCard(address, identity, source, lang);

    const security = securityMaybe ?? {};
    const symbol = firstString(security, ['token_symbol', 'symbol']) || identity.symbol || 'TOKEN';
    const name = firstString(security, ['token_name', 'name']) || identity.name || '';
    const signals = riskSignals(security, source, lang);
    const scores = {
      contract: scoreContract(security, source, signals),
      tax: scoreTax(security),
      liquidity: scoreLiquidity(pair),
      holders: scoreHolder(security),
      social: scoreSocial(pair),
      overall: 0,
    };
    scores.overall = clampScore(scores.contract * 0.34 + scores.tax * 0.22 + scores.liquidity * 0.18 + scores.holders * 0.14 + scores.social * 0.12);
    const result = verdict(scores.overall, signals, lang);
    const details = buildTokenDetails(address, identity, security, source, pair, signals, scores, lang);
    const scanSummary = pick(
      lang,
      `${tokenTypeText(security, lang)}，合约 ${scores.contract}/100，税 ${scores.tax}/100，流动性 ${scores.liquidity}/100，社媒 ${scores.social}/100。`,
      `${tokenTypeText(security, lang)}, contract ${scores.contract}/100, tax ${scores.tax}/100, liquidity ${scores.liquidity}/100, social ${scores.social}/100.`,
    );
    const memoryText = pick(
      lang,
      `查过 BSC 代币 ${symbol} ${address}，综合 ${scores.overall}/100，结论：${result.label}；主要风险：${riskText(signals, lang)}。`,
      `Checked BSC token ${symbol} ${address}. Overall ${scores.overall}/100. Verdict: ${result.label}. Main risk: ${riskText(signals, lang)}.`,
    );

    return [
      {
        id: cardId('token-risk'),
        type: 'proposal',
        label: pick(lang, 'CA 体检', 'CA Scan'),
        title: `${symbol}${name && name !== symbol ? ` · ${name}` : ''}`,
        body: `${result.label}。${result.body} ${scanSummary}`,
        details,
        actions: [
          { label: pick(lang, '打开 BscScan', 'Open BscScan'), href: `https://bscscan.com/token/${address}` },
          ...(pair?.url ? [{ label: pick(lang, '打开盘口', 'Open chart'), href: pair.url }] : []),
          { label: pick(lang, '记到记忆', 'Save memory'), intent: 'memory' as const, memoryText },
        ],
      },
    ];
  } catch (error) {
    return [
      {
        id: cardId('token-risk-error'),
        type: 'message',
        role: 'nfa',
        label: pick(lang, 'CA 体检', 'CA Scan'),
        title: '',
        body: pick(
          lang,
          `这次没有查完整。可能是 RPC 或安全接口抖了一下，稍后再试。${error instanceof Error ? error.message : ''}`.trim(),
          `The scan did not complete. RPC or the security provider may have failed. Try again later. ${error instanceof Error ? error.message : ''}`.trim(),
        ),
        tone: 'alert',
      },
    ];
  }
}
