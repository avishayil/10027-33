/**
 * Ranking: Pareto filtering first, then transparent goal-specific weights.
 * The weights are product preferences, not empirical financial rules.
 */
import type { Goal, Metrics, StrategyResult, StrategyType } from '../domain/types';

export const SIMPLICITY: Record<StrategyType, number> = {
  S09: 1,
  S01: 0.9,
  S01M: 0.9,
  S02: 0.8,
  S02C: 0.75,
  S02P: 0.65,
  S13: 0.55,
  S11: 0.4,
  S04: 0.7,
  S03: 0.5,
  S05: 0.5,
  S08: 0.45,
  S06: 0.4,
  S07: 0.35,
  S10: 0.3,
};

export const BALANCED_WEIGHTS = {
  valueCreated: 0.35,
  resilience: 0.25,
  wholeApartments: 0.15,
  liquidity: 0.1,
  simplicity: 0.05,
  /** Commercial risk: unconfirmed or questionable developer terms rank lower (ordinal, not a probability). */
  commercial: 0.1,
};

/** Higher is better for every dimension used in dominance. */
function dims(m: Metrics): number[] {
  return [m.valueCreated, m.resilience, m.wholeApartments, m.liquidity, m.simplicity, m.sustainableMonthlyIncome, -m.peakDebt, m.commercialScore];
}

function dominates(a: Metrics, b: Metrics): boolean {
  const da = dims(a);
  const db = dims(b);
  let strictly = false;
  for (let i = 0; i < da.length; i += 1) {
    if (da[i] < db[i] - 1e-6) return false;
    if (da[i] > db[i] + 1e-6) strictly = true;
  }
  return strictly;
}

export function isEligible(r: StrategyResult, goal: Goal): boolean {
  if (r.feasibility === 'infeasible' || r.feasibility === 'unknown') return false;
  // The developer is not expected to offer it (lot policy for construction services).
  if (r.assessment.commercial === 'negotiable') return false;
  // Its outcome depends on a price nobody has verified — reported as a required price, never as the verdict.
  if (r.priceDependency !== null) return false;
  if (goal === 'minimize_risk' && r.feasibility === 'fragile') return false;
  return true;
}

/**
 * S08 (keep & rent) only differs from its build-and-hold sibling in that rent counts toward repayment.
 * When the sibling is itself eligible they are economically identical, so the duplicate is dropped.
 */
export function dropRedundantRentals(results: StrategyResult[], goal: Goal): StrategyResult[] {
  const eligibleIds = new Set(results.filter((r) => isEligible(r, goal)).map((r) => r.id));
  return results.filter((r) => {
    if (r.strategyType !== 'S08') return true;
    const k = r.id.split('-')[1];
    return !(eligibleIds.has(`S05-${k}`) || eligibleIds.has(`S03-${k}`));
  });
}

export function findParetoFrontier(results: StrategyResult[]): StrategyResult[] {
  return results.filter((r) => !results.some((o) => o !== r && dominates(o.metrics, r.metrics)));
}

/**
 * Fixed reference scales so a candidate's score does not depend on which other candidates exist.
 * All are derived from the user's own rights and the base assumptions.
 */
export interface Scales {
  /** R × today's apartment value. */
  entitlementValue: number;
  /** R × land price per right (developer scenario). */
  landValue: number;
  /** Whole apartments achievable at most (ceil R, ≥ 1). */
  maxApartments: number;
  /** Net monthly rent of that many apartments. */
  monthlyRent: number;
}

const clamp = (x: number) => Math.max(-1, Math.min(2, Number.isFinite(x) ? x : 0));

export function normalisedMetrics(m: Metrics, s: Scales) {
  const pos = (v: number) => (v > 0 ? v : 1);
  return {
    W: clamp(m.valueCreated / pos(s.entitlementValue)),
    R: clamp(m.resilience),
    A: clamp(m.wholeApartments / pos(s.maxApartments)),
    L: clamp(m.liquidity / pos(s.landValue)),
    S: clamp(m.simplicity),
    I: clamp(m.sustainableMonthlyIncome / pos(s.monthlyRent)),
    D: clamp(1 - m.peakDebt / pos(s.entitlementValue)),
  };
}

export function goalScore(m: Metrics, goal: Goal, s: Scales): number {
  const n = normalisedMetrics(m, s);
  const balanced =
    BALANCED_WEIGHTS.valueCreated * n.W +
    BALANCED_WEIGHTS.resilience * n.R +
    BALANCED_WEIGHTS.wholeApartments * n.A +
    BALANCED_WEIGHTS.liquidity * n.L +
    BALANCED_WEIGHTS.simplicity * n.S +
    BALANCED_WEIGHTS.commercial * m.commercialScore;
  switch (goal) {
    case 'maximize_apartments':
      // Whole apartments dominate; balanced score breaks ties.
      return m.wholeApartments * 10 + balanced;
    case 'passive_income':
      return 0.6 * n.I + 0.4 * balanced;
    case 'immediate_cash':
      return 0.6 * n.L + 0.4 * balanced;
    case 'minimize_risk':
      return 0.35 * n.R + 0.25 * n.D + 0.15 * n.S + 0.1 * n.W + 0.15 * m.commercialScore;
    default:
      return balanced;
  }
}

export function goalScores(results: StrategyResult[], goal: Goal, s: Scales): Map<string, number> {
  return new Map(results.map((r) => [r.id, goalScore(r.metrics, goal, s)]));
}

/** Explicit preference constraints: applied when at least one eligible strategy satisfies them. */
function applyConstraints(eligible: StrategyResult[], goal: Goal): StrategyResult[] {
  const keep = (pred: (r: StrategyResult) => boolean) => {
    const f = eligible.filter(pred);
    return f.length ? f : eligible;
  };
  if (goal === 'minimize_risk') return keep((r) => r.mortgageRequired <= 1);
  if (goal === 'immediate_cash') return keep((r) => r.metrics.liquidity > 0);
  if (goal === 'passive_income') return keep((r) => r.metrics.sustainableMonthlyIncome > 0);
  return eligible;
}

/** Eligible results ordered best-first: constrained Pareto frontier by score, then the rest by score. */
export function rankStrategies(results: StrategyResult[], goal: Goal, s: Scales): { ranked: StrategyResult[]; frontierIds: string[] } {
  const eligible = dropRedundantRentals(results, goal).filter((r) => isEligible(r, goal));
  const constrained = applyConstraints(eligible, goal);
  const frontier = findParetoFrontier(constrained);
  const frontierIds = new Set(frontier.map((r) => r.id));
  const scores = goalScores(eligible, goal, s);
  const byScore = (a: StrategyResult, b: StrategyResult) =>
    (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0) || a.id.localeCompare(b.id);
  const first = constrained.filter((r) => frontierIds.has(r.id)).sort(byScore);
  const rest = eligible.filter((r) => !frontierIds.has(r.id)).sort(byScore);
  return { ranked: [...first, ...rest], frontierIds: [...frontierIds] };
}

/** Best candidate under the goal if financial constraints are ignored (to detect a blocked preference). */
export function unconstrainedPreference(results: StrategyResult[], goal: Goal, s: Scales): StrategyResult | null {
  const pool = results.filter((r) => r.strategyType !== 'S01M' && r.assessment.commercial !== 'negotiable');
  const scores = goalScores(pool, goal, s);
  let best: StrategyResult | null = null;
  for (const r of pool) if (!best || (scores.get(r.id) ?? 0) > (scores.get(best.id) ?? 0)) best = r;
  return best;
}

export function selectAlternatives(ranked: StrategyResult[], recommendation: StrategyResult | null, n = 2): StrategyResult[] {
  const out: StrategyResult[] = [];
  const seen = new Set<StrategyType>(recommendation ? [recommendation.strategyType] : []);
  for (const r of ranked) {
    if (r === recommendation || seen.has(r.strategyType)) continue;
    out.push(r);
    seen.add(r.strategyType);
    if (out.length >= n) break;
  }
  return out;
}
