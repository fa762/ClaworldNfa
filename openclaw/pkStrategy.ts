import type { LobsterState } from "./types";

export const PK_STRATEGY_LABELS = ["All-in attack", "Balanced", "Full defense"] as const;

interface CombatUnit {
  str: number;
  def: number;
  spd: number;
  vit: number;
  atkMul: number;
  defMul: number;
}

export interface PkStrategyProjection {
  strategy: number;
  label: string;
  averageMargin: number;
  worstMargin: number;
  bestMargin: number;
  projectedWins: number;
  projectedLosses: number;
  projectedDraws: number;
  score: number;
}

export interface PkCandidateEvaluation {
  projections: PkStrategyProjection[];
  recommendedStrategy: number;
  recommendedLabel: string;
  recommendedProjection: PkStrategyProjection;
  candidateScore: number;
  favorable: boolean;
}

export function evaluatePkCandidate(selfState: LobsterState, opponentState: LobsterState): PkCandidateEvaluation {
  const projections = [0, 1, 2].map((strategy) => projectPkStrategy(selfState, opponentState, strategy));
  const recommendedProjection = projections.reduce((best, current) => {
    if (current.score > best.score) return current;
    if (current.score === best.score && current.worstMargin > best.worstMargin) return current;
    return best;
  });
  const favorable =
    recommendedProjection.worstMargin >= 0 ||
    (recommendedProjection.projectedWins >= 2 && recommendedProjection.averageMargin >= 0);

  return {
    projections,
    recommendedStrategy: recommendedProjection.strategy,
    recommendedLabel: recommendedProjection.label,
    recommendedProjection,
    candidateScore: recommendedProjection.score,
    favorable,
  };
}

export function summarizePkProjection(projection: PkStrategyProjection): string {
  return `${projection.label}: win ${projection.projectedWins}/3, avg ${formatSigned(projection.averageMargin)}, worst ${formatSigned(projection.worstMargin)}`;
}

function projectPkStrategy(
  selfState: LobsterState,
  opponentState: LobsterState,
  selfStrategy: number
): PkStrategyProjection {
  const margins = [0, 1, 2].map((opponentStrategy) => {
    const { damageA, damageB } = simulatePkCombat(selfState, selfStrategy, opponentState, opponentStrategy);
    return damageA - damageB;
  });

  const projectedWins = margins.filter((margin) => margin > 0).length;
  const projectedDraws = margins.filter((margin) => margin === 0).length;
  const projectedLosses = margins.length - projectedWins - projectedDraws;
  const total = margins.reduce((sum, margin) => sum + margin, 0);
  const averageMargin = Math.round(total / margins.length);
  const worstMargin = Math.min(...margins);
  const bestMargin = Math.max(...margins);
  const score = projectedWins * 3000 + projectedDraws * 1000 + averageMargin + Math.floor(worstMargin / 2);

  return {
    strategy: selfStrategy,
    label: PK_STRATEGY_LABELS[selfStrategy] ?? `Strategy ${selfStrategy}`,
    averageMargin,
    worstMargin,
    bestMargin,
    projectedWins,
    projectedLosses,
    projectedDraws,
    score,
  };
}

function simulatePkCombat(
  selfState: LobsterState,
  selfStrategy: number,
  opponentState: LobsterState,
  opponentStrategy: number
): { damageA: number; damageB: number } {
  const self = buildUnit(selfState, selfStrategy);
  const opponent = buildUnit(opponentState, opponentStrategy);

  const effStrA = Math.floor((self.str * self.atkMul) / 10000);
  const effDefA = Math.floor((self.def * self.defMul) / 10000);
  const effStrB = Math.floor((opponent.str * opponent.atkMul) / 10000);
  const effDefB = Math.floor((opponent.def * opponent.defMul) / 10000);

  let rawDmgA = effStrA > effDefB ? effStrA - effDefB : 1;
  let rawDmgB = effStrB > effDefA ? effStrB - effDefA : 1;

  if (self.spd > opponent.spd) rawDmgA = Math.floor((rawDmgA * 11000) / 10000);
  if (opponent.spd > self.spd) rawDmgB = Math.floor((rawDmgB * 11000) / 10000);

  const hpA = Math.max(1, self.vit * 10);
  const hpB = Math.max(1, opponent.vit * 10);

  return {
    damageA: Math.floor((rawDmgA * 10000) / hpB),
    damageB: Math.floor((rawDmgB * 10000) / hpA),
  };
}

function buildUnit(state: LobsterState, strategy: number): CombatUnit {
  const [baseAtkMul, baseDefMul] = getStrategyMultipliers(strategy);
  let atkMul = baseAtkMul;
  let defMul = baseDefMul;

  if (strategy === 0 && state.courage >= 70) atkMul += 500;
  if (strategy === 2 && state.grit >= 70) defMul += 500;
  if (strategy === 1 && state.wisdom >= 70) {
    atkMul += 300;
    defMul += 300;
  }

  return {
    str: state.str,
    def: state.def,
    spd: state.spd,
    vit: state.vit,
    atkMul,
    defMul,
  };
}

function getStrategyMultipliers(strategy: number): [number, number] {
  if (strategy === 0) return [15000, 5000];
  if (strategy === 1) return [10000, 10000];
  return [5000, 15000];
}

function formatSigned(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}
