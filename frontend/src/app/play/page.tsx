'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  Hammer,
  Shield,
  Sparkles,
  Swords,
  TimerReset,
} from 'lucide-react';
import {
  decodeEventLog,
  parseEther,
  type Address,
} from 'viem';
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi';

import { OwnedCompanionRail } from '@/components/lobster/OwnedCompanionRail';
import { useActiveCompanion } from '@/components/lobster/useActiveCompanion';
import { TaskSkillABI } from '@/contracts/abis/TaskSkill';
import { addresses, getBscScanTxUrl } from '@/contracts/addresses';
import { formatBasisPoints, formatBNB, formatCLW } from '@/lib/format';

type TaskTone = 'cw-card--ready' | 'cw-card--watch' | 'cw-card--safe' | 'cw-card--warning';

type TaskTemplate = {
  key: string;
  title: string;
  taskType: number;
  xpReward: number;
  requestedClw: bigint;
  score: number;
  detail: string;
  icon: typeof Sparkles;
  tone: TaskTone;
};

type TaskPreview = {
  matchScore: number;
  actualClw: bigint;
  streakMul: bigint;
  worldMul: bigint;
  cooldownReady: boolean;
  personalityDrift: boolean;
};

type TaskResult = {
  taskTitle: string;
  requestedClw: bigint;
  actualClw: bigint;
  xpReward: number;
  matchScore: number;
  txHash: `0x${string}`;
  driftState: 'applied' | 'skipped' | 'none';
  driftReason?: string;
};

const taskSkillContract = {
  address: addresses.taskSkill,
  abi: TaskSkillABI,
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return 'Task transaction failed.';
  if (error.message.includes('Cooldown active')) return 'Task cooldown is still active.';
  if (error.message.includes('Not NFA owner')) return 'Connected wallet does not own this NFA.';
  if (error.message.includes('XP cap exceeded')) return 'XP reward exceeds the current TaskSkill cap.';
  if (error.message.includes('CLW cap exceeded')) return 'Requested Claworld reward exceeds the current TaskSkill cap.';
  if (error.message.includes('User rejected')) return 'Wallet signature was rejected.';
  return error.message;
}

function formatRemaining(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  const parts = [
    hours > 0 ? `${hours}h` : null,
    minutes > 0 ? `${minutes}m` : null,
    hours === 0 ? `${secs}s` : null,
  ].filter(Boolean);
  return parts.join(' ') || '0s';
}

function buildTaskTemplates(
  traits: {
    courage: number;
    wisdom: number;
    social: number;
    create: number;
    grit: number;
  },
  level: number,
  upkeepPressure: number,
  active: boolean,
  upkeepDays: number | null,
) {
  const levelLift = level * 2;

  return [
    {
      key: 'adventure',
      title: 'Adventure',
      taskType: 0,
      xpReward: clamp(16 + level * 2, 12, 32),
      requestedClw: parseEther(
        String(
          Math.max(8, Math.round(traits.courage * 0.22 + traits.grit * 0.14 + level * 1.8)),
        ),
      ),
      score: clamp(
        Math.round(
          traits.courage * 0.62 + traits.grit * 0.36 + levelLift - upkeepPressure * 0.25,
        ),
        8,
        99,
      ),
      detail:
        traits.courage >= traits.wisdom
          ? 'Leans into courage and grit. Best when you want upside and the reserve can handle it.'
          : 'Still viable, but this lobster is not primarily aggression-led right now.',
      icon: Swords,
      tone: active ? 'cw-card--ready' : 'cw-card--warning',
    },
    {
      key: 'puzzle',
      title: 'Puzzle',
      taskType: 1,
      xpReward: clamp(14 + level * 2, 12, 30),
      requestedClw: parseEther(
        String(
          Math.max(6, Math.round(traits.wisdom * 0.16 + traits.create * 0.08 + level * 1.2)),
        ),
      ),
      score: clamp(
        Math.round(
          traits.wisdom * 0.7 + traits.create * 0.18 + levelLift - upkeepPressure * 0.16,
        ),
        8,
        99,
      ),
      detail:
        traits.wisdom >= 55
          ? 'Stronger fit when the current goal is cleaner growth and lower variance.'
          : 'Useful as a steadier line even when it is not the highest-upside task.',
      icon: Shield,
      tone: 'cw-card--watch',
    },
    {
      key: 'crafting',
      title: 'Crafting',
      taskType: 3,
      xpReward: clamp(12 + level * 2, 10, 28),
      requestedClw: parseEther(
        String(
          Math.max(4, Math.round(traits.create * 0.12 + traits.social * 0.06 + level)),
        ),
      ),
      score: clamp(
        Math.round(
          traits.create * 0.58 + traits.social * 0.22 + levelLift - upkeepPressure * 0.1,
        ),
        8,
        99,
      ),
      detail:
        upkeepDays !== null && upkeepDays <= 2
          ? 'Reserve is tighter, so the lower-variance route deserves more weight.'
          : 'Best when preserving budget matters more than chasing the highest return.',
      icon: Hammer,
      tone: upkeepDays !== null && upkeepDays <= 2 ? 'cw-card--warning' : 'cw-card--safe',
    },
  ] satisfies TaskTemplate[];
}

export default function PlayPage() {
  const companion = useActiveCompanion();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: hash, error, isPending, writeContract } = useWriteContract();
  const receiptQuery = useWaitForTransactionReceipt({ hash });

  const [selectedTaskKey, setSelectedTaskKey] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [gasUnits, setGasUnits] = useState<bigint | null>(null);
  const [gasCostWei, setGasCostWei] = useState<bigint | null>(null);
  const [gasEstimateError, setGasEstimateError] = useState<string | null>(null);
  const [result, setResult] = useState<TaskResult | null>(null);
  const [submittedTask, setSubmittedTask] = useState<TaskTemplate | null>(null);
  const [submittedPreview, setSubmittedPreview] = useState<TaskPreview | null>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  const upkeepPressure =
    companion.upkeepDays === null ? 0 : clamp(100 - companion.upkeepDays * 12, 0, 42);
  const taskTemplates = useMemo(
    () =>
      buildTaskTemplates(
        companion.traits,
        companion.level,
        upkeepPressure,
        companion.active,
        companion.upkeepDays,
      ),
    [companion.active, companion.level, companion.traits, companion.upkeepDays, upkeepPressure],
  );

  const rankedTaskTemplates = useMemo(
    () => [...taskTemplates].sort((left, right) => right.score - left.score),
    [taskTemplates],
  );

  const topTask = rankedTaskTemplates[0];
  const reserveFloor = companion.dailyCost > 0n ? companion.dailyCost * 3n : 0n;

  useEffect(() => {
    if (!topTask) return;
    setSelectedTaskKey((current) => {
      if (current && rankedTaskTemplates.some((task) => task.key === current)) return current;
      return topTask.key;
    });
  }, [rankedTaskTemplates, topTask]);

  useEffect(() => {
    setConfirmOpen(false);
    setResult(null);
    setSubmittedTask(null);
    setSubmittedPreview(null);
  }, [companion.tokenId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const selectedTask = rankedTaskTemplates.find((task) => task.key === selectedTaskKey) ?? topTask;

  const previewQuery = useReadContract({
    ...taskSkillContract,
    functionName: 'previewTypedTaskOutcome',
    args:
      companion.hasToken && selectedTask
        ? [
            companion.tokenId,
            selectedTask.taskType,
            selectedTask.xpReward,
            selectedTask.requestedClw,
          ]
        : undefined,
    query: { enabled: companion.hasToken && Boolean(selectedTask) },
  });

  const lastTaskTimeQuery = useReadContract({
    ...taskSkillContract,
    functionName: 'lastTaskTime',
    args: companion.hasToken ? [companion.tokenId] : undefined,
    query: { enabled: companion.hasToken },
  });

  const preview = useMemo(() => {
    const data = previewQuery.data as
      | readonly [number, bigint, bigint, bigint, boolean, boolean]
      | undefined;
    if (!data) return null;
    return {
      matchScore: Number(data[0] ?? 0),
      actualClw: BigInt(data[1] ?? 0n),
      streakMul: BigInt(data[2] ?? 0n),
      worldMul: BigInt(data[3] ?? 0n),
      cooldownReady: Boolean(data[4]),
      personalityDrift: Boolean(data[5]),
    } satisfies TaskPreview;
  }, [previewQuery.data]);

  const lastTaskTime = Number(lastTaskTimeQuery.data?.toString() ?? '0');
  const cooldownEndsAt = lastTaskTime > 0 ? lastTaskTime + 4 * 60 * 60 : 0;
  const cooldownRemaining = Math.max(0, cooldownEndsAt - now);
  const effectiveCooldownReady = preview?.cooldownReady ?? cooldownRemaining === 0;

  const flowStage = result
    ? 'result'
    : receiptQuery.isLoading || isPending
      ? 'executing'
      : confirmOpen
        ? 'confirm'
        : selectedTask
          ? 'preview'
          : 'idle';

  useEffect(() => {
    let cancelled = false;

    async function estimateGas() {
      if (
        !publicClient ||
        !address ||
        !companion.hasToken ||
        !selectedTask ||
        !preview ||
        !effectiveCooldownReady
      ) {
        setGasUnits(null);
        setGasCostWei(null);
        setGasEstimateError(null);
        return;
      }

      try {
        const [estimated, gasPrice] = await Promise.all([
          publicClient.estimateContractGas({
            ...taskSkillContract,
            functionName: 'ownerCompleteTypedTask',
            args: [
              companion.tokenId,
              selectedTask.taskType,
              selectedTask.xpReward,
              selectedTask.requestedClw,
              preview.matchScore,
            ],
            account: address as Address,
          }),
          publicClient.getGasPrice(),
        ]);

        if (!cancelled) {
          setGasUnits(estimated);
          setGasCostWei(estimated * gasPrice);
          setGasEstimateError(null);
        }
      } catch (estimateFailure) {
        if (!cancelled) {
          setGasUnits(null);
          setGasCostWei(null);
          setGasEstimateError(getErrorMessage(estimateFailure));
        }
      }
    }

    void estimateGas();

    return () => {
      cancelled = true;
    };
  }, [address, companion.hasToken, companion.tokenId, effectiveCooldownReady, preview, publicClient, selectedTask]);

  useEffect(() => {
    if (!receiptQuery.data || !hash || !submittedTask) return;

    let actualClw = submittedPreview?.actualClw ?? submittedTask.requestedClw;
    let matchScore = submittedPreview?.matchScore ?? 0;
    let driftState: TaskResult['driftState'] = 'none';
    let driftReason: string | undefined;

    for (const log of receiptQuery.data.logs) {
      if (log.address.toLowerCase() !== addresses.taskSkill.toLowerCase()) continue;
      try {
        const decoded = decodeEventLog({
          abi: TaskSkillABI,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === 'TaskCompleted') {
          actualClw = BigInt(decoded.args.actualClw ?? actualClw);
          matchScore = Number(decoded.args.matchScore ?? matchScore);
        }
        if (decoded.eventName === 'TaskPersonalityDrift') {
          driftState = 'applied';
        }
        if (decoded.eventName === 'TaskPersonalityDriftSkipped') {
          driftState = 'skipped';
          driftReason = decoded.args.reason;
        }
      } catch {
        continue;
      }
    }

    setResult({
      taskTitle: submittedTask.title,
      requestedClw: submittedTask.requestedClw,
      actualClw,
      xpReward: submittedTask.xpReward,
      matchScore,
      txHash: hash,
      driftState,
      driftReason,
    });
    setConfirmOpen(false);
    setSubmittedTask(null);
    setSubmittedPreview(null);
  }, [hash, receiptQuery.data, submittedPreview, submittedTask]);

  const canExecute =
    companion.hasToken &&
    companion.active &&
    Boolean(selectedTask) &&
    Boolean(preview) &&
    effectiveCooldownReady &&
    Boolean(address);

  const taskPulse = error
    ? {
        tone: 'cw-panel--cool',
        chip: 'Failed',
        chipTone: 'cw-chip--alert',
        title: 'Task request failed',
        detail: getErrorMessage(error),
      }
    : isPending
      ? {
          tone: 'cw-panel--warm',
          chip: 'Sign',
          chipTone: 'cw-chip--warm',
          title: selectedTask ? `Sign ${selectedTask.title}` : 'Sign task',
          detail: 'The task preview is locked. Confirm the owner-path transaction in the wallet to continue.',
        }
      : receiptQuery.isLoading && submittedTask
        ? {
            tone: 'cw-panel--warm',
            chip: 'Confirming',
            chipTone: 'cw-chip--warm',
            title: `${submittedTask.title} is confirming on-chain`,
            detail: 'The transaction is live on BNB Chain. Hold this surface until the receipt lands and the result panel resolves.',
          }
        : null;

  function handleReview(taskKey: string) {
    setSelectedTaskKey(taskKey);
    setConfirmOpen(false);
    setResult(null);
  }

  function handleOpenConfirm() {
    if (!selectedTask || !preview) return;
    setConfirmOpen(true);
    setResult(null);
  }

  function handleExecute() {
    if (!selectedTask || !preview || !canExecute) return;

    setSubmittedTask(selectedTask);
    setSubmittedPreview(preview);
    writeContract({
      ...taskSkillContract,
      functionName: 'ownerCompleteTypedTask',
      args: [
        companion.tokenId,
        selectedTask.taskType,
        selectedTask.xpReward,
        selectedTask.requestedClw,
        preview.matchScore,
      ],
    });
  }

  return (
    <>
      <section className="cw-band">
        <div className="cw-band--split">
          <div>
            <p className="cw-eyebrow">Task mining</p>
            <h2 className="cw-section-title">{companion.name} now runs a full task loop.</h2>
            <p className="cw-muted">
              The play surface now goes from live task fit to preview, confirm, on-chain execution, and result state.
            </p>
          </div>
          <div className="cw-score">
            <strong>{topTask.score}%</strong>
            <span>top fit</span>
          </div>
        </div>
      </section>

      <OwnedCompanionRail
        title="Task roster"
        subtitle="Switch the active lobster before committing to the next work loop."
      />

      <section className="cw-panel cw-panel--warm">
        <div className="cw-section-head">
          <div>
            <span className="cw-label">Loop state</span>
            <h3>{topTask.title} is currently the best fit.</h3>
            <p className="cw-muted">
              Reserve {companion.routerClaworldText} / safety floor {formatCLW(reserveFloor)} / upkeep {companion.dailyCostText}.
            </p>
          </div>
          <span className={`cw-chip ${effectiveCooldownReady ? 'cw-chip--growth' : 'cw-chip--alert'}`}>
            <TimerReset size={14} />
            {effectiveCooldownReady ? 'Ready now' : formatRemaining(cooldownRemaining)}
          </span>
        </div>

        <div className="cw-flow-track">
          {[
            { key: 'preview', label: 'Preview' },
            { key: 'confirm', label: 'Confirm' },
            { key: 'executing', label: 'Execute' },
            { key: 'result', label: 'Result' },
          ].map((step) => {
            const active =
              flowStage === step.key ||
              (flowStage === 'confirm' && step.key === 'preview') ||
              (flowStage === 'executing' && (step.key === 'preview' || step.key === 'confirm')) ||
              (flowStage === 'result' && step.key !== 'idle');
            return (
              <div key={step.key} className={`cw-flow-node ${active ? 'cw-flow-node--active' : ''}`}>
                <span>{step.label}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="cw-card-stack">
        {rankedTaskTemplates.map((task) => {
          const Icon = task.icon;
          const selected = selectedTask?.key === task.key;
          return (
            <button
              key={task.key}
              type="button"
              className={`cw-card cw-card--button ${task.tone} ${selected ? 'cw-card--selected' : ''}`}
              onClick={() => handleReview(task.key)}
            >
              <div className="cw-card-icon">
                <Icon size={18} />
              </div>
              <div className="cw-card-copy">
                <p className="cw-label">{task.title}</p>
                <h3>~{formatCLW(task.requestedClw)} Clawworld</h3>
                <p className="cw-muted">{task.detail}</p>
              </div>
              <div className="cw-score">
                <strong>{task.score}%</strong>
                <span>match</span>
              </div>
            </button>
          );
        })}
      </section>

      <section className="cw-panel cw-panel--cool">
        <div className="cw-section-head">
          <div>
            <span className="cw-label">Preview</span>
            <h3>{selectedTask?.title ?? 'Select a task'} execution readout</h3>
            <p className="cw-muted">
              Preview reads the actual TaskSkill quote before the wallet signs the task.
            </p>
          </div>
          <span className={`cw-chip ${preview?.cooldownReady ? 'cw-chip--growth' : 'cw-chip--alert'}`}>
            <Sparkles size={14} />
            {preview ? `${Math.round(preview.matchScore / 100)}% match` : 'No preview yet'}
          </span>
        </div>

        <div className="cw-state-grid">
          <div className="cw-state-card">
            <span className="cw-label">Requested reward</span>
            <strong>{selectedTask ? formatCLW(selectedTask.requestedClw) : '--'}</strong>
          </div>
          <div className="cw-state-card">
            <span className="cw-label">Projected reward</span>
            <strong>{preview ? formatCLW(preview.actualClw) : '--'}</strong>
          </div>
          <div className="cw-state-card">
            <span className="cw-label">XP reward</span>
            <strong>{selectedTask?.xpReward ?? '--'}</strong>
          </div>
        </div>

        <div className="cw-detail-list">
          <div className="cw-detail-row">
            <span>Cooldown</span>
            <strong>{effectiveCooldownReady ? 'Ready' : formatRemaining(cooldownRemaining)}</strong>
          </div>
          <div className="cw-detail-row">
            <span>Streak multiplier</span>
            <strong>{preview ? formatBasisPoints(preview.streakMul) : '--'}</strong>
          </div>
          <div className="cw-detail-row">
            <span>World multiplier</span>
            <strong>{preview ? formatBasisPoints(preview.worldMul) : '--'}</strong>
          </div>
          <div className="cw-detail-row">
            <span>Gas estimate</span>
            <strong>{gasCostWei !== null ? `${formatBNB(gasCostWei, 6)} BNB` : '--'}</strong>
          </div>
        </div>

        <div className="cw-list">
          {!companion.active ? (
            <div className="cw-list-item cw-list-item--cool">
              <TimerReset size={16} />
              <span>This lobster needs upkeep before a new task can execute.</span>
            </div>
          ) : null}
          {!effectiveCooldownReady ? (
            <div className="cw-list-item cw-list-item--cool">
              <TimerReset size={16} />
              <span>Task cooldown is still active for another {formatRemaining(cooldownRemaining)}.</span>
            </div>
          ) : null}
          {preview?.personalityDrift ? (
            <div className="cw-list-item cw-list-item--warm">
              <Sparkles size={16} />
              <span>This task qualifies for personality drift if the run lands cleanly.</span>
            </div>
          ) : (
            <div className="cw-list-item cw-list-item--cool">
              <Shield size={16} />
              <span>This route is a low-drift line focused on steady progression.</span>
            </div>
          )}
          {gasEstimateError ? (
            <div className="cw-list-item cw-list-item--cool">
              <Shield size={16} />
              <span>Gas estimate failed: {gasEstimateError}</span>
            </div>
          ) : null}
          {previewQuery.error ? (
            <div className="cw-list-item cw-list-item--cool">
              <Shield size={16} />
              <span>Preview failed: {getErrorMessage(previewQuery.error)}</span>
            </div>
          ) : null}
        </div>

        <div className="cw-button-row">
          <button
            type="button"
            className="cw-button cw-button--primary"
            disabled={!selectedTask || !preview || !companion.active}
            onClick={handleOpenConfirm}
          >
            <CheckCircle2 size={16} />
            Review before execute
          </button>
        </div>
      </section>

      {confirmOpen && selectedTask && preview ? (
        <section className="cw-sheet">
          <div className="cw-sheet-head">
            <div>
              <span className="cw-label">Confirm task</span>
              <h3>{selectedTask.title}</h3>
              <p className="cw-muted">
                Owner path execution. The wallet signs `ownerCompleteTypedTask(...)` directly.
              </p>
            </div>
            <span className={`cw-chip ${canExecute ? 'cw-chip--warm' : 'cw-chip--alert'}`}>
              {canExecute ? 'Ready' : 'Blocked'}
            </span>
          </div>

          <div className="cw-state-grid">
            <div className="cw-state-card">
              <span className="cw-label">Projected reward</span>
              <strong>{formatCLW(preview.actualClw)}</strong>
            </div>
            <div className="cw-state-card">
              <span className="cw-label">XP gain</span>
              <strong>{selectedTask.xpReward}</strong>
            </div>
            <div className="cw-state-card">
              <span className="cw-label">Reserve after task</span>
              <strong>{formatCLW(companion.routerClaworld + preview.actualClw)}</strong>
            </div>
          </div>

          <div className="cw-detail-list">
            <div className="cw-detail-row">
              <span>Personality match</span>
              <strong>{Math.round(preview.matchScore / 100)}%</strong>
            </div>
            <div className="cw-detail-row">
              <span>Wallet</span>
              <strong>{address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not connected'}</strong>
            </div>
            <div className="cw-detail-row">
              <span>Estimated gas</span>
              <strong>{gasCostWei !== null ? formatBNB(gasCostWei, 6) : '--'} BNB</strong>
            </div>
            <div className="cw-detail-row">
              <span>Drift path</span>
              <strong>{preview.personalityDrift ? 'Possible' : 'Not triggered'}</strong>
            </div>
          </div>

          <div className="cw-button-row">
            <button
              type="button"
              className="cw-button cw-button--primary"
              disabled={!canExecute || isPending || receiptQuery.isLoading}
              onClick={handleExecute}
            >
              <Sparkles size={16} />
              {isPending ? 'Sign task' : receiptQuery.isLoading ? 'Confirming' : 'Execute task'}
            </button>
            <button
              type="button"
              className="cw-button cw-button--ghost"
              disabled={isPending || receiptQuery.isLoading}
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      {taskPulse ? (
        <section className={`cw-panel ${taskPulse.tone}`}>
          <div className="cw-section-head">
            <div>
              <span className="cw-label">Task pulse</span>
              <h3>{taskPulse.title}</h3>
              <p className="cw-muted">{taskPulse.detail}</p>
            </div>
            <span className={`cw-chip ${taskPulse.chipTone}`}>{taskPulse.chip}</span>
          </div>
          {hash ? (
            <div className="cw-button-row">
              <a
                href={getBscScanTxUrl(hash)}
                target="_blank"
                rel="noopener noreferrer"
                className="cw-button cw-button--secondary"
              >
                <ArrowUpRight size={16} />
                View transaction
              </a>
            </div>
          ) : null}
        </section>
      ) : null}

      {result ? (
        <section className="cw-result-panel">
          <div className="cw-result-head">
            <div className="cw-result-icon">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <span className="cw-label">Task complete</span>
              <h3>{result.taskTitle} settled on-chain</h3>
            </div>
          </div>

          <div className="cw-result-grid">
            <div className="cw-result-stat">
              <span className="cw-label">Actual reward</span>
              <strong>+{formatCLW(result.actualClw)}</strong>
            </div>
            <div className="cw-result-stat">
              <span className="cw-label">XP gain</span>
              <strong>+{result.xpReward}</strong>
            </div>
            <div className="cw-result-stat">
              <span className="cw-label">Match score</span>
              <strong>{Math.round(result.matchScore / 100)}%</strong>
            </div>
          </div>

          <div className="cw-list">
            <div className="cw-list-item cw-list-item--warm">
              <Sparkles size={16} />
              <span>
                Requested {formatCLW(result.requestedClw)} / settled {formatCLW(result.actualClw)} into router reserve.
              </span>
            </div>
            <div className={`cw-list-item ${result.driftState === 'applied' ? 'cw-list-item--warm' : 'cw-list-item--cool'}`}>
              <Shield size={16} />
              <span>
                {result.driftState === 'applied'
                  ? 'Personality drift was applied on this run.'
                  : result.driftState === 'skipped'
                    ? `Personality drift was skipped: ${result.driftReason ?? 'bounded by current cap.'}`
                    : 'This run did not trigger personality drift.'}
              </span>
            </div>
          </div>

          <div className="cw-button-row">
            <a
              href={getBscScanTxUrl(result.txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="cw-button cw-button--secondary"
            >
              <ArrowUpRight size={16} />
              View transaction
            </a>
            <button
              type="button"
              className="cw-button cw-button--ghost"
              onClick={() => setResult(null)}
            >
              Continue
            </button>
          </div>
        </section>
      ) : null}

      {gasUnits !== null ? (
        <p className="cw-muted">
          Estimated gas: {gasUnits.toString()} units
          {gasCostWei !== null ? ` / approx ${formatBNB(gasCostWei, 6)} BNB at current gas price.` : '.'}
        </p>
      ) : null}
      {error ? <p className="cw-muted">Task failed to submit: {getErrorMessage(error)}</p> : null}
    </>
  );
}
