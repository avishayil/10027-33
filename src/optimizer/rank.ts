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
  S04: 0.7,
  S03: 0.5,
  S05: 0.5,
  S08: 0.45,
  S06: 0.4,
  S07: 0.35,
  S10: 0.3,
};

export const BALANCED_WEIGHTS = {
  valueCreated: 0.4,
  resilience: 0.3,
  wholeApartments: 0.15,
  liquidity: 0.1,
  simplicity: 0.05,
};

/** Higher is better for every dimension used in dominance. */
function dims(m: Metrics): number[] {
  return [m.valueCreated, m.resilience, m.wholeApartments, m.liquidity, m.simplicity, m.sustainableMonthlyIncome, -m.peakDebt];
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

function normaliser(values: number[]): (v: number) => number {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return (v) => (max - min < 1e-9 ? 1 : (v - min) / (max - min));
}

export function goalScores(results: StrategyResult[], goal: Goal): Map<string, number> {
  const scores = new Map<string, number>();
  if (results.length === 0) return scores;
  const pick = (f: (m: Metrics) => number) => normaliser(results.map((r) => f(r.metrics)));
  const nW = pick((m) => m.valueCreated);
  const nR = pick((m) => m.resilience);
  const nA = pick((m) => m.wholeApartments);
  const nL = pick((m) => m.liquidity);
  const nS = pick((m) => m.simplicity);
  const nI = pick((m) => m.sustainableMonthlyIncome);
  const nD = pick((m) => -m.peakDebt);

  for (const r of results) {
    const m = r.metrics;
    const balanced =
      BALANCED_WEIGHTS.valueCreated * nW(m.valueCreated) +
      BALANCED_WEIGHTS.resilience * nR(m.resilience) +
      BALANCED_WEIGHTS.wholeApartments * nA(m.wholeApartments) +
      BALANCED_WEIGHTS.liquidity * nL(m.liquidity) +
      BALANCED_WEIGHTS.simplicity * nS(m.simplicity);
    let score = balanced;
    switch (goal) {
      case 'maximize_apartments':
        // Whole apartments dominate; balanced score breaks ties.
        score = m.wholeApartments * 10 + balanced;
        break;
      case 'passive_income':
        score = 0.6 * nI(m.sustainableMonthlyIncome) + 0.4 * balanced;
        break;
      case 'immediate_cash':
        score = 0.6 * nL(m.liquidity) + 0.4 * balanced;
        break;
      case 'minimize_risk':
        score = 0.4 * nR(m.resilience) + 0.3 * nD(-m.peakDebt) + 0.2 * nS(m.simplicity) + 0.1 * nW(m.valueCreated);
        break;
      default:
        break;
    }
    scores.set(r.id, score);
  }
  return scores;
}

/** Eligible results ordered best-first: Pareto frontier by score, then dominated ones by score. */
export function rankStrategies(results: StrategyResult[], goal: Goal): { ranked: StrategyResult[]; frontierIds: string[] } {
  const eligible = dropRedundantRentals(results, goal).filter((r) => isEligible(r, goal));
  const frontier = findParetoFrontier(eligible);
  const frontierIds = new Set(frontier.map((r) => r.id));
  const scores = goalScores(eligible, goal);
  const byScore = (a: StrategyResult, b: StrategyResult) =>
    (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0) || a.id.localeCompare(b.id);
  const ranked = [
    ...eligible.filter((r) => frontierIds.has(r.id)).sort(byScore),
    ...eligible.filter((r) => !frontierIds.has(r.id)).sort(byScore),
  ];
  return { ranked, frontierIds: [...frontierIds] };
}

/** Best candidate under the goal if financial constraints are ignored (to detect a blocked preference). */
export function unconstrainedPreference(results: StrategyResult[], goal: Goal): StrategyResult | null {
  const pool = results.filter((r) => r.strategyType !== 'S01M');
  const scores = goalScores(pool, goal);
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
