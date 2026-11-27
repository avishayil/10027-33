/**
 * Iteration 9 / phase F — stage-contingent contracts (first version), without probabilities.
 *
 * Three states the household cannot know at signing: the plan is not approved; it is approved and financing comes
 * through; it is approved but no financing is available (no mortgage, no loan on another property, no tax loan). For
 * each fixed route the value in each state is computed on the same model; a route that cannot be carried out in a
 * state falls back to the full combination (the default a developer keeps). A contract "with an option" — sign the
 * combination now, switch to route X after approval only if financing is confirmed — takes X's value in the financed
 * state and the combination's otherwise. Regret in a state = the best value available in that state − this choice's.
 * The option itself needs the developer's agreement and may cost something; that price is not invented here.
 */
import { calculateRights } from '../domain/rights';
import type { CommercialTerms, DecisionResult, ProjectConfig, StrategyResult, UserProfile } from '../domain/types';
import { evaluateCandidate, type EngineContext } from './evaluate';
import { assessEvaluation } from './feasibility';

export type ContractState = 'no_approval' | 'financed' | 'no_financing';

export interface ContingentRow {
  label: string;
  routeId: string;
  /** The option row's route after approval, if financed (null for fixed rows). */
  optionRouteId: string | null;
  /** Exposure if the plan is not approved (unprotected — the maximum modelled). */
  noApprovalExposure: number;
  /** Value in each approved state; null = not executable even with the combination fallback. */
  financed: number | null;
  noFinancing: number | null;
  /** Fell back to the combination in this state (route not executable). */
  fellBackFinanced: boolean;
  fellBackNoFinancing: boolean;
  regretFinanced: number | null;
  regretNoFinancing: number | null;
  /** Largest regret over the two approved states (Infinity when this choice fails where another works). */
  maxRegret: number;
}

export interface ContingentResult {
  fallbackId: string | null;
  rows: ContingentRow[];
}

/** A route's value under a profile/config, or null when it cannot be carried out there. */
function valueOf(r: StrategyResult, ctx: EngineContext, config: ProjectConfig): number | null {
  const ev = evaluateCandidate(r.candidate, ctx, config);
  return assessEvaluation(r.candidate, ev, ctx.profile, config, ctx.info.apartmentEquivalents).fails.length ? null : ev.comparisonValue;
}

export function contingentPlan(result: DecisionResult, profile: UserProfile, terms: CommercialTerms, config: ProjectConfig): ContingentResult {
  const info = calculateRights(profile.landAreaSqm, config, profile.lotId);
  const ctx: EngineContext = { info, profile, terms };
  const noFinancing: UserProfile = { ...profile, maxMonthlyRepayment: 0, otherPropertyBorrowingLimit: 0 };
  const noLoanConfig: ProjectConfig = { ...config, financing: { ...config.financing, taxLoan: { ...config.financing.taxLoan, available: false } } };

  // The default the developer keeps: the full combination (with a pool when the fraction is pooled, else plain).
  const fallback = result.results.find((r) => r.id === 'S02P') ?? result.results.find((r) => r.id === 'S02') ?? null;
  // Renting out (S14) is a use of the same apartments, not another contract: left out to keep the comparison short.
  const shown = [result.recommendation, ...result.alternatives, result.conditionalRecommendation?.result ?? null].filter(
    (r): r is StrategyResult => !!r && r.strategyType !== 'S14',
  );
  const routes = [...new Map([...(fallback ? [fallback] : []), ...shown].map((r) => [r.id, r])).values()];
  if (!fallback || !routes.length) return { fallbackId: fallback?.id ?? null, rows: [] };

  const values = new Map(
    routes.map((r) => [r.id, { financed: valueOf(r, ctx, config), noFinancing: valueOf(r, { ...ctx, profile: noFinancing }, noLoanConfig) }]),
  );
  const fb = values.get(fallback.id)!;

  // A route that cannot be carried out in a state falls back to the combination; if that cannot either, null.
  const rows: ContingentRow[] = routes.map((r) => {
    const v = values.get(r.id)!;
    return {
      label: r.id,
      routeId: r.id,
      optionRouteId: null,
      noApprovalExposure: r.noApproval.unprotected,
      financed: v.financed ?? fb.financed,
      noFinancing: v.noFinancing ?? fb.noFinancing,
      fellBackFinanced: v.financed === null,
      fellBackNoFinancing: v.noFinancing === null,
      regretFinanced: null,
      regretNoFinancing: null,
      maxRegret: Infinity,
    };
  });
  // Option contracts: combination now, switch to X after approval if financed.
  for (const r of routes) {
    if (r.id === fallback.id) continue;
    const v = values.get(r.id)!;
    if (v.financed === null) continue;
    rows.push({
      label: `${fallback.id}→${r.id}`,
      routeId: fallback.id,
      optionRouteId: r.id,
      noApprovalExposure: fallback.noApproval.unprotected,
      financed: v.financed,
      noFinancing: fb.noFinancing,
      fellBackFinanced: false,
      fellBackNoFinancing: false,
      regretFinanced: null,
      regretNoFinancing: null,
      maxRegret: Infinity,
    });
  }
  const best = (xs: (number | null)[]) => {
    const ok = xs.filter((x): x is number => x !== null);
    return ok.length ? Math.max(...ok) : null;
  };
  const bestF = best(rows.map((x) => x.financed));
  const bestN = best(rows.map((x) => x.noFinancing));
  for (const x of rows) {
    x.regretFinanced = x.financed === null || bestF === null ? null : bestF - x.financed;
    x.regretNoFinancing = x.noFinancing === null || bestN === null ? null : bestN - x.noFinancing;
    // A state where nothing can be carried out costs every choice the same; a choice that fails where another works is worst.
    const r1 = bestF === null ? 0 : x.regretFinanced ?? Infinity;
    const r2 = bestN === null ? 0 : x.regretNoFinancing ?? Infinity;
    x.maxRegret = Math.max(r1, r2);
  }
  rows.sort((a, b) => a.maxRegret - b.maxRegret);
  return { fallbackId: fallback.id, rows };
}
