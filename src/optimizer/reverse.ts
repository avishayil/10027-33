/**
 * Reverse optimisation: instead of only saying "you can't afford this", solve for the commercial
 * terms that would make a strategy fit the user's finances.
 * Unknown capital or repayment capacity is treated as zero here (and labelled so in the UI).
 */
import { constructionQuotePerApartment } from '../domain/construction';
import { mortgageCapacity } from '../domain/mortgage';
import type { Candidate, NegotiationTarget, ProjectConfig, StrategyResult } from '../domain/types';
import { apartmentValueToday } from '../domain/valuation';
import { evaluateCandidate, type EngineContext } from './evaluate';
import { assessEvaluation } from './feasibility';

const ITER = 36;

/** Financial feasibility only (cash, repayment, collateral) in the base scenario. */
export function financiallyFeasible(candidate: Candidate, ctx: EngineContext, config: ProjectConfig): boolean {
  const profile = {
    ...ctx.profile,
    availableCapital: ctx.profile.availableCapital ?? 0,
    maxMonthlyRepayment: ctx.profile.maxMonthlyRepayment ?? 0,
  };
  const ev = evaluateCandidate(candidate, { ...ctx, profile }, config);
  const a = assessEvaluation(candidate, ev, profile, config, ctx.info.apartmentEquivalents);
  return a.fails.length === 0;
}

/** Smallest x in [lo, hi] for which pred holds, assuming pred is monotone increasing in x. */
export function solveMin(lo: number, hi: number, pred: (x: number) => boolean): number | null {
  if (pred(lo)) return lo;
  if (!pred(hi)) return null;
  let a = lo;
  let b = hi;
  for (let i = 0; i < ITER; i += 1) {
    const mid = (a + b) / 2;
    if (pred(mid)) b = mid;
    else a = mid;
  }
  return b;
}

/** Largest x in [lo, hi] for which pred holds, assuming pred is monotone decreasing in x. */
export function solveMax(lo: number, hi: number, pred: (x: number) => boolean): number | null {
  if (!pred(lo)) return null;
  if (pred(hi)) return hi;
  let a = lo;
  let b = hi;
  for (let i = 0; i < ITER; i += 1) {
    const mid = (a + b) / 2;
    if (pred(mid)) a = mid;
    else b = mid;
  }
  return a;
}

const withDeveloperPrice = (config: ProjectConfig, price: number): ProjectConfig => ({
  ...config,
  market: {
    ...config.market,
    developerRightsSaleScenario: { ...config.market.developerRightsSaleScenario, pricePerOriginalSqm: price },
  },
});

export function minSurplusPrice(c: Candidate, ctx: EngineContext, config: ProjectConfig): NegotiationTarget {
  const v = solveMin(0, 40000, (p) => financiallyFeasible(c, ctx, withDeveloperPrice(config, p)));
  return { code: 'MIN_SURPLUS_PRICE', strategyId: c.id, value: v, unit: 'ils_per_sqm', current: config.market.developerRightsSaleScenario.pricePerOriginalSqm };
}

export function latestSurplusPayment(c: Candidate, ctx: EngineContext, config: ProjectConfig): NegotiationTarget {
  const completion = Math.round(config.construction.durationYears * 12);
  let latest: number | null = null;
  for (let m = 0; m <= completion; m += 1) {
    const cfg = { ...config, commercial: { ...config.commercial, developerPaymentYear: m / 12 } };
    if (financiallyFeasible(c, ctx, cfg)) latest = m;
    else if (latest !== null) break;
  }
  return { code: 'LATEST_SURPLUS_PAYMENT', strategyId: c.id, value: latest, unit: 'months', current: Math.round(config.commercial.developerPaymentYear * 12) };
}

export function maxConstructionCost(c: Candidate, ctx: EngineContext, config: ProjectConfig): NegotiationTarget {
  const withCost = (cost: number): ProjectConfig => ({ ...config, construction: { ...config.construction, costPerSqm: cost } });
  const found = solveMax(0, 40000, (x) => financiallyFeasible(c, ctx, withCost(x)));
  // A build that only works if construction is practically free is not a negotiable target.
  const perSqm = found !== null && found >= 500 ? found : null;
  const value = perSqm === null ? null : constructionQuotePerApartment(withCost(perSqm), ctx.terms.developerMarkup);
  return { code: 'MAX_CONSTRUCTION_COST', strategyId: c.id, value, unit: 'ils', current: constructionQuotePerApartment(config, ctx.terms.developerMarkup) };
}

export function maxDeveloperMarkup(c: Candidate, ctx: EngineContext, config: ProjectConfig): NegotiationTarget {
  const v = solveMax(0, 1, (m) => financiallyFeasible(c, { ...ctx, terms: { ...ctx.terms, developerMarkup: m } }, config));
  return { code: 'MAX_DEVELOPER_MARKUP', strategyId: c.id, value: v, unit: 'pct', current: ctx.terms.developerMarkup };
}

export function maxCompletionPayment(c: Candidate, ctx: EngineContext, config: ProjectConfig): NegotiationTarget {
  const leg = c.legs.find((l) => l.kind === 'completion');
  const eq = leg && leg.kind === 'completion' ? leg.apartmentEquivalents : 0;
  const unit = eq * apartmentValueToday(config);
  const f = solveMax(0, 3, (x) => financiallyFeasible(c, ctx, { ...config, commercial: { ...config.commercial, completionPriceFactor: x } }));
  return { code: 'MAX_COMPLETION_PAYMENT', strategyId: c.id, value: f === null ? null : f * unit, unit: 'ils', current: unit * config.commercial.completionPriceFactor };
}

export function requiredAdditionalCapital(c: Candidate, ctx: EngineContext, config: ProjectConfig): NegotiationTarget {
  const base = ctx.profile.availableCapital ?? 0;
  const v = solveMin(0, 30_000_000, (x) =>
    financiallyFeasible(c, { ...ctx, profile: { ...ctx.profile, availableCapital: base + x } }, config),
  );
  return { code: 'REQUIRED_ADDITIONAL_CAPITAL', strategyId: c.id, value: v, unit: 'ils' };
}

/** Targets that apply to the user regardless of strategy. */
export function globalTargets(ctx: EngineContext, config: ProjectConfig): NegotiationTarget[] {
  const R = ctx.info.apartmentEquivalents;
  const out: NegotiationTarget[] = [];
  if (R > 0) {
    const current = ctx.terms.combinationPct;
    const nextWhole = Math.max(1, Math.floor(R * current + 1e-9) + 1);
    out.push({
      code: 'MIN_COMBINATION_PCT',
      value: nextWhole / R,
      unit: 'pct',
      current,
      note: `${nextWhole}`,
    });
  }
  const P = ctx.profile.maxMonthlyRepayment;
  if (P !== null && P > 0) {
    out.push({
      code: 'MAX_SUSTAINABLE_MORTGAGE',
      value: mortgageCapacity(P, config.financing.nominalAnnualInterest, config.financing.durationYears),
      unit: 'ils',
    });
  }
  return out;
}

/** Negotiation thresholds for one strategy, chosen by which legs it contains. */
export function strategyTargets(r: StrategyResult, ctx: EngineContext, config: ProjectConfig, includeCapital: boolean): NegotiationTarget[] {
  const c = r.candidate;
  const out: NegotiationTarget[] = [];
  const sellsSurplus = c.legs.some((l) => l.kind === 'sell_rights' && l.market === 'developer' && l.rights < ctx.info.apartmentEquivalents - 1e-6);
  const builds = c.legs.some((l) => l.kind === 'build');
  if (sellsSurplus) {
    out.push(minSurplusPrice(c, ctx, config));
    out.push(latestSurplusPayment(c, ctx, config));
  }
  if (builds) {
    out.push(maxConstructionCost(c, ctx, config));
    out.push(maxDeveloperMarkup(c, ctx, config));
  }
  if (c.legs.some((l) => l.kind === 'completion')) out.push(maxCompletionPayment(c, ctx, config));
  if (includeCapital) out.push(requiredAdditionalCapital(c, ctx, config));
  return out;
}
