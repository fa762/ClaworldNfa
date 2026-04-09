'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAccount, useReadContract, useSignMessage } from 'wagmi';
import { type Address, formatEther, parseEther } from 'viem';

import { TerminalBox } from '@/components/terminal/TerminalBox';
import { ERC20ABI } from '@/contracts/abis/ERC20';
import { addresses, getBscScanAddressUrl, getBscScanTxUrl } from '@/contracts/addresses';
import {
  AUTONOMY_ACTION_KIND,
  AUTONOMY_MIN_WALLET_HOLDING,
  AUTONOMY_MIN_WALLET_HOLDING_RAW,
  AUTONOMY_OPERATOR,
  AUTONOMY_PROTOCOL_ID,
  AUTONOMY_ROLE_MASK,
  useAutonomyActionSetup,
  useAutonomyActions,
  useAutonomyProofs,
} from '@/contracts/hooks/useAutonomy';
import { formatCLW, truncateAddress } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

type ActionCardConfig = {
  key: 'task' | 'pk' | 'battleRoyale';
  titleZh: string;
  titleEn: string;
  introZh: string;
  introEn: string;
  actionKind: number;
  protocolId: `0x${string}`;
  adapter: Address;
  defaultDailyLimit: string;
  defaultRiskMode: number;
  defaultMaxSpend: string;
  supportsSpend: boolean;
};

type DirectiveStyle = 'tight' | 'balanced' | 'expressive';

type DirectiveApiResponse = {
  tokenId: number;
  actionKind: number;
  style: DirectiveStyle;
  text: string;
  updatedAt: number | null;
  updatedBy: string | null;
  messageTemplate?: string;
  error?: string;
};

const ACTIONS: readonly ActionCardConfig[] = [
  {
    key: 'task',
    titleZh: '任务代理',
    titleEn: 'Task Agent',
    introZh: 'AI 会先看当前任务上下文，再调用现有 TaskSkill 真正做任务。',
    introEn: 'The AI reads live task context, then executes the current TaskSkill on-chain.',
    actionKind: AUTONOMY_ACTION_KIND.task,
    protocolId: AUTONOMY_PROTOCOL_ID.task,
    adapter: addresses.taskSkillAdapter,
    defaultDailyLimit: '3',
    defaultRiskMode: 1,
    defaultMaxSpend: '0',
    supportsSpend: false,
  },
  {
    key: 'pk',
    titleZh: 'PK 代理',
    titleEn: 'PK Agent',
    introZh: 'AI 会先看公开 PK 列表，再把三种策略都模拟一遍，然后决定要不要加入现有 PKSkill。',
    introEn: 'The AI reviews live public PK candidates, simulates three strategies, then joins the live PKSkill flow.',
    actionKind: AUTONOMY_ACTION_KIND.pk,
    protocolId: AUTONOMY_PROTOCOL_ID.pk,
    adapter: addresses.pkSkillAdapter,
    defaultDailyLimit: '2',
    defaultRiskMode: 1,
    defaultMaxSpend: '100',
    supportsSpend: true,
  },
  {
    key: 'battleRoyale',
    titleZh: 'Battle Royale 代理',
    titleEn: 'Battle Royale Agent',
    introZh: 'AI 会读取当前开放对局、房间人数、房间总额和风险档，再决定进哪间房、下多少 Claworld；进入后，reveal 维护也会由 runner 自动接走。',
    introEn: 'The AI reads the live open arena, room counts, room totals, and your risk posture before choosing a room and stake; once inside, reveal maintenance is also handled by the runner.',
    actionKind: AUTONOMY_ACTION_KIND.battleRoyale,
    protocolId: AUTONOMY_PROTOCOL_ID.battleRoyale,
    adapter: addresses.battleRoyaleAdapter,
    defaultDailyLimit: '2',
    defaultRiskMode: 1,
    defaultMaxSpend: '100',
    supportsSpend: true,
  },
] as const;

function getRiskOptions(actionKey: ActionCardConfig['key'], zh: boolean) {
  if (actionKey === 'battleRoyale') {
    return [
      { value: 0, label: zh ? '低风险生存' : 'Low-risk survival' },
      { value: 1, label: zh ? '均衡博弈' : 'Balanced contest' },
      { value: 2, label: zh ? '高风险冲池' : 'High-risk prize push' },
    ] as const;
  }

  if (actionKey === 'pk') {
    return [
      { value: 0, label: zh ? '低风险试探' : 'Low-risk probing' },
      { value: 1, label: zh ? '均衡博弈' : 'Balanced duel' },
      { value: 2, label: zh ? '高风险强攻' : 'High-risk pressure' },
    ] as const;
  }

  return [
    { value: 0, label: zh ? '稳健收益' : 'Steady income' },
    { value: 1, label: zh ? '均衡成长' : 'Balanced growth' },
    { value: 2, label: zh ? '冲刺收益' : 'High-upside push' },
  ] as const;
}

function getRiskHint(actionKey: ActionCardConfig['key'], riskMode: number, zh: boolean) {
  if (actionKey === 'battleRoyale') {
    if (riskMode === 0) {
      return zh
        ? '偏向更稳的房间和更低的投入，优先活下来。'
        : 'Prefers steadier rooms and lower stake sizes to stay alive longer.';
    }
    if (riskMode === 2) {
      return zh
        ? '更愿意进冷门房间、下更高筹码，追求更高回报。'
        : 'Leans into thinner rooms and larger stakes to chase higher upside.';
    }
    return zh
      ? '在房间人数、总奖池和风险之间取中间值。'
      : 'Balances room density, prize potential, and risk before entering.';
  }

  if (actionKey === 'pk') {
    if (riskMode === 0) {
      return zh
        ? '更倾向稳的局和保守策略，优先控制消耗。'
        : 'Leans toward safer lobbies and lower-risk strategies to control losses.';
    }
    if (riskMode === 2) {
      return zh
        ? '更愿意打高压力局，接受更高波动来换更高收益。'
        : 'Accepts sharper variance and tougher lobbies when the upside looks better.';
    }
    return zh
      ? '先看胜算，再在收益和波动之间做平衡。'
      : 'Weighs expected win rate first, then balances payout against variance.';
  }

  if (riskMode === 0) {
    return zh
      ? '优先选稳定收益和更低失败率的任务。'
      : 'Prefers steadier task income with lower failure pressure.';
  }
  if (riskMode === 2) {
    return zh
      ? '更看重高收益和高成长，接受更激进的任务选择。'
      : 'Prioritizes higher upside and faster growth, even with more volatility.';
  }
  return zh
    ? '在收益、成长和稳定性之间取平衡。'
    : 'Balances payout, growth, and stability.';
}

function getSpendLabel(actionKey: ActionCardConfig['key'], zh: boolean) {
  if (actionKey === 'battleRoyale') {
    return zh ? '单次 Battle Royale 预算 (Claworld)' : 'Max Battle Royale spend (Claworld)';
  }
  if (actionKey === 'pk') {
    return zh ? '单次 PK 预算 (Claworld)' : 'Max PK spend (Claworld)';
  }
  return zh ? '单次动作预算 (Claworld)' : 'Max spend per action (Claworld)';
}

function getGasProfile(actionKey: ActionCardConfig['key'], zh: boolean) {
  if (actionKey === 'battleRoyale') {
    return {
      tier: zh ? '中高 gas' : 'Medium-high gas',
      detail: zh
        ? '通常会经历 enter / reveal / claim 多步，建议更低 daily limit。'
        : 'Usually spans enter / reveal / claim across multiple steps, so a lower daily limit is safer.',
    };
  }

  if (actionKey === 'pk') {
    return {
      tier: zh ? '中等 gas' : 'Medium gas',
      detail: zh
        ? '公开 PK 可能经历 join / reveal / settle 生命周期，适合中频运行。'
        : 'Public PK may span join / reveal / settle, which fits a moderate operating cadence.',
    };
  }

  return {
    tier: zh ? '低 gas' : 'Low gas',
    detail: zh
      ? 'Task 代理更适合高频稳定运行，交互最确定。'
      : 'Task automation is the most deterministic and cheapest path for steady operation.',
  };
}

function getDeterminismHint(actionKey: ActionCardConfig['key'], zh: boolean) {
  if (actionKey === 'battleRoyale') {
    return zh
      ? '交互保持确定：只允许在既定预算、保底余额和房间候选里做选择。'
      : 'Interaction stays deterministic: the agent only chooses within fixed budget, reserve, and room candidates.';
  }

  if (actionKey === 'pk') {
    return zh
      ? '交互保持确定：只在通过权限、预算和风险预检的公开 PK 里做决策。'
      : 'Interaction stays deterministic: the agent only acts on public PK matches that pass permission, budget, and risk checks.';
  }

  return zh
    ? '交互保持确定：只在当前可执行任务里选收益/稳定性更优的一项。'
    : 'Interaction stays deterministic: the agent only picks among currently executable tasks with better payoff/stability.';
}

function getDecisionSurface(actionKey: ActionCardConfig['key'], zh: boolean) {
  if (actionKey === 'battleRoyale') {
    return zh
      ? '会展示：候选房间、人数、总奖池、最终房间、stake 和风险档。'
      : 'Shows candidate rooms, player counts, prize totals, final room, stake, and risk posture.';
  }

  if (actionKey === 'pk') {
    return zh
      ? '会展示：候选公开局、过滤后的可打局、最终策略和结果。'
      : 'Shows candidate public matches, filtered viable matches, the final strategy, and the result.';
  }

  return zh
    ? '会展示：任务选择原因、收益/稳定性取舍，以及最近结果。'
    : 'Shows why the task was chosen, the payoff/stability tradeoff, and the latest result.';
}

function getNextActionLabel(nextStep: string, zh: boolean) {
  if (nextStep === 'protocol') return zh ? '授权 Protocol' : 'Approve protocol';
  if (nextStep === 'adapter') return zh ? '授权 Adapter' : 'Approve adapter';
  if (nextStep === 'operator') return zh ? '授权 Operator' : 'Approve operator';
  if (nextStep === 'roles') return zh ? '授予角色' : 'Grant roles';
  if (nextStep === 'lease') return zh ? '签发 Lease' : 'Create lease';
  if (nextStep === 'resume') return zh ? '恢复代理' : 'Resume agent';
  if (nextStep === 'policy') return zh ? '写入风控' : 'Write risk controls';
  if (nextStep === 'active') return zh ? '已运行' : 'Agent live';
  return zh ? '继续下一步' : 'Continue setup';
}

function getDirectiveStyleOptions(zh: boolean) {
  return [
    {
      value: 'tight' as const,
      label: zh ? '严谨执行' : 'Tight execution',
      hint: zh ? '少废话，优先稳定和纪律。' : 'Less flourish, more discipline and stability.',
    },
    {
      value: 'balanced' as const,
      label: zh ? '均衡判断' : 'Balanced judgment',
      hint: zh ? '默认口径，兼顾稳定、收益和表达。' : 'Default posture that balances stability, upside, and explanation.',
    },
    {
      value: 'expressive' as const,
      label: zh ? '充分解释' : 'Explain more',
      hint: zh ? '更愿意把取舍说清楚，但仍只能在边界内行动。' : 'Explains tradeoffs more fully while still acting only inside the allowed boundary.',
    },
  ];
}

function getDirectiveTemplate(actionKey: ActionCardConfig['key'], style: DirectiveStyle, zh: boolean) {
  if (actionKey === 'battleRoyale') {
    if (style === 'tight') {
      return zh
        ? '优先活下来。严格尊重预算、保底余额和 daily limit，只在候选房间里选风险更可控的一项。'
        : 'Prioritize survival. Strictly respect budget, reserve, and daily limit, and choose only the most controlled option among the candidate rooms.';
    }
    if (style === 'expressive') {
      return zh
        ? '把房间人数、奖池规模、stake 和风险档之间的博弈解释清楚，但最终只能从真实候选里选一项。'
        : 'Explain the game-theoretic tradeoff across room density, prize pool, stake, and risk posture clearly, but still choose only from the real bounded candidates.';
    }
    return zh
      ? '在房间人数、奖池规模、stake 和风险之间做均衡判断，优先长期可持续。'
      : 'Balance room density, prize size, stake, and risk with a bias toward sustainable long-run play.';
  }

  if (actionKey === 'pk') {
    if (style === 'tight') {
      return zh
        ? '只有在通过权限、预算和 reserve 预检后才行动，优先更稳的公开 PK。'
        : 'Only act after permission, budget, and reserve checks pass, and prefer safer public PK opportunities.';
    }
    if (style === 'expressive') {
      return zh
        ? '把三种策略的取舍解释清楚，但最终只能在合规候选里做受限选择。'
        : 'Explain the tradeoff across the three strategies clearly, but still make a bounded choice only among eligible candidates.';
    }
    return zh
      ? '综合胜率、消耗和波动做均衡判断，只在可打的公开 PK 里决定是否加入。'
      : 'Balance win rate, spend, and variance, and decide whether to join only among viable public PK matches.';
  }

  if (style === 'tight') {
    return zh
      ? '优先稳定收益和低失败率，只在当前可执行任务里选最稳的一项。'
      : 'Prefer steady income and low failure pressure, and choose only the most reliable currently executable task.';
  }
  if (style === 'expressive') {
    return zh
      ? '把收益、成长和稳定性的取舍解释清楚，但动作仍只能来自现有任务候选。'
      : 'Explain the tradeoff across payout, growth, and stability clearly, while still acting only on the live task candidates.';
  }
  return zh
    ? '在收益、成长和稳定性之间做均衡判断，选当前最值的任务。'
    : 'Balance payout, growth, and stability, then choose the most valuable live task.';
}

function buildDirectivePreview(actionKey: ActionCardConfig['key'], style: DirectiveStyle, extra: string, zh: boolean) {
  const base = getDirectiveTemplate(actionKey, style, zh);
  const trimmed = extra.trim();
  return trimmed ? `${base} ${trimmed}` : base;
}

function buildDirectiveMessage(
  tokenId: bigint,
  actionKind: number,
  style: DirectiveStyle,
  text: string,
  issuedAt: number
) {
  return [
    'Clawworld Autonomy Directive',
    `tokenId:${tokenId}`,
    `actionKind:${actionKind}`,
    `style:${style}`,
    `text:${text.trim().slice(0, 220)}`,
    `issuedAt:${issuedAt}`,
  ].join('\n');
}

function safeParseEther(value: string): bigint {
  try {
    return parseEther(value && Number(value) >= 0 ? value : '0');
  } catch {
    return 0n;
  }
}

function maxBigInt(a: bigint, b: bigint) {
  return a > b ? a : b;
}

function statusLabel(zh: boolean, status: number) {
  switch (status) {
    case 1:
      return zh ? '已请求' : 'Requested';
    case 2:
      return zh ? '已推理' : 'Fulfilled';
    case 3:
      return zh ? '执行中' : 'Executing';
    case 4:
      return zh ? '已执行' : 'Executed';
    case 5:
      return zh ? '失败' : 'Failed';
    case 6:
      return zh ? '过期' : 'Expired';
    case 7:
      return zh ? '取消' : 'Cancelled';
    default:
      return zh ? '无' : 'None';
  }
}

function formatTs(value?: number) {
  return value && value > 0 ? new Date(value * 1000).toLocaleString() : '--';
}

function trimProof(value: string | undefined) {
  if (!value) return '--';
  if (value.length <= 22) return value;
  return `${value.slice(0, 12)}...${value.slice(-6)}`;
}

function getActionDecisionSummary(actionKey: ActionCardConfig['key'], zh: boolean) {
  if (actionKey === 'battleRoyale') {
    return zh
      ? 'AI 会在候选房间和 stake 里做一次受限选择，目标是更稳地平衡奖池吸引力与生存率。'
      : 'The AI makes a bounded room-and-stake decision, balancing prize attractiveness against survival odds.';
  }

  if (actionKey === 'pk') {
    return zh
      ? 'AI 会先过滤公开 PK，再在可打的局里比较三种策略，最后才决定是否加入。'
      : 'The AI filters public PK matches first, compares three strategies on viable matches, and only then decides whether to join.';
  }

  return zh
    ? 'AI 只会在当前可执行任务里做选择，优先更稳或更值的一项。'
    : 'The AI only chooses among currently executable tasks, prioritizing the steadiest or most valuable option.';
}

function getActionResultSummary(actionKey: ActionCardConfig['key'], status: number, zh: boolean) {
  if (status === 4) {
    if (actionKey === 'battleRoyale') {
      return zh ? '本轮已完成 Battle Royale 代理动作。' : 'This Battle Royale agent action completed successfully.';
    }
    if (actionKey === 'pk') {
      return zh ? '本轮已完成 PK 代理动作。' : 'This PK agent action completed successfully.';
    }
    return zh ? '本轮已完成任务代理动作。' : 'This task agent action completed successfully.';
  }

  if (status === 5) {
    return zh ? '本轮动作失败，已记录最近错误。' : 'This action failed and the latest error was recorded.';
  }

  if (status === 3) {
    return zh ? '动作已进入执行阶段。' : 'The action has reached execution.';
  }

  if (status === 2) {
    return zh ? '动作已完成推理，等待后续链上步骤。' : 'Reasoning is complete and the action is waiting on follow-up on-chain steps.';
  }

  return zh ? '动作已进入链上流程。' : 'The action is in flight on-chain.';
}

function getActionOutcomeLabel(actionKey: ActionCardConfig['key'], zh: boolean) {
  if (actionKey === 'battleRoyale') return zh ? '代理结果' : 'Agent outcome';
  if (actionKey === 'pk') return zh ? '对局结果' : 'Match outcome';
  return zh ? '任务结果' : 'Task outcome';
}

function getThinkingChecklist(actionKey: ActionCardConfig['key'], zh: boolean) {
  if (actionKey === 'battleRoyale') {
    return zh
      ? [
          '读取当前开放 Battle Royale、房间人数、房间总额和可下注范围。',
          '先套用你的预算、保底余额、daily limit 和风险档。',
          '在候选房间与 stake 里做受限博弈选择，不会跳出边界乱下。',
          '把最终选择和推理证明写回链上流程。',
        ]
      : [
          'Reads the current open Battle Royale, room counts, room totals, and stake bounds.',
          'Applies your budget, reserve floor, daily limit, and risk posture first.',
          'Makes a bounded game-theoretic room and stake choice instead of acting outside the allowed surface.',
          'Writes the final choice and reasoning proof back into the on-chain flow.',
        ];
  }

  if (actionKey === 'pk') {
    return zh
      ? [
          '读取当前公开 PK 候选。',
          '先做权限、预算、reserve 和失败熔断预检。',
          '把三种策略都过一遍，再决定 join / reveal / settle。',
          '把最终选择和推理证明写回链上流程。',
        ]
      : [
          'Reads the current public PK candidates.',
          'Runs permission, budget, reserve, and failure-breaker checks first.',
          'Compares all three strategies before deciding whether to join, reveal, or settle.',
          'Writes the final choice and reasoning proof back into the on-chain flow.',
        ];
  }

  return zh
    ? [
        '读取当前任务机会、冷却和近期分布。',
        '先看这只 NFA 的余额压力、daily cost 和可执行性。',
        '比较收益、稳定性和成长，再选最值的一项。',
        '把最终选择和推理证明写回链上流程。',
      ]
    : [
        'Reads live task opportunities, cooldowns, and recent distribution.',
        'Checks this NFA’s balance pressure, daily cost, and executability first.',
        'Balances payout, stability, and growth before selecting the best task.',
        'Writes the final choice and reasoning proof back into the on-chain flow.',
      ];
}

function getReasoningStatus(receipt: any, zh: boolean) {
  if (receipt.reasoningCid) {
    return zh ? '本轮已经生成推理证明。' : 'A reasoning proof was generated for this action.';
  }

  if (Number(receipt.status) === 1) {
    return zh ? '请求已上链，正在等待模型做受限选择。' : 'The request is on-chain and waiting for the model to make a bounded choice.';
  }

  return zh ? '这轮还没有可展示的推理证明。' : 'There is no reasoning proof available for this action yet.';
}

function Chip({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span className={`px-2 py-0.5 border text-[11px] ${ok ? 'border-crt-green text-crt-green glow' : 'border-crt-darkest term-dim'}`}>
      {text}
    </span>
  );
}

function ProofCard({ receipt, actionKey, zh }: { receipt: any; actionKey: ActionCardConfig['key']; zh: boolean }) {
  const thinkingChecklist = getThinkingChecklist(actionKey, zh);

  return (
    <div className="term-box p-2 text-[11px] space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="term-bright">
          {zh ? '请求' : 'Request'} #{String(receipt.requestId)}
        </span>
        <Chip ok={Number(receipt.status) === 4} text={statusLabel(zh, Number(receipt.status))} />
      </div>
      <div className="term-box p-2 space-y-1">
        <div className="term-dim">{zh ? '这次为什么这么做' : 'Why this action'}</div>
        <div>{getActionDecisionSummary(actionKey, zh)}</div>
        <div className="term-dim">{zh ? '本轮思考路径' : 'Thinking path'}</div>
        <ul className="space-y-1 pl-4 list-disc">
          {thinkingChecklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <div className="term-dim">{zh ? '推理状态' : 'Reasoning status'}</div>
        <div>{getReasoningStatus(receipt, zh)}</div>
        <div className="term-dim">{getActionOutcomeLabel(actionKey, zh)}</div>
        <div>{getActionResultSummary(actionKey, Number(receipt.status), zh)}</div>
      </div>
      <div className="grid grid-cols-2 gap-1">
        <div className="term-dim">{zh ? '创建时间' : 'Created'}</div>
        <div>{formatTs(Number(receipt.createdAt || 0))}</div>
        <div className="term-dim">{zh ? '执行时间' : 'Executed'}</div>
        <div>{formatTs(Number(receipt.executedAt || 0))}</div>
        <div className="term-dim">{zh ? '实际消耗' : 'Actual spend'}</div>
        <div>{formatCLW(BigInt(receipt.actualSpend || 0n))} Claworld</div>
        <div className="term-dim">{zh ? '实际收益' : 'Reward'}</div>
        <div className="text-crt-green">{formatCLW(BigInt(receipt.clwCredit || 0n))} Claworld</div>
        <div className="term-dim">{zh ? 'XP' : 'XP'}</div>
        <div>{Number(receipt.xpCredit || 0)}</div>
        <div className="term-dim">{zh ? '推理证明' : 'Reasoning proof'}</div>
        <div>{trimProof(receipt.reasoningCid)}</div>
        <div className="term-dim">{zh ? '执行回执' : 'Execution ref'}</div>
        <div>{trimProof(receipt.executionRef)}</div>
        <div className="term-dim">{zh ? '链上 receipt' : 'Receipt hash'}</div>
        <div>{trimProof(receipt.receiptHash)}</div>
      </div>
      {receipt.lastError ? (
        <div className="term-danger break-words">
          {zh ? '最近错误' : 'Last error'}: {receipt.lastError}
        </div>
      ) : null}
    </div>
  );
}

function ActionCard({
  tokenId,
  ownerAddress,
  currentClwBalance,
  dailyCost,
  holderWalletEligible,
  holderWalletBalance,
  walletThresholdLabel,
  onRefreshEligibility,
  config,
}: {
  tokenId: bigint;
  ownerAddress?: string;
  currentClwBalance: bigint;
  dailyCost: bigint;
  holderWalletEligible: boolean;
  holderWalletBalance: bigint;
  walletThresholdLabel: string;
  onRefreshEligibility: () => Promise<boolean>;
  config: ActionCardConfig;
}) {
  const { address } = useAccount();
  const { lang } = useI18n();
  const zh = lang === 'zh';
  const isOwner =
    !!address && !!ownerAddress && address.toLowerCase() === ownerAddress.toLowerCase();

  const setup = useAutonomyActionSetup({
    tokenId,
    actionKind: config.actionKind,
    protocolId: config.protocolId,
    adapter: config.adapter,
  });
  const proofs = useAutonomyProofs(tokenId, config.protocolId);
  const actions = useAutonomyActions();
  const { signMessageAsync, isPending: isSigningDirective } = useSignMessage();

  const suggestedReserve = useMemo(() => {
    const fallback = config.supportsSpend ? parseEther('200') : parseEther('100');
    const sustain = dailyCost > 0n ? dailyCost * 3n : 0n;
    return formatEther(maxBigInt(fallback, sustain));
  }, [config.supportsSpend, dailyCost]);

  const [riskMode, setRiskMode] = useState(config.defaultRiskMode);
  const [dailyLimit, setDailyLimit] = useState(config.defaultDailyLimit);
  const [maxSpend, setMaxSpend] = useState(config.defaultMaxSpend);
  const [minReserve, setMinReserve] = useState(suggestedReserve);
  const [maxFailures, setMaxFailures] = useState('3');
  const [leaseDays, setLeaseDays] = useState('30');
  const [directiveStyle, setDirectiveStyle] = useState<DirectiveStyle>('balanced');
  const [directiveText, setDirectiveText] = useState('');
  const [directiveUpdatedAt, setDirectiveUpdatedAt] = useState<number | null>(null);
  const [directiveUpdatedBy, setDirectiveUpdatedBy] = useState<string | null>(null);
  const [directiveLoading, setDirectiveLoading] = useState(true);
  const [directiveSaving, setDirectiveSaving] = useState(false);
  const [directiveError, setDirectiveError] = useState<string | null>(null);
  const [directiveSuccess, setDirectiveSuccess] = useState<string | null>(null);
  const [eligibilityError, setEligibilityError] = useState<string | null>(null);

  useEffect(() => {
    if (!setup.policy || !setup.risk) return;
    setRiskMode(setup.policy.riskMode);
    setDailyLimit(String(setup.policy.dailyLimit || Number(config.defaultDailyLimit)));
    setMaxSpend(config.supportsSpend ? formatEther(setup.policy.maxClwPerAction) : '0');
    setMinReserve(formatEther(setup.risk.minClwReserve));
    setMaxFailures(String(setup.risk.maxFailureStreak || 3));
  }, [config.defaultDailyLimit, config.supportsSpend, setup.policy, setup.risk]);

  useEffect(() => {
    let cancelled = false;

    const loadDirective = async () => {
      setDirectiveLoading(true);
      setDirectiveError(null);
      setDirectiveSuccess(null);
      try {
        const response = await fetch(`/api/autonomy/directive?tokenId=${tokenId.toString()}&actionKind=${config.actionKind}`, {
          cache: 'no-store',
        });
        const data = (await response.json()) as DirectiveApiResponse;
        if (!response.ok) {
          throw new Error(data.error || 'Failed to load autonomy directive.');
        }
        if (cancelled) return;
        setDirectiveStyle(data.style);
        setDirectiveText(data.text);
        setDirectiveUpdatedAt(data.updatedAt);
        setDirectiveUpdatedBy(data.updatedBy);
      } catch (error) {
        if (cancelled) return;
        setDirectiveError(String((error as Error).message || error));
      } finally {
        if (!cancelled) {
          setDirectiveLoading(false);
        }
      }
    };

    void loadDirective();
    return () => {
      cancelled = true;
    };
  }, [config.actionKind, tokenId]);

  const desiredDailyLimit = Number(dailyLimit || '0');
  const desiredMaxSpend = config.supportsSpend ? maxSpend || '0' : '0';
  const desiredMaxSpendWei = safeParseEther(desiredMaxSpend);
  const desiredReserve = minReserve || '0';
  const desiredReserveWei = safeParseEther(desiredReserve);
  const desiredMaxFailures = Number(maxFailures || '0');
  const runtimeRequired = desiredReserveWei + desiredMaxSpendWei;
  const runtimeReady = currentClwBalance >= runtimeRequired;
  const gasProfile = useMemo(() => getGasProfile(config.key, zh), [config.key, zh]);
  const determinismHint = useMemo(() => getDeterminismHint(config.key, zh), [config.key, zh]);
  const decisionSurface = useMemo(() => getDecisionSurface(config.key, zh), [config.key, zh]);
  const directiveStyleOptions = useMemo(() => getDirectiveStyleOptions(zh), [zh]);
  const directivePreview = useMemo(
    () => buildDirectivePreview(config.key, directiveStyle, directiveText, zh),
    [config.key, directiveStyle, directiveText, zh]
  );

  const policyNeedsUpdate =
    !setup.policy ||
    !setup.risk ||
    !setup.policy.enabled ||
    setup.policy.riskMode !== riskMode ||
    setup.policy.dailyLimit !== desiredDailyLimit ||
    setup.policy.maxClwPerAction !== desiredMaxSpendWei ||
    setup.risk.maxFailureStreak !== desiredMaxFailures ||
    setup.risk.minClwReserve !== desiredReserveWei;

  const nextStep = useMemo(() => {
    if (!setup.ready) return 'contracts';
    if (!isOwner) return 'owner';
    if (!holderWalletEligible) return 'wallet';
    if (!runtimeReady) return 'runtime';
    if (!setup.protocolApproved) return 'protocol';
    if (!setup.adapterApproved) return 'adapter';
    if (!setup.operatorApproved) return 'operator';
    if (setup.operatorRoleMask !== AUTONOMY_ROLE_MASK.full) return 'roles';
    if (!setup.leaseActive) return 'lease';
    if (setup.risk?.emergencyPaused) return 'resume';
    if (policyNeedsUpdate) return 'policy';
    return 'active';
  }, [
    holderWalletEligible,
    isOwner,
    policyNeedsUpdate,
    runtimeReady,
    setup.adapterApproved,
    setup.leaseActive,
    setup.operatorApproved,
    setup.operatorRoleMask,
    setup.protocolApproved,
    setup.ready,
    setup.risk,
  ]);

  const nextStepText =
    nextStep === 'contracts'
      ? zh
        ? '主网 autonomy 地址还没配置'
        : 'Autonomy contracts are not configured'
      : nextStep === 'owner'
      ? zh
        ? '请切换到当前 NFA 持有者钱包'
        : 'Switch to the wallet that owns this NFA'
      : nextStep === 'wallet'
      ? zh
        ? '持有者钱包的 Claworld 还没达到门槛'
        : 'The owner wallet has not reached the Claworld threshold'
      : nextStep === 'runtime'
      ? zh
        ? '先给这只 NFA 充足运行余额'
        : 'Top up this NFA before enabling runtime'
      : nextStep === 'protocol'
      ? zh
        ? '授权协议范围'
        : 'Approve protocol scope'
      : nextStep === 'adapter'
      ? zh
        ? '授权动作适配器'
        : 'Approve action adapter'
      : nextStep === 'operator'
      ? zh
        ? '授权 AI operator'
        : 'Approve AI operator'
      : nextStep === 'roles'
      ? zh
        ? '授予请求 / 执行 / 维护角色'
        : 'Grant request / execute / maintain roles'
      : nextStep === 'lease'
      ? zh
        ? '签发 operator 租约'
        : 'Create operator lease'
      : nextStep === 'resume'
      ? zh
        ? '恢复 AI 代理'
        : 'Resume AI agent'
      : nextStep === 'policy'
      ? zh
        ? '写入风控和策略参数'
        : 'Write risk and policy settings'
      : zh
      ? 'AI 代理已可自动运行'
      : 'AI agent is active';

  const ensureWalletEligible = async () => {
    const eligible = await onRefreshEligibility();
    if (!eligible) {
      setEligibilityError(
        zh
          ? `持有这只 NFA 的钱包当前 Claworld 余额还没达到门槛（${walletThresholdLabel}）。`
          : `The wallet that owns this NFA has not reached the current Claworld threshold (${walletThresholdLabel}).`
      );
      return false;
    }
    setEligibilityError(null);
    return true;
  };

  const riskOptions = useMemo(() => getRiskOptions(config.key, zh), [config.key, zh]);

  const handleSaveDirective = async () => {
    if (!isOwner || directiveSaving || isSigningDirective) return;
    if (!(await ensureWalletEligible())) return;

    setDirectiveSaving(true);
    setDirectiveError(null);
    setDirectiveSuccess(null);

    try {
      const issuedAt = Date.now();
      const trimmedText = directiveText.trim().slice(0, 220);
      const message = buildDirectiveMessage(tokenId, config.actionKind, directiveStyle, trimmedText, issuedAt);
      const signature = await signMessageAsync({ message });
      const response = await fetch('/api/autonomy/directive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenId: Number(tokenId),
          actionKind: config.actionKind,
          style: directiveStyle,
          text: trimmedText,
          issuedAt,
          signer: address,
          signature,
        }),
      });
      const data = (await response.json()) as DirectiveApiResponse;
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save autonomy directive.');
      }
      setDirectiveText(data.text);
      setDirectiveStyle(data.style);
      setDirectiveUpdatedAt(data.updatedAt);
      setDirectiveUpdatedBy(data.updatedBy);
      setDirectiveSuccess(zh ? 'AI 口径已保存。' : 'AI directive saved.');
    } catch (error) {
      setDirectiveError(String((error as Error).message || error));
    } finally {
      setDirectiveSaving(false);
    }
  };

  const handleContinue = async () => {
    if (!isOwner || !setup.ready || actions.isPending || actions.isConfirming) return;
    if (!(await ensureWalletEligible())) return;
    const leaseExpiry =
      Number(leaseDays || '0') <= 0
        ? 0n
        : BigInt(Math.floor(Date.now() / 1000) + Number(leaseDays) * 86400);

    if (nextStep === 'protocol') {
      actions.setApprovedProtocol(tokenId, config.protocolId, true);
      return;
    }
    if (nextStep === 'adapter') {
      actions.setApprovedAdapter(tokenId, config.actionKind, config.adapter, true);
      return;
    }
    if (nextStep === 'operator') {
      actions.setApprovedOperator(tokenId, config.actionKind, AUTONOMY_OPERATOR, true);
      return;
    }
    if (nextStep === 'roles') {
      actions.setOperatorRoleMask(tokenId, config.actionKind, AUTONOMY_OPERATOR, AUTONOMY_ROLE_MASK.full);
      return;
    }
    if (nextStep === 'lease') {
      actions.setDelegationLease(tokenId, config.actionKind, AUTONOMY_OPERATOR, AUTONOMY_ROLE_MASK.full, leaseExpiry);
      return;
    }
    if (nextStep === 'resume') {
      actions.setEmergencyPause(tokenId, config.actionKind, false);
      return;
    }
    if (nextStep === 'policy') {
      actions.setRiskControls(tokenId, config.actionKind, desiredMaxFailures, desiredReserve);
    }
  };

  const handleEnablePolicy = async () => {
    if (!isOwner || !setup.ready || actions.isPending || actions.isConfirming) return;
    if (!(await ensureWalletEligible())) return;
    actions.setPolicy(tokenId, config.actionKind, true, riskMode, desiredDailyLimit, desiredMaxSpend);
  };

  const handlePauseToggle = async () => {
    if (!isOwner || !setup.ready || !setup.policy?.enabled || actions.isPending || actions.isConfirming) return;
    if (setup.risk?.emergencyPaused && !(await ensureWalletEligible())) return;
    actions.setEmergencyPause(tokenId, config.actionKind, !Boolean(setup.risk?.emergencyPaused));
  };

  const receipts = proofs.receipts.slice(0, 2);
  const continueDisabled =
    actions.isPending ||
    actions.isConfirming ||
    nextStep === 'contracts' ||
    nextStep === 'owner' ||
    nextStep === 'wallet' ||
    nextStep === 'runtime' ||
    nextStep === 'active';

  return (
    <TerminalBox title={zh ? config.titleZh : config.titleEn}>
      <div className="space-y-3 text-xs">
        <div className="term-dim">{zh ? config.introZh : config.introEn}</div>

        <div className="grid gap-2 md:grid-cols-2">
          <div className="term-box p-2 space-y-1 text-[11px]">
            <div className="term-bright">{zh ? '当前开通条件' : 'Current requirements'}</div>
            <div>{zh ? '1. 持有者钱包外部 Claworld 达到门槛' : '1. The owner wallet holds enough Claworld'}</div>
            <div>{zh ? '2. 这只 NFA 的内部余额达到运行门槛' : '2. The NFA internal balance covers runtime'}</div>
            <div>{zh ? '3. 依次完成 protocol / adapter / operator / lease / risk / policy' : '3. Complete protocol / adapter / operator / lease / risk / policy in order'}</div>
          </div>

          <div className="term-box p-2 text-[11px] space-y-1">
            <div className="term-dim">{zh ? '当前下一步' : 'Next step'}</div>
            <div className="term-bright mt-1">{nextStepText}</div>
            <div className="mt-1 term-dim">
              {zh
                ? '最后一步才是正式写入 AI 代理策略。前面的交易都是在给这只 NFA 打开边界和权限。'
                : 'The final step writes the live AI policy. The earlier transactions open the right boundaries and permissions.'}
            </div>
            <div className="term-line" />
            <div className="term-dim">{zh ? 'gas 档位' : 'Gas profile'}</div>
            <div>
              {gasProfile.tier} · {gasProfile.detail}
            </div>
            <div className="term-dim">{zh ? '交互原则' : 'Interaction rule'}</div>
            <div>{determinismHint}</div>
            <div className="term-dim">{zh ? '智能展示面' : 'Visible intelligence'}</div>
            <div>{decisionSurface}</div>
          </div>
        </div>

        <div className="term-box p-2 text-[11px] space-y-2">
          <div className="term-bright">{zh ? 'AI 思考怎么对外展示' : 'How the AI thinking is exposed'}</div>
          <div>
            {zh
              ? '前端不会让模型自由乱操作，而是把智能限制在受控选择里：你先设预算、保底余额、失败熔断和风格档位，AI 再在真实候选里做判断。'
              : 'The frontend does not let the model act freely. You set budget, reserve, failure breaker, and style posture first, then the AI judges among real bounded candidates.'}
          </div>
          <div>
            {config.key === 'battleRoyale'
              ? zh
                ? 'Battle Royale 会重点展示它如何在房间人数、奖池规模和风险档之间做博弈。'
                : 'Battle Royale emphasizes how the agent trades off room density, prize pool size, and risk posture.'
              : config.key === 'pk'
              ? zh
                ? 'PK 会重点展示它如何在公开候选和三种策略之间做判断。'
                : 'PK emphasizes how the agent evaluates public candidates and the three strategy archetypes.'
              : zh
              ? 'Task 会重点展示它如何在收益、成长和稳定性之间取舍。'
              : 'Task emphasizes how the agent trades off payout, growth, and stability.'}
          </div>
          <div className="term-dim">
            {zh
              ? '当前链上已保存 request、reasoning proof、execution ref 和结果；后续可以继续把 reasoning 文档内容拉到前端做展开查看。'
              : 'The chain already stores request ids, reasoning proofs, execution refs, and results; the next step can pull the reasoning document itself into the frontend for full expansion.'}
          </div>
        </div>

        <div className="term-box p-2 text-[11px] space-y-2">
          <div className="term-bright">{zh ? 'AI 风格 / 约束输入' : 'AI style / constraint input'}</div>
          <div>
            {zh
              ? '这里先把用户想要的风格和额外约束明确展示出来。当前版本先做产品落地：你可以定义风格、补一句约束或提示词，前端会把它作为可见策略口径展示；真正链上动作仍然只会落在既有预算、reserve、daily limit 和候选动作边界里。'
              : 'This makes the user-defined style and extra constraints explicit. In this version, you can set the posture and add one short prompt-like directive, and the UI exposes that policy clearly; the actual on-chain action still stays inside the existing budget, reserve, daily limit, and candidate-action boundaries.'}
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <label className="space-y-1">
              <div className="term-dim">{zh ? '思考风格' : 'Thinking style'}</div>
              <select
                value={directiveStyle}
                onChange={(e) => {
                  setDirectiveStyle(e.target.value as DirectiveStyle);
                  setDirectiveSuccess(null);
                  setDirectiveError(null);
                }}
                disabled={!isOwner || directiveLoading || directiveSaving || isSigningDirective}
                className="term-input"
              >
                {directiveStyleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="term-dim text-[11px]">
                {directiveStyleOptions.find((option) => option.value === directiveStyle)?.hint}
              </div>
            </label>

            <label className="space-y-1">
              <div className="term-dim">{zh ? '补充约束 / 提示词' : 'Extra constraint / prompt'}</div>
              <textarea
                value={directiveText}
                onChange={(e) => {
                  setDirectiveText(e.target.value.slice(0, 220));
                  setDirectiveSuccess(null);
                  setDirectiveError(null);
                }}
                disabled={!isOwner || directiveLoading || directiveSaving || isSigningDirective}
                rows={4}
                className="term-input resize-none"
                placeholder={
                  zh
                    ? '例如：优先长期稳定，不要为了短期高奖池过度冒险。'
                    : 'Example: Prioritize long-run stability and do not overextend for short-term upside.'
                }
              />
              <div className="term-dim text-[11px]">
                {zh ? '当前会把这段口径直接签名后保存，并注入 planner prompt。' : 'This directive is now signed, stored, and injected directly into planner prompts.'}
              </div>
            </label>
          </div>
          <div className="term-box p-2 space-y-1">
            <div className="term-dim">{zh ? '当前展示给用户的 AI 口径' : 'Current visible AI directive'}</div>
            <div>{directiveLoading ? (zh ? '读取中...' : 'Loading...') : directivePreview}</div>
            {directiveUpdatedAt ? (
              <div className="term-dim text-[11px]">
                {zh ? '最近保存' : 'Last saved'}: {new Date(directiveUpdatedAt).toLocaleString()}
                {directiveUpdatedBy ? ` · ${truncateAddress(directiveUpdatedBy)}` : ''}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleSaveDirective}
              disabled={!isOwner || directiveLoading || directiveSaving || isSigningDirective}
              className="term-btn text-xs"
            >
              [{directiveSaving || isSigningDirective ? (zh ? '保存中...' : 'Saving...') : zh ? '保存 AI 口径' : 'Save AI directive'}]
            </button>
          </div>
          {directiveSuccess ? <div className="text-crt-green text-[11px]">{directiveSuccess}</div> : null}
          {directiveError ? <div className="term-danger break-words text-[11px]">{directiveError}</div> : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Chip ok={holderWalletEligible} text={zh ? '钱包门槛通过' : 'Wallet threshold met'} />
          <Chip ok={runtimeReady} text={zh ? '运行余额就绪' : 'Runtime ready'} />
          <Chip ok={setup.protocolApproved} text={zh ? 'Protocol 已授权' : 'Protocol approved'} />
          <Chip ok={setup.adapterApproved} text={zh ? 'Adapter 已授权' : 'Adapter approved'} />
          <Chip ok={setup.operatorApproved} text={zh ? 'Operator 已授权' : 'Operator approved'} />
          <Chip ok={setup.operatorRoleMask === AUTONOMY_ROLE_MASK.full} text={zh ? '角色完整' : 'Roles granted'} />
          <Chip ok={setup.leaseActive} text={zh ? 'Lease 有效' : 'Lease active'} />
          <Chip ok={Boolean(setup.policy?.enabled) && !Boolean(setup.risk?.emergencyPaused)} text={zh ? '代理运行中' : 'Agent live'} />
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <label className="space-y-1">
            <div className="term-dim">{zh ? 'AI 行动口径' : 'AI action posture'}</div>
            <select value={riskMode} onChange={(e) => setRiskMode(Number(e.target.value))} disabled={!isOwner} className="term-input">
              {riskOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="term-dim text-[11px]">{getRiskHint(config.key, riskMode, zh)}</div>
          </label>

          <label className="space-y-1">
            <div className="term-dim">{zh ? '每日最多动作' : 'Daily limit'}</div>
            <input type="number" min="0" value={dailyLimit} onChange={(e) => setDailyLimit(e.target.value)} disabled={!isOwner} className="term-input" />
          </label>

          {config.supportsSpend ? (
            <label className="space-y-1">
              <div className="term-dim">{getSpendLabel(config.key, zh)}</div>
              <input type="number" min="0" step="0.01" value={maxSpend} onChange={(e) => setMaxSpend(e.target.value)} disabled={!isOwner} className="term-input" />
            </label>
          ) : (
            <div className="term-box p-2 text-[11px]">
              <div className="term-dim">{zh ? '单次任务预算' : 'Task spend cap'}</div>
              <div className="term-bright">0 Claworld</div>
              <div className="term-dim mt-1">
                {zh ? '现有任务代理走任务收益逻辑，不直接消耗单次预算。' : 'Task agent follows the live reward flow and does not use a spend cap.'}
              </div>
            </div>
          )}

          <label className="space-y-1">
            <div className="term-dim">{zh ? '最低保底余额 (Claworld)' : 'Minimum reserve (Claworld)'}</div>
            <input type="number" min="0" step="0.01" value={minReserve} onChange={(e) => setMinReserve(e.target.value)} disabled={!isOwner} className="term-input" />
          </label>

          <label className="space-y-1">
            <div className="term-dim">{zh ? '连续失败熔断' : 'Failure breaker'}</div>
            <input type="number" min="0" value={maxFailures} onChange={(e) => setMaxFailures(e.target.value)} disabled={!isOwner} className="term-input" />
          </label>

          <label className="space-y-1">
            <div className="term-dim">{zh ? 'Lease 天数' : 'Lease days'}</div>
            <input type="number" min="0" value={leaseDays} onChange={(e) => setLeaseDays(e.target.value)} disabled={!isOwner} className="term-input" />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-1 text-[11px] term-box p-2">
          <div className="term-dim">{zh ? '持有者钱包余额' : 'Owner wallet balance'}</div>
          <div className={holderWalletEligible ? 'text-crt-green' : 'term-danger'}>{formatCLW(holderWalletBalance)} Claworld</div>
          <div className="term-dim">{zh ? '门槛要求' : 'Threshold'}</div>
          <div>{walletThresholdLabel}</div>
          <div className="term-dim">{zh ? 'NFA 当前内部余额' : 'NFA internal balance'}</div>
          <div>{formatCLW(currentClwBalance)} Claworld</div>
          <div className="term-dim">{zh ? '本动作运行至少需要' : 'Runtime requirement'}</div>
          <div>{formatCLW(runtimeRequired)} Claworld</div>
          <div className="term-dim">{zh ? '当前策略建议' : 'Current suggestion'}</div>
          <div className={runtimeReady ? 'text-crt-green' : 'term-warn'}>
            {runtimeReady
              ? zh
                ? '余额够用，可继续按步骤开通。'
                : 'Runtime balance is sufficient for setup.'
              : zh
              ? '先补内部余额，再开代理，能减少无效交易。'
              : 'Top up internal balance first to avoid wasted transactions.'}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={handleContinue} disabled={continueDisabled} className="term-btn term-btn-primary text-xs">
            [{actions.isPending
              ? zh
                ? '签名中...'
                : 'Signing...'
              : actions.isConfirming
              ? zh
                ? '确认中...'
                : 'Confirming...'
              : getNextActionLabel(nextStep, zh)}]
          </button>

          <button
            onClick={handleEnablePolicy}
            disabled={!isOwner || actions.isPending || actions.isConfirming || nextStep !== 'policy'}
            className="term-btn text-xs"
          >
            [{zh ? '启用 / 更新代理策略' : 'Enable / update live policy'}]
          </button>

          <button
            onClick={handlePauseToggle}
            disabled={!isOwner || !setup.policy?.enabled || actions.isPending || actions.isConfirming}
            className="term-btn text-xs"
          >
            [{setup.risk?.emergencyPaused ? (zh ? '恢复代理' : 'Resume agent') : (zh ? '紧急暂停' : 'Emergency pause')}]
          </button>
        </div>

        {actions.hash ? (
          <a href={getBscScanTxUrl(actions.hash)} target="_blank" rel="noopener noreferrer" className="term-link text-xs">
            [{zh ? '查看当前交易' : 'View current transaction'}]
          </a>
        ) : null}

        {actions.error ? (
          <div className="term-danger break-words text-[11px]">
            {String(actions.error.message || actions.error)}
          </div>
        ) : null}

        {eligibilityError ? <div className="term-danger break-words text-[11px]">{eligibilityError}</div> : null}

        <div className="term-line" />

        <div className="space-y-2">
          <div className="term-bright text-[11px]">
            {zh ? '最近链上证明 / 推理证明 / 动作结果' : 'Recent on-chain proof / reasoning proof / action results'}
          </div>

          {proofs.ledger ? (
            <div className="grid grid-cols-2 gap-1 text-[11px] term-box p-2">
              <div className="term-dim">{zh ? '累计执行' : 'Executed'}</div>
              <div>{proofs.ledger.executedCount}</div>
              <div className="term-dim">{zh ? '累计失败' : 'Failed'}</div>
              <div className={proofs.ledger.failedCount > 0 ? 'term-danger' : 'term-bright'}>{proofs.ledger.failedCount}</div>
              <div className="term-dim">{zh ? '累计收益' : 'Total reward'}</div>
              <div className="text-crt-green">{formatCLW(proofs.ledger.totalClwCredit)} Claworld</div>
              <div className="term-dim">{zh ? '累计消耗' : 'Total spend'}</div>
              <div>{formatCLW(proofs.ledger.totalActualSpend)} Claworld</div>
            </div>
          ) : null}

          {receipts.length === 0 ? (
            <div className="term-dim text-[11px]">
              {zh
                ? '启用后，这里会显示最近 requestId、推理证明、链上回执和动作结果。'
                : 'Once enabled, recent request ids, reasoning proofs, receipts, and results will appear here.'}
            </div>
          ) : (
            <div className="space-y-2">
              {receipts.map((receipt: any) => (
                <ProofCard key={String(receipt.requestId)} receipt={receipt} actionKey={config.key} zh={zh} />
              ))}
            </div>
          )}
        </div>
      </div>
    </TerminalBox>
  );
}

export function AutonomyPanel({
  tokenId,
  ownerAddress,
  clwBalance = 0n,
  dailyCost = 0n,
}: {
  tokenId: bigint;
  ownerAddress?: string;
  clwBalance?: bigint;
  dailyCost?: bigint;
}) {
  const { address } = useAccount();
  const { lang } = useI18n();
  const zh = lang === 'zh';
  const [selectedActionKey, setSelectedActionKey] = useState<ActionCardConfig['key']>('task');
  const ownerWallet = ownerAddress as Address | undefined;

  const walletBalanceQuery = useReadContract({
    address: addresses.clwToken,
    abi: ERC20ABI,
    functionName: 'balanceOf',
    args: ownerWallet ? [ownerWallet] : undefined,
    query: {
      enabled: !!ownerWallet && !!addresses.clwToken,
      refetchInterval: 15000,
      staleTime: 0,
    },
  });

  const walletBalance = BigInt((walletBalanceQuery.data as bigint | undefined) ?? 0n);
  const isOwner =
    !!address && !!ownerAddress && address.toLowerCase() === ownerAddress.toLowerCase();
  const holderWalletEligible = walletBalance >= AUTONOMY_MIN_WALLET_HOLDING;
  const walletThresholdLabel = `${AUTONOMY_MIN_WALLET_HOLDING_RAW} Claworld`;
  const selectedAction = ACTIONS.find((item) => item.key === selectedActionKey) ?? ACTIONS[0];

  const refreshEligibility = async () => {
    if (!ownerWallet || !addresses.clwToken) return false;
    const latest = await walletBalanceQuery.refetch();
    const value = BigInt((latest.data as bigint | undefined) ?? 0n);
    return value >= AUTONOMY_MIN_WALLET_HOLDING;
  };

  return (
    <TerminalBox title={zh ? 'AI 代理模式' : 'AI Agent Mode'} bright>
      <div className="space-y-4 text-xs">
        <div className="term-dim">
          {zh
            ? '第一版 AI 代理先接现有 Task 和公开 PK。开通时看持有这只 NFA 的钱包外部 Claworld 持仓，真正自动执行时再看这只 NFA 自己的内部 Claworld 余额。'
            : 'V1 AI agent mode connects to the live Task and public PK systems. Activation checks the external Claworld balance of the wallet that owns this NFA, while runtime uses the NFA internal Claworld balance.'}
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          <div className="term-box p-2 space-y-1">
            <div className="term-dim">{zh ? '当前持有者钱包' : 'Current owner wallet'}</div>
            <div className="term-bright">{ownerAddress ? truncateAddress(ownerAddress) : '--'}</div>
            <div className="text-[11px]">
              {walletBalanceQuery.isLoading ? (zh ? '读取中...' : 'Loading...') : `${formatCLW(walletBalance)} Claworld`}
            </div>
          </div>

          <div className="term-box p-2 space-y-1">
            <div className="term-dim">{zh ? 'AI 代理门槛' : 'AI agent threshold'}</div>
            <div className={holderWalletEligible ? 'text-crt-green' : 'term-danger'}>
              {walletThresholdLabel}
            </div>
            <div className="text-[11px]">
              {zh ? '每次关键交互前都会实时验证持有当前 NFA 的钱包。' : 'The wallet that owns this NFA is validated again before every critical interaction.'}
            </div>
          </div>

          <div className="term-box p-2 space-y-1">
            <div className="term-dim">{zh ? '当前 NFA 内部余额' : 'Current NFA internal balance'}</div>
            <div className="term-bright">{formatCLW(clwBalance)} Claworld</div>
            <div className="text-[11px]">
              {zh ? '真正自动跑任务和 PK 时，花的是这只 NFA 的内部记账余额。' : 'Task and PK autonomy spend the internal ledger balance of this NFA.'}
            </div>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2 text-[11px]">
          <div className="term-box p-2 space-y-1">
            <div className="term-bright">{zh ? 'gas 优化原则' : 'Gas optimization rules'}</div>
            <div>{zh ? '1. 优先少交易：先补足内部余额，再开代理，减少无效授权。' : '1. Prefer fewer transactions: top up internal balance before enabling to avoid wasted writes.'}</div>
            <div>{zh ? '2. 优先低 gas 路径：Task 适合高频，PK / BattleRoyale 适合更谨慎限频。' : '2. Prefer the cheaper path: Task fits higher cadence, while PK / Battle Royale should run at lower frequency.'}</div>
            <div>{zh ? '3. 智能放在决策解释里，不放在不确定交互里。' : '3. Keep intelligence in the decision explanation, not in fuzzy user interaction.'}</div>
          </div>

          <div className="term-box p-2 space-y-1">
            <div className="term-bright">{zh ? '用户交互原则' : 'Interaction rules'}</div>
            <div>{zh ? '1. 用户只做确定动作：授权、设置预算、暂停 / 恢复。' : '1. The user only performs deterministic actions: approvals, budget settings, pause/resume.'}</div>
            <div>{zh ? '2. AI 只在边界内做选择：任务、公开 PK、房间 / stake。' : '2. The agent only chooses within strict boundaries: tasks, public PK, room/stake.'}</div>
            <div>{zh ? '3. 所有结果都回到链上证明和最近动作卡片。' : '3. Every result resolves back into on-chain proof and recent action cards.'}</div>
          </div>
        </div>

        {!isOwner ? (
          <div className="term-danger">
            {zh
              ? '请先连接持有这只 NFA 的钱包。只有当前持有者可以开启、暂停或修改 AI 代理。'
              : 'Connect the wallet that owns this NFA first. Only the current owner can enable, pause, or edit the AI agent.'}
          </div>
        ) : null}

        {isOwner && !holderWalletEligible ? (
          <div className="term-warn">
            {zh
              ? '当前持有者钱包的 Claworld 还没达到代理门槛。达到门槛后，下面的代理动作才可以继续开通。'
              : 'The owner wallet does not meet the Claworld threshold yet. Once it does, the selected agent action can continue onboarding.'}
          </div>
        ) : null}

        <div className="term-box p-2 space-y-2">
          <div className="term-bright text-[11px]">
            {zh ? '代理动作' : 'Agent actions'}
          </div>
          <div className="flex flex-wrap gap-2">
            {ACTIONS.map((config) => {
              const active = config.key === selectedAction.key;
              return (
                <button
                  key={config.key}
                  type="button"
                  onClick={() => setSelectedActionKey(config.key)}
                  className={`term-btn text-xs ${active ? 'term-btn-primary' : ''}`}
                >
                  [{zh ? config.titleZh : config.titleEn}]
                </button>
              );
            })}
          </div>
          <div className="term-dim text-[11px]">
            {zh
              ? '先选一个动作类型，再看这条代理链路的预算、风控、证明和最近结果。'
              : 'Pick one action type first, then inspect its budget, risk controls, proofs, and latest results.'}
          </div>
        </div>

        <ActionCard
          key={selectedAction.key}
          tokenId={tokenId}
          ownerAddress={ownerAddress}
          currentClwBalance={clwBalance}
          dailyCost={dailyCost}
          holderWalletEligible={holderWalletEligible}
          holderWalletBalance={walletBalance}
          walletThresholdLabel={walletThresholdLabel}
          onRefreshEligibility={refreshEligibility}
          config={selectedAction}
        />

        <div className="grid gap-2 md:grid-cols-2 text-[11px]">
          <div className="term-box p-2 space-y-1">
            <div className="term-bright">{zh ? '当前规则' : 'Current rule set'}</div>
            <div>{zh ? '1. 先验证持有当前 NFA 的钱包是否持有足够 Claworld' : '1. Validate whether the owner wallet holds enough Claworld'}</div>
            <div>{zh ? '2. 再验证这只 NFA 的内部余额是否足够支撑当前动作运行' : '2. Validate whether this NFA has enough internal balance for runtime'}</div>
            <div>{zh ? '3. 后台 runner 自动完成 fulfill / sync / execute / finalize' : '3. The runner automatically performs fulfill / sync / execute / finalize'}</div>
          </div>

          <div className="term-box p-2 space-y-1">
            <div className="term-bright">{zh ? '链上主证明入口' : 'Primary on-chain proof entrypoints'}</div>
            <a href={getBscScanAddressUrl(addresses.autonomyRegistry as string)} target="_blank" rel="noopener noreferrer" className="term-link">
              Registry: {truncateAddress(addresses.autonomyRegistry as string)}
            </a>
            <a href={getBscScanAddressUrl(addresses.oracleActionHub as string)} target="_blank" rel="noopener noreferrer" className="term-link">
              ActionHub: {truncateAddress(addresses.oracleActionHub as string)}
            </a>
            <a href={getBscScanAddressUrl(addresses.autonomyFinalizationHub as string)} target="_blank" rel="noopener noreferrer" className="term-link">
              FinalizationHub: {truncateAddress(addresses.autonomyFinalizationHub as string)}
            </a>
          </div>
        </div>
      </div>
    </TerminalBox>
  );
}
