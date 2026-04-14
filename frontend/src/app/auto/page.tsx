'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bot, CheckCircle2, PauseCircle, PlayCircle, Settings2, Shield, Sparkles, Swords, Trophy } from 'lucide-react';
import { parseEther } from 'viem';

import { AutonomyClaimRequestPanel } from '@/components/auto/AutonomyClaimRequestPanel';
import { AutonomyDirectivePanel } from '@/components/auto/AutonomyDirectivePanel';
import { useActiveCompanion } from '@/components/lobster/useActiveCompanion';
import { useBattleRoyaleClaimWindow } from '@/components/lobster/useBattleRoyaleClaimWindow';
import { WalletGate } from '@/components/wallet/WalletGate';
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
import { addresses } from '@/contracts/addresses';
import { formatCLW } from '@/lib/format';
import { resolveIpfsUrl } from '@/lib/ipfs';
import { useI18n } from '@/lib/i18n';

type AgentKey = 'task' | 'pk' | 'battleRoyale';
type NextStep =
  | 'contracts'
  | 'owner'
  | 'wallet'
  | 'runtime'
  | 'protocol'
  | 'adapter'
  | 'operator'
  | 'roles'
  | 'lease'
  | 'settings'
  | 'resume'
  | 'active';

type ChoiceContextDoc = {
  title?: string;
  summary?: string;
  options?: string[];
};

type ReasoningDoc = {
  prompt?: string;
  choice?: number;
  choiceContext?: ChoiceContextDoc;
  aiResponse?: string;
  memoryContext?: {
    source?: string;
    matchedMemoryIds?: unknown[];
    prompt?: string;
  } | null;
};

const AGENTS = {
  task: {
    key: 'task' as const,
    titleZh: '任务代理',
    titleEn: 'Task agent',
    introZh: '自动看任务机会，挑一项去跑。',
    introEn: 'Auto-checks live tasks and picks one to run.',
    actionKind: AUTONOMY_ACTION_KIND.task,
    protocolId: AUTONOMY_PROTOCOL_ID.task,
    adapter: addresses.taskSkillAdapter,
    defaultDailyLimit: '3',
    defaultMaxSpend: '0',
    defaultMinReserve: '100',
    supportsSpend: false,
  },
  pk: {
    key: 'pk' as const,
    titleZh: 'PK 代理',
    titleEn: 'PK agent',
    introZh: '自动挑公开 PK，对局前给出策略。',
    introEn: 'Auto-selects public PK matches and chooses a strategy.',
    actionKind: AUTONOMY_ACTION_KIND.pk,
    protocolId: AUTONOMY_PROTOCOL_ID.pk,
    adapter: addresses.pkSkillAdapter,
    defaultDailyLimit: '2',
    defaultMaxSpend: '100',
    defaultMinReserve: '200',
    supportsSpend: true,
  },
  battleRoyale: {
    key: 'battleRoyale' as const,
    titleZh: '大逃杀代理',
    titleEn: 'Battle Royale agent',
    introZh: '自动选房、补揭示、自动领奖。',
    introEn: 'Auto-selects rooms, maintains reveal, and claims rewards.',
    actionKind: AUTONOMY_ACTION_KIND.battleRoyale,
    protocolId: AUTONOMY_PROTOCOL_ID.battleRoyale,
    adapter: addresses.battleRoyaleAdapter,
    defaultDailyLimit: '2',
    defaultMaxSpend: '100',
    defaultMinReserve: '200',
    supportsSpend: true,
  },
} as const;

function parseAmount(value: string) {
  try {
    return parseEther(value && Number(value) >= 0 ? value : '0');
  } catch {
    return 0n;
  }
}

function receiptStatusText(status: number, pick: <T,>(zh: T, en: T) => T) {
  if (status === 4) return pick('已执行', 'Executed');
  if (status === 5) return pick('失败', 'Failed');
  if (status === 3) return pick('已完成', 'Finalized');
  if (status === 2) return pick('等待执行', 'Synced');
  if (status === 1) return pick('已排队', 'Queued');
  return pick('空闲', 'Idle');
}

function getActionLabel(key: AgentKey, pick: <T,>(zh: T, en: T) => T) {
  if (key === 'task') return pick('任务挖矿', 'Task mining');
  if (key === 'pk') return 'PK';
  return pick('大逃杀', 'Battle Royale');
}

function getChoiceLabel(key: AgentKey, choice: number, pick: <T,>(zh: T, en: T) => T) {
  if (choice <= 0) return '--';
  if (key === 'pk') {
    if (choice === 1) return pick('强攻', 'Attack');
    if (choice === 2) return pick('均衡', 'Balanced');
    if (choice === 3) return pick('防守', 'Defense');
  }
  return pick(`第 ${choice} 个候选`, `Choice #${choice}`);
}

function nextStepTitle(step: NextStep, pick: <T,>(zh: T, en: T) => T) {
  switch (step) {
    case 'contracts':
      return pick('主网地址还没配好', 'Contracts are not configured');
    case 'owner':
      return pick('先连接持有人钱包', 'Connect the owner wallet first');
    case 'wallet':
      return pick('钱包门槛还没到', 'Wallet threshold not met');
    case 'runtime':
      return pick('先补足这只龙虾的储备', 'Top up this lobster first');
    case 'protocol':
      return pick('授权协议', 'Approve protocol');
    case 'adapter':
      return pick('授权适配器', 'Approve adapter');
    case 'operator':
      return pick('授权执行者', 'Approve operator');
    case 'roles':
      return pick('授予角色', 'Grant roles');
    case 'lease':
      return pick('签发租约', 'Create lease');
    case 'settings':
      return pick('去下方保存运行设置', 'Save settings below');
    case 'resume':
      return pick('恢复代理', 'Resume agent');
    default:
      return pick('代理已开启', 'Agent is live');
  }
}

function nextStepDetail(step: NextStep, thresholdLabel: string, pick: <T,>(zh: T, en: T) => T) {
  switch (step) {
    case 'wallet':
      return pick(`当前持有人钱包至少要有 ${thresholdLabel}。`, `The owner wallet must hold at least ${thresholdLabel}.`);
    case 'runtime':
      return pick('这只龙虾的记账储备要先够用，代理才会真的去跑。', 'The lobster ledger needs enough reserve before the agent can act.');
    case 'settings':
      return pick('授权已经差不多了，下面只要把保底和运行设置存好就行。', 'Save the live settings below to finish setup.');
    case 'active':
      return pick('下面看最近结果，高级里看详细信息。', 'Check recent results below and use Advanced for detail.');
    default:
      return pick('按顺序点下去就行。', 'Just keep going in order.');
  }
}

function primaryButtonText(step: NextStep, pick: <T,>(zh: T, en: T) => T) {
  switch (step) {
    case 'protocol':
      return pick('授权协议', 'Approve protocol');
    case 'adapter':
      return pick('授权适配器', 'Approve adapter');
    case 'operator':
      return pick('授权执行者', 'Approve operator');
    case 'roles':
      return pick('授予角色', 'Grant roles');
    case 'lease':
      return pick('签发租约', 'Create lease');
    case 'settings':
      return pick('去下方保存设置', 'Save settings below');
    case 'resume':
      return pick('恢复代理', 'Resume agent');
    case 'active':
      return pick('代理运行中', 'Agent is live');
    case 'wallet':
      return pick('钱包门槛不足', 'Wallet threshold not met');
    case 'runtime':
      return pick('储备还不够', 'Reserve is too low');
    case 'owner':
      return pick('请切换钱包', 'Switch wallet');
    default:
      return pick('继续', 'Continue');
  }
}

function shortError(message: string | null | undefined, pick: <T,>(zh: T, en: T) => T) {
  if (!message) return null;
  if (message.includes('User rejected') || message.includes('rejected')) {
    return pick('你取消了这次签名。', 'You cancelled the signature.');
  }
  if (message.includes('execution reverted')) {
    return pick('链上拒绝了这次动作，请先看条件是否满足。', 'The chain rejected this action.');
  }
  return message.slice(0, 90);
}

function trimText(value: string | undefined | null, max = 220) {
  if (!value) return '--';
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max)}...`;
}

function cleanOptionText(value: string | undefined | null) {
  if (!value) return '';
  return value.replace(/^Option\s+\d+:\s*/i, '').trim();
}

function translatePkStrategy(value: string, pick: <T,>(zh: T, en: T) => T) {
  const normalized = value.toLowerCase();
  if (normalized.includes('attack')) return pick('强攻', 'Attack');
  if (normalized.includes('balanced')) return pick('均衡', 'Balanced');
  if (normalized.includes('defense')) return pick('防守', 'Defense');
  return value;
}

function describeLatestAction(
  agentKey: AgentKey,
  receipt:
    | {
        status?: number;
        actualSpend?: bigint;
        clwCredit?: bigint;
        resolvedChoice?: number;
      }
    | undefined,
  reasoningDoc: { parsed?: ReasoningDoc; status: 'idle' | 'loading' | 'digest' | 'ready' | 'error' },
  reasoningSummary: string,
  pick: <T,>(zh: T, en: T) => T,
) {
  const choiceContext = reasoningDoc.parsed?.choiceContext;
  const summary = typeof choiceContext?.summary === 'string' ? choiceContext.summary : '';
  const choice = Number(receipt?.resolvedChoice ?? reasoningDoc.parsed?.choice ?? 0);
  const selectedOption =
    choice > 0 && Array.isArray(choiceContext?.options) ? cleanOptionText(choiceContext.options[choice - 1]) : '';
  const status = Number(receipt?.status ?? 0);
  const spend = BigInt(receipt?.actualSpend ?? 0n);
  const credit = BigInt(receipt?.clwCredit ?? 0n);

  let action = getActionLabel(agentKey, pick);
  let target = pick('还没有自动动作。', 'No recent action yet.');
  let decision = choice > 0 ? pick(`选择第 ${choice} 个方案`, `Picked option ${choice}`) : '--';

  if (agentKey === 'task') {
    const taskMatch = selectedOption.match(/^([^,]+),\s*XP\s*([0-9]+),\s*CLW\s*([0-9.]+)/i);
    if (taskMatch) {
      action = pick('任务挖矿', 'Task mining');
      target = pick(`执行 ${taskMatch[1]}`, `Run ${taskMatch[1]}`);
      decision = pick(`预计 ${taskMatch[3]} Claworld / ${taskMatch[2]} XP`, `${taskMatch[3]} Claworld / ${taskMatch[2]} XP`);
    } else if (selectedOption) {
      target = selectedOption;
    }
  }

  if (agentKey === 'pk') {
    const joinMatch = selectedOption.match(/join public pk #(\d+) vs nfa #(\d+) with ([^,]+)/i);
    const createMatch = selectedOption.match(/create match using (.+)$/i);
    const revealMatch = summary.match(/public pk #(\d+)/i);
    if (joinMatch) {
      action = 'PK';
      target = pick(`参加 PK #${joinMatch[1]}，对手 #${joinMatch[2]}`, `Join PK #${joinMatch[1]} vs #${joinMatch[2]}`);
      decision = pick(`策略 ${translatePkStrategy(joinMatch[3], pick)}`, `Strategy ${translatePkStrategy(joinMatch[3], pick)}`);
    } else if (createMatch) {
      action = 'PK';
      target = pick('发起一场新 PK', 'Create a new PK');
      decision = pick(`策略 ${translatePkStrategy(createMatch[1], pick)}`, `Strategy ${translatePkStrategy(createMatch[1], pick)}`);
    } else if (summary.toLowerCase().includes('reveal prepared commitment') && revealMatch) {
      action = 'PK';
      target = pick(`揭示 PK #${revealMatch[1]} 的策略`, `Reveal strategy for PK #${revealMatch[1]}`);
      decision = pick('提交之前保存的策略', 'Reveal the saved strategy');
    } else if (summary.toLowerCase().includes('settle public pk') && revealMatch) {
      action = 'PK';
      target = pick(`结算 PK #${revealMatch[1]}`, `Settle PK #${revealMatch[1]}`);
      decision = pick('结束这场对局并结算奖励', 'Settle the match');
    } else if (selectedOption) {
      target = selectedOption;
    }
  }

  if (agentKey === 'battleRoyale') {
    const matchId = summary.match(/match #(\d+)/i)?.[1];
    const enterRoom = selectedOption.match(/enter room (\d+), stake ([0-9.]+)/i);
    const moveRoom = selectedOption.match(/move to room (\d+)/i);
    const addStake = selectedOption.match(/add ([0-9.]+) claworld/i);
    const claimMatch = selectedOption.match(/claim ([0-9.]+) claworld/i);
    if (enterRoom) {
      action = pick('大逃杀', 'Battle Royale');
      target = matchId
        ? pick(`参加大逃杀 #${matchId}`, `Join Battle Royale #${matchId}`)
        : pick('参加大逃杀', 'Join Battle Royale');
      decision = pick(`进入 ${enterRoom[1]} 号房，质押 ${enterRoom[2]} Claworld`, `Enter room ${enterRoom[1]} with ${enterRoom[2]} Claworld`);
    } else if (moveRoom) {
      action = pick('大逃杀', 'Battle Royale');
      target = matchId
        ? pick(`切换大逃杀 #${matchId}`, `Change room in Battle Royale #${matchId}`)
        : pick('切换房间', 'Change room');
      decision = pick(`换到 ${moveRoom[1]} 号房`, `Move to room ${moveRoom[1]}`);
    } else if (addStake) {
      action = pick('大逃杀', 'Battle Royale');
      target = matchId
        ? pick(`给大逃杀 #${matchId} 加注`, `Add stake in Battle Royale #${matchId}`)
        : pick('追加质押', 'Add stake');
      decision = pick(`追加 ${addStake[1]} Claworld`, `Add ${addStake[1]} Claworld`);
    } else if (claimMatch) {
      action = pick('大逃杀', 'Battle Royale');
      target = matchId
        ? pick(`领取大逃杀 #${matchId} 奖励`, `Claim Battle Royale #${matchId} reward`)
        : pick('领取大逃杀奖励', 'Claim Battle Royale reward');
      decision = pick(`预计回款 ${claimMatch[1]} Claworld`, `Claim ${claimMatch[1]} Claworld`);
    } else if (selectedOption) {
      target = selectedOption;
    }
  }

  let result = pick('还没有结果。', 'No result yet.');
  if (status === 4) {
    if (credit > 0n && spend > 0n) {
      result = pick(`花了 ${formatCLW(spend)}，回了 ${formatCLW(credit)}`, `Spent ${formatCLW(spend)}, returned ${formatCLW(credit)}`);
    } else if (credit > 0n) {
      result = pick(`回款 ${formatCLW(credit)}`, `Returned ${formatCLW(credit)}`);
    } else if (spend > 0n) {
      result = pick(`花了 ${formatCLW(spend)}`, `Spent ${formatCLW(spend)}`);
    } else {
      result = pick('这次动作已完成。', 'Action completed.');
    }
  } else if (status === 5) {
    result = pick('这次动作没有跑成。', 'This action failed.');
  } else if (status === 3 || status === 2 || status === 1) {
    result = pick('这次动作还在路上。', 'This action is still in progress.');
  }

  return {
    action,
    target,
    decision,
    result,
    why: reasoningSummary,
    selectedOption,
    summary,
  };
}

function useReasoningDoc(reasoningCid?: string) {
  const [state, setState] = useState<{
    status: 'idle' | 'loading' | 'digest' | 'ready' | 'error';
    raw?: string;
    parsed?: ReasoningDoc;
    error?: string;
  }>({ status: 'idle' });

  useEffect(() => {
    let cancelled = false;

    if (!reasoningCid) {
      setState({ status: 'idle' });
      return;
    }

    if (reasoningCid.startsWith('autonomy://')) {
      setState({ status: 'digest' });
      return;
    }

    const resolvedUrl = resolveIpfsUrl(reasoningCid);
    if (!resolvedUrl || resolvedUrl === '/placeholder-nft.svg') {
      setState({ status: 'error', error: 'unsupported' });
      return;
    }

    setState({ status: 'loading' });

    fetch(resolvedUrl, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const text = await response.text();
        let parsed: ReasoningDoc | undefined;
        try {
          parsed = JSON.parse(text) as ReasoningDoc;
        } catch {
          parsed = undefined;
        }
        if (!cancelled) {
          setState({ status: 'ready', raw: text, parsed });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setState({ status: 'error', error: String((error as Error).message || error) });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [reasoningCid]);

  return state;
}

export default function AutoPage() {
  const { pick } = useI18n();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentKey>('battleRoyale');
  const [lastHandledHash, setLastHandledHash] = useState<string | null>(null);

  const agent = AGENTS[selectedAgent];
  const companion = useActiveCompanion();
  const tokenId = companion.hasToken ? companion.tokenId : undefined;
  const thresholdLabel = `${AUTONOMY_MIN_WALLET_HOLDING_RAW} Claworld`;
  const holderWalletEligible = companion.walletClaworld >= AUTONOMY_MIN_WALLET_HOLDING;

  const claimWindow = useBattleRoyaleClaimWindow(tokenId, companion.ownerAddress);
  const setup = useAutonomyActionSetup({
    tokenId: tokenId ?? 0n,
    actionKind: agent.actionKind,
    protocolId: agent.protocolId,
    adapter: agent.adapter,
  });
  const proofs = useAutonomyProofs(tokenId, agent.protocolId);
  const actions = useAutonomyActions();

  const [riskMode, setRiskMode] = useState(1);
  const [dailyLimit, setDailyLimit] = useState<string>(agent.defaultDailyLimit);
  const [maxSpend, setMaxSpend] = useState<string>(agent.defaultMaxSpend);
  const [minReserve, setMinReserve] = useState<string>(agent.defaultMinReserve);
  const [maxFailures, setMaxFailures] = useState<string>('3');

  useEffect(() => {
    setRiskMode(1);
    setDailyLimit(agent.defaultDailyLimit);
    setMaxSpend(agent.defaultMaxSpend);
    setMinReserve(agent.defaultMinReserve);
    setMaxFailures('3');
  }, [agent.defaultDailyLimit, agent.defaultMaxSpend, agent.defaultMinReserve, agent.key]);

  useEffect(() => {
    if (!setup.policy || !setup.risk) return;
    setRiskMode(setup.policy.riskMode);
    setDailyLimit(String(setup.policy.dailyLimit || Number(agent.defaultDailyLimit)));
    setMaxSpend(agent.supportsSpend ? String(Number(setup.policy.maxClwPerAction) / 1e18 || 0) : '0');
    setMinReserve(String(Number(setup.risk.minClwReserve) / 1e18 || 0));
    setMaxFailures(String(setup.risk.maxFailureStreak || 3));
  }, [agent.defaultDailyLimit, agent.supportsSpend, setup.policy, setup.risk]);

  useEffect(() => {
    if (!actions.hash || !actions.isSuccess || lastHandledHash === actions.hash) return;
    setLastHandledHash(actions.hash);
    void Promise.all([setup.refresh(), proofs.refresh(), claimWindow.refresh()]);
  }, [actions.hash, actions.isSuccess, claimWindow, lastHandledHash, proofs, setup]);

  const desiredDailyLimit = Number(dailyLimit || '0');
  const desiredMaxSpendWei = agent.supportsSpend ? parseAmount(maxSpend) : 0n;
  const desiredReserveWei = parseAmount(minReserve);
  const desiredMaxFailures = Number(maxFailures || '0');
  const runtimeRequired = desiredReserveWei + desiredMaxSpendWei;
  const runtimeReady = companion.routerClaworld >= runtimeRequired;

  const riskNeedsUpdate =
    !setup.risk ||
    setup.risk.maxFailureStreak !== desiredMaxFailures ||
    setup.risk.minClwReserve !== desiredReserveWei;

  const policyNeedsUpdate =
    !setup.policy ||
    !setup.policy.enabled ||
    setup.policy.riskMode !== riskMode ||
    setup.policy.dailyLimit !== desiredDailyLimit ||
    setup.policy.maxClwPerAction !== desiredMaxSpendWei;

  const nextStep = useMemo<NextStep>(() => {
    if (!setup.ready) return 'contracts';
    if (!companion.ownerAddress || !companion.connected) return 'owner';
    if (!holderWalletEligible) return 'wallet';
    if (!runtimeReady) return 'runtime';
    if (!setup.protocolApproved) return 'protocol';
    if (!setup.adapterApproved) return 'adapter';
    if (!setup.operatorApproved) return 'operator';
    if (setup.operatorRoleMask !== AUTONOMY_ROLE_MASK.full) return 'roles';
    if (!setup.leaseActive) return 'lease';
    if (riskNeedsUpdate || policyNeedsUpdate) return 'settings';
    if (setup.risk?.emergencyPaused) return 'resume';
    return 'active';
  }, [
    companion.connected,
    companion.ownerAddress,
    holderWalletEligible,
    policyNeedsUpdate,
    riskNeedsUpdate,
    runtimeReady,
    setup.adapterApproved,
    setup.leaseActive,
    setup.operatorApproved,
    setup.operatorRoleMask,
    setup.protocolApproved,
    setup.ready,
    setup.risk,
  ]);

  const permissionReadiness = [
    { key: 'protocol', label: pick('协议', 'Protocol'), ready: setup.protocolApproved },
    { key: 'adapter', label: pick('适配器', 'Adapter'), ready: setup.adapterApproved },
    { key: 'operator', label: pick('执行者', 'Operator'), ready: setup.operatorApproved },
    { key: 'lease', label: pick('租约', 'Lease'), ready: setup.leaseActive },
  ] as const;

  const permissionCount = permissionReadiness.filter((item) => item.ready).length;
  const latestReceipt = proofs.receipts[0] as
    | {
        requestId?: bigint;
        status?: number;
        actualSpend?: bigint;
        clwCredit?: bigint;
        reasoningCid?: string;
        executionRef?: string;
        receiptHash?: string;
        resolvedChoice?: number;
        lastError?: string;
      }
    | undefined;

  const reasoningDoc = useReasoningDoc(latestReceipt?.reasoningCid ? String(latestReceipt.reasoningCid) : undefined);
  const latestStatus = latestReceipt ? receiptStatusText(Number(latestReceipt.status ?? 0), pick) : pick('还没有结果', 'No result yet');
  const latestError = shortError(latestReceipt?.lastError ? String(latestReceipt.lastError) : null, pick);
  const actionError = shortError(actions.error?.message ? String(actions.error.message) : null, pick);

  function handlePrimaryAction() {
    if (!tokenId || actions.isPending || actions.isConfirming || !companion.ownerAddress) return;

    const leaseExpiry = BigInt(Math.floor(Date.now() / 1000) + 30 * 86400);

    if (nextStep === 'protocol') {
      actions.setApprovedProtocol(tokenId, agent.protocolId, true);
      return;
    }
    if (nextStep === 'adapter') {
      actions.setApprovedAdapter(tokenId, agent.actionKind, agent.adapter, true);
      return;
    }
    if (nextStep === 'operator') {
      actions.setApprovedOperator(tokenId, agent.actionKind, AUTONOMY_OPERATOR, true);
      return;
    }
    if (nextStep === 'roles') {
      actions.setOperatorRoleMask(tokenId, agent.actionKind, AUTONOMY_OPERATOR, AUTONOMY_ROLE_MASK.full);
      return;
    }
    if (nextStep === 'lease') {
      actions.setDelegationLease(tokenId, agent.actionKind, AUTONOMY_OPERATOR, AUTONOMY_ROLE_MASK.full, leaseExpiry);
      return;
    }
    if (nextStep === 'resume') {
      actions.setEmergencyPause(tokenId, agent.actionKind, false);
    }
  }

  function handleSaveRisk() {
    if (!tokenId || settingsBlocked || !riskNeedsUpdate) return;
    actions.setRiskControls(tokenId, agent.actionKind, desiredMaxFailures, minReserve || '0');
  }

  function handleSavePolicy() {
    if (!tokenId || settingsBlocked || !policyNeedsUpdate) return;
    actions.setPolicy(
      tokenId,
      agent.actionKind,
      true,
      riskMode,
      desiredDailyLimit,
      agent.supportsSpend ? maxSpend || '0' : '0',
    );
  }

  function handlePauseToggle() {
    if (!tokenId || !setup.policy?.enabled || actions.isPending || actions.isConfirming) return;
    actions.setEmergencyPause(tokenId, agent.actionKind, !Boolean(setup.risk?.emergencyPaused));
  }

  const canAct =
    nextStep !== 'contracts' &&
    nextStep !== 'owner' &&
    nextStep !== 'wallet' &&
    nextStep !== 'runtime' &&
    nextStep !== 'settings' &&
    nextStep !== 'active';

  const reasoningSummary =
    reasoningDoc.status === 'ready'
      ? trimText(reasoningDoc.parsed?.aiResponse || reasoningDoc.raw)
      : reasoningDoc.status === 'digest'
        ? pick('当前只保存了摘要指纹，前端拿不到完整推理全文。', 'Only a digest proof is available right now.')
        : reasoningDoc.status === 'loading'
          ? pick('正在读取推理内容...', 'Loading reasoning...')
          : reasoningDoc.status === 'error'
            ? pick('这条推理内容现在拉不下来。', 'The reasoning document could not be loaded.')
            : pick('这次还没有完整推理文档。', 'No detailed reasoning document yet.');

  const latestStory = describeLatestAction(agent.key, latestReceipt, reasoningDoc, reasoningSummary, pick);

  const setupRows = [
    {
      key: 'wallet',
      label: pick('持有人钱包', 'Owner wallet'),
      detail: companion.connected ? pick('已连接', 'Connected') : pick('还没连接', 'Not connected'),
      ready: companion.connected && Boolean(companion.ownerAddress),
    },
    {
      key: 'threshold',
      label: pick('钱包门槛', 'Wallet threshold'),
      detail: holderWalletEligible ? companion.walletClaworldText : `${companion.walletClaworldText} / ${thresholdLabel}`,
      ready: holderWalletEligible,
    },
    {
      key: 'reserve',
      label: pick('龙虾储备', 'Lobster reserve'),
      detail: runtimeReady ? companion.routerClaworldText : `${companion.routerClaworldText} / ${formatCLW(runtimeRequired)}`,
      ready: runtimeReady,
    },
    {
      key: 'protocol',
      label: pick('协议授权', 'Protocol approval'),
      detail: setup.protocolApproved ? pick('已完成', 'Ready') : pick('还没授权', 'Pending'),
      ready: setup.protocolApproved,
    },
    {
      key: 'adapter',
      label: pick('适配器授权', 'Adapter approval'),
      detail: setup.adapterApproved ? pick('已完成', 'Ready') : pick('还没授权', 'Pending'),
      ready: setup.adapterApproved,
    },
    {
      key: 'operator',
      label: pick('执行者授权', 'Operator approval'),
      detail: setup.operatorApproved && setup.operatorRoleMask === AUTONOMY_ROLE_MASK.full ? pick('已完成', 'Ready') : pick('还没授权', 'Pending'),
      ready: setup.operatorApproved && setup.operatorRoleMask === AUTONOMY_ROLE_MASK.full,
    },
    {
      key: 'lease',
      label: pick('租约', 'Lease'),
      detail: setup.leaseActive ? pick('已完成', 'Ready') : pick('还没签发', 'Pending'),
      ready: setup.leaseActive,
    },
  ];

  const settingsBlocked =
    !tokenId ||
    !companion.connected ||
    !companion.ownerAddress ||
    actions.isPending ||
    actions.isConfirming;

  const canSaveRisk = !settingsBlocked && riskNeedsUpdate;
  const canSavePolicy = !settingsBlocked && policyNeedsUpdate;

  return (
    <WalletGate
      title={pick('先连接持有人钱包', 'Connect owner wallet first')}
      detail={pick('连接后才可以开代理、改参数和看结果。', 'Connect before enabling the agent and editing settings.')}
    >
      <section className="cw-panel cw-panel--warm">
        <div className="cw-section-head">
          <div>
            <span className="cw-label">{pick('AI 代理', 'AI agent')}</span>
            <h3>{getActionLabel(agent.key, pick)}</h3>
            <p className="cw-muted">
              {pick('开通后后台会持续巡检，条件合适就自动出手。', 'Once enabled, the backend keeps checking and acts when conditions fit.')}
            </p>
          </div>
          <span className={`cw-chip ${setup.policy?.enabled && !setup.risk?.emergencyPaused ? 'cw-chip--growth' : 'cw-chip--cool'}`}>
            <Bot size={14} />
            {setup.policy?.enabled && !setup.risk?.emergencyPaused ? pick('已开启', 'Enabled') : pick('未开启', 'Disabled')}
          </span>
        </div>

        <div className="cw-segmented">
          {(['task', 'pk', 'battleRoyale'] as AgentKey[]).map((key) => (
            <button
              key={key}
              type="button"
              className={`cw-segmented-btn ${selectedAgent === key ? 'cw-segmented-btn--active' : ''}`}
              onClick={() => setSelectedAgent(key)}
            >
              {key === 'task' ? <Sparkles size={14} /> : key === 'pk' ? <Swords size={14} /> : <Trophy size={14} />}
              {getActionLabel(key, pick)}
            </button>
          ))}
        </div>

        <div className="cw-state-grid">
          <div className="cw-state-card">
            <span className="cw-label">{pick('钱包门槛', 'Wallet threshold')}</span>
            <strong>{thresholdLabel}</strong>
            <p className="cw-muted">{pick(`当前 ${companion.walletClaworldText}`, `Now ${companion.walletClaworldText}`)}</p>
          </div>
          <div className="cw-state-card">
            <span className="cw-label">{pick('龙虾储备', 'Lobster reserve')}</span>
            <strong>{companion.routerClaworldText}</strong>
            <p className="cw-muted">{pick(`保底 + 单次花费至少 ${formatCLW(runtimeRequired)}`, `Reserve + spend needs ${formatCLW(runtimeRequired)}`)}</p>
          </div>
          <div className="cw-state-card">
            <span className="cw-label">{pick('触发方式', 'Trigger')}</span>
            <strong>{pick('自动巡检', 'Automatic')}</strong>
            <p className="cw-muted">{pick('开通后后台会持续检查。', 'The backend keeps checking after setup.')}</p>
          </div>
        </div>
      </section>

      <section className="cw-panel cw-panel--cool">
        <div className="cw-section-head">
          <div>
            <span className="cw-label">{pick('开通代理', 'Setup')}</span>
            <h3>{nextStepTitle(nextStep, pick)}</h3>
            <p className="cw-muted">
              {nextStep === 'settings'
                ? pick('授权已经差不多了。下面保存运行设置就行，不用回头重填授权。', 'Approvals are almost done. Save the run settings below and you are done.')
                : nextStepDetail(nextStep, thresholdLabel, pick)}
            </p>
          </div>
          <span className={`cw-chip ${nextStep === 'active' ? 'cw-chip--growth' : 'cw-chip--warm'}`}>
            <Shield size={14} />
            {permissionCount}/4
          </span>
        </div>

        <div className="cw-list">
          {setupRows.map((item) => (
            <div key={item.key} className={`cw-list-item ${item.ready ? 'cw-list-item--growth' : 'cw-list-item--cool'}`}>
              {item.ready ? <CheckCircle2 size={16} /> : <Shield size={16} />}
              <div className="cw-proof-copy">
                <strong>{item.label}</strong>
                <span>{item.detail}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="cw-button-row">
          <button type="button" className="cw-button cw-button--primary" disabled={!canAct || actions.isPending || actions.isConfirming} onClick={handlePrimaryAction}>
            <PlayCircle size={16} />
            {actions.isPending
              ? pick('等待签名', 'Waiting for signature')
              : actions.isConfirming
                ? pick('链上确认中', 'Confirming')
                : primaryButtonText(nextStep, pick)}
          </button>

          {setup.policy?.enabled ? (
            <button type="button" className="cw-button cw-button--ghost" disabled={actions.isPending || actions.isConfirming} onClick={handlePauseToggle}>
              {setup.risk?.emergencyPaused ? <PlayCircle size={16} /> : <PauseCircle size={16} />}
              {setup.risk?.emergencyPaused ? pick('恢复代理', 'Resume agent') : pick('暂停代理', 'Pause agent')}
            </button>
          ) : null}

          <button type="button" className="cw-button cw-button--ghost" onClick={() => setShowAdvanced((value) => !value)}>
            <Settings2 size={16} />
            {showAdvanced ? pick('收起高级', 'Hide advanced') : pick('高级', 'Advanced')}
          </button>
        </div>

        {actions.isPending ? (
          <div className="cw-list">
            <div className="cw-list-item cw-list-item--warm">
              <Shield size={16} />
              <span>{pick('这一步只是签名授权。参数不会在这里重置。', 'This step only needs a signature. Your settings do not reset here.')}</span>
            </div>
          </div>
        ) : null}

        {actions.isConfirming ? (
          <div className="cw-list">
            <div className="cw-list-item cw-list-item--warm">
              <Shield size={16} />
              <span>{pick('链上确认后，后台会继续按定时任务巡检。', 'After confirmation, the backend keeps running on its schedule.')}</span>
            </div>
          </div>
        ) : null}

        {actionError ? (
          <div className="cw-list">
            <div className="cw-list-item cw-list-item--alert">
              <Shield size={16} />
              <span>{actionError}</span>
            </div>
          </div>
        ) : null}
      </section>

      <section className="cw-panel cw-panel--cool">
        <div className="cw-section-head">
          <div>
            <span className="cw-label">{pick('运行设置', 'Run settings')}</span>
            <h3>{pick('这些数值只在这里改', 'Edit live settings here')}</h3>
            <p className="cw-muted">{pick('授权负责开通。风格、预算、保底都在这里保存。', 'Approvals open the path. Style, budget, and reserve are saved here.')}</p>
          </div>
        </div>

        <div className="cw-field-grid">
          <label className="cw-field">
            <span className="cw-label">{pick('风格', 'Style')}</span>
            <select value={riskMode} onChange={(event) => setRiskMode(Number(event.target.value))} className="cw-input">
              <option value={0}>{pick('保守', 'Conservative')}</option>
              <option value={1}>{pick('平衡', 'Balanced')}</option>
              <option value={2}>{pick('激进', 'Aggressive')}</option>
            </select>
          </label>

          <label className="cw-field">
            <span className="cw-label">{pick('每日最多几次', 'Daily limit')}</span>
            <input value={dailyLimit} onChange={(event) => setDailyLimit(event.target.value)} type="number" min="0" className="cw-input" />
          </label>

          {agent.supportsSpend ? (
            <label className="cw-field">
              <span className="cw-label">{pick('单次最多花多少', 'Max spend')}</span>
              <input value={maxSpend} onChange={(event) => setMaxSpend(event.target.value)} type="number" min="0" step="0.01" className="cw-input" />
            </label>
          ) : null}

          <label className="cw-field">
            <span className="cw-label">{pick('最低保底', 'Minimum reserve')}</span>
            <input value={minReserve} onChange={(event) => setMinReserve(event.target.value)} type="number" min="0" step="0.01" className="cw-input" />
          </label>

          <label className="cw-field">
            <span className="cw-label">{pick('连续失败几次暂停', 'Failure breaker')}</span>
            <input value={maxFailures} onChange={(event) => setMaxFailures(event.target.value)} type="number" min="1" className="cw-input" />
          </label>
        </div>

        <div className="cw-button-row">
          <button type="button" className="cw-button cw-button--secondary" disabled={!canSaveRisk} onClick={handleSaveRisk}>
            <Shield size={16} />
            {riskNeedsUpdate ? pick('保存保底与熔断', 'Save reserve and breaker') : pick('保底已保存', 'Reserve saved')}
          </button>
          <button type="button" className="cw-button cw-button--primary" disabled={!canSavePolicy} onClick={handleSavePolicy}>
            <PlayCircle size={16} />
            {policyNeedsUpdate ? pick('保存运行设置', 'Save run settings') : pick('设置已保存', 'Settings saved')}
          </button>
        </div>

        <div className="cw-state-grid">
          <div className="cw-state-card">
            <span className="cw-label">{pick('当前风格', 'Current style')}</span>
            <strong>{riskMode === 0 ? pick('保守', 'Conservative') : riskMode === 2 ? pick('激进', 'Aggressive') : pick('平衡', 'Balanced')}</strong>
          </div>
          <div className="cw-state-card">
            <span className="cw-label">{pick('每日次数', 'Daily limit')}</span>
            <strong>{dailyLimit || '--'}</strong>
          </div>
          <div className="cw-state-card">
            <span className="cw-label">{pick('最低保底', 'Minimum reserve')}</span>
            <strong>{formatCLW(desiredReserveWei)}</strong>
          </div>
        </div>
      </section>

      {tokenId !== undefined ? (
        <AutonomyDirectivePanel
          tokenId={tokenId}
          actionKind={agent.actionKind}
          ownerAddress={companion.ownerAddress}
          title={pick('一句提示', 'Prompt')}
        />
      ) : null}

      <section className="cw-panel cw-panel--cool">
        <div className="cw-section-head">
          <div>
            <span className="cw-label">{pick('最近动作', 'Latest result')}</span>
            <h3>{latestStory.target}</h3>
            <p className="cw-muted">{latestStory.why}</p>
          </div>
          <span className={`cw-chip ${latestReceipt && Number(latestReceipt.status ?? 0) === 4 ? 'cw-chip--growth' : 'cw-chip--cool'}`}>
            <CheckCircle2 size={14} />
            {latestStatus}
          </span>
        </div>

        <div className="cw-state-grid">
          <div className="cw-state-card">
            <span className="cw-label">{pick('做了什么', 'Action')}</span>
            <strong>{latestStory.action}</strong>
            <p className="cw-muted">{latestStory.target}</p>
          </div>
          <div className="cw-state-card">
            <span className="cw-label">{pick('怎么选的', 'Choice')}</span>
            <strong>{latestStory.decision}</strong>
            <p className="cw-muted">{latestReceipt ? `#${latestReceipt.requestId?.toString() ?? '-'}` : pick('还没有动作', 'No action yet')}</p>
          </div>
          <div className="cw-state-card">
            <span className="cw-label">{pick('结果', 'Result')}</span>
            <strong>{latestStory.result}</strong>
            <p className="cw-muted">{latestError ?? pick('点开高级看完整推理。', 'Open Advanced for the full reasoning.')}</p>
          </div>
        </div>

        {latestError ? (
          <div className="cw-list">
            <div className="cw-list-item cw-list-item--alert">
              <Shield size={16} />
              <span>{latestError}</span>
            </div>
          </div>
        ) : null}
      </section>

      {showAdvanced ? (
        <>
          <section className="cw-panel cw-panel--cool">
            <div className="cw-section-head">
              <div>
                <span className="cw-label">{pick('高级', 'Advanced')}</span>
                <h3>{pick('推理过程与链上记录', 'Reasoning and chain records')}</h3>
              </div>
            </div>

            <div className="cw-proof-box">
              <div className="cw-proof-grid">
                <div>
                  <span className="cw-label">{pick('动作', 'Action')}</span>
                  <strong>{latestStory.action}</strong>
                </div>
                <div>
                  <span className="cw-label">{pick('对局 / 目标', 'Target')}</span>
                  <strong>{latestStory.target}</strong>
                </div>
                <div>
                  <span className="cw-label">{pick('选择', 'Choice')}</span>
                  <strong>{latestStory.decision}</strong>
                </div>
                <div>
                  <span className="cw-label">{pick('结果', 'Result')}</span>
                  <strong>{latestStory.result}</strong>
                </div>
              </div>

              <div className="cw-proof-section">
                <span className="cw-label">{pick('为什么这样做', 'Why it did this')}</span>
                <p>{reasoningSummary}</p>
              </div>

              {latestStory.selectedOption ? (
                <div className="cw-proof-section">
                  <span className="cw-label">{pick('实际选项', 'Picked option')}</span>
                  <p>{latestStory.selectedOption}</p>
                </div>
              ) : null}

              {reasoningDoc.status === 'ready' && reasoningDoc.parsed ? (
                <>
                  <div className="cw-proof-section">
                    <span className="cw-label">{pick('提示词', 'Prompt')}</span>
                    <p>{trimText(reasoningDoc.parsed.prompt, 320)}</p>
                  </div>
                  <div className="cw-proof-section">
                    <span className="cw-label">{pick('模型输出', 'Model output')}</span>
                    <p>{trimText(reasoningDoc.parsed.aiResponse, 420)}</p>
                  </div>
                  {reasoningDoc.parsed.memoryContext?.prompt ? (
                    <div className="cw-proof-section">
                      <span className="cw-label">{pick('记忆影响', 'Memory influence')}</span>
                      <p>{trimText(reasoningDoc.parsed.memoryContext.prompt, 240)}</p>
                    </div>
                  ) : null}
                </>
              ) : null}

              {latestReceipt?.reasoningCid ? (
                <div className="cw-proof-section">
                  <span className="cw-label">{pick('推理证明', 'Reasoning proof')}</span>
                  <code className="cw-proof-code">{String(latestReceipt.reasoningCid)}</code>
                </div>
              ) : null}

              {latestReceipt?.executionRef ? (
                <div className="cw-proof-section">
                  <span className="cw-label">{pick('执行回执', 'Execution ref')}</span>
                  <code className="cw-proof-code">{String(latestReceipt.executionRef)}</code>
                </div>
              ) : null}

              {latestReceipt?.receiptHash ? (
                <div className="cw-proof-section">
                  <span className="cw-label">{pick('链上回执', 'Receipt hash')}</span>
                  <code className="cw-proof-code">{String(latestReceipt.receiptHash)}</code>
                </div>
              ) : null}
            </div>
          </section>

          {agent.key === 'battleRoyale' && tokenId !== undefined ? (
            <AutonomyClaimRequestPanel
              tokenId={tokenId}
              ownerAddress={companion.ownerAddress}
              matchId={claimWindow.matchId}
              claimable={claimWindow.claimable}
              preferredPath={claimWindow.preferredPath?.key}
              hasConflict={claimWindow.hasConflict}
              policyEnabled={Boolean(setup.policy?.enabled)}
              permissionCount={permissionCount}
              missingPermissions={permissionReadiness.filter((item) => !item.ready).map((item) => item.label)}
              emergencyPaused={Boolean(setup.risk?.emergencyPaused)}
            />
          ) : null}
        </>
      ) : null}
    </WalletGate>
  );
}
