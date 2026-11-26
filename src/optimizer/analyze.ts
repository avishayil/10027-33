/**
 * Entry point: analyzeProfile(profile, terms, config) → DecisionResult.
 * Generate → Evaluate → Filter → Stress-test → Rank and explain.
 */
import { PROJECT_CONFIG } from '../data/config';
import { applyScenarioParams, PARAM_LABELS, scenarioParams, SCENARIO_IDS, type ScenarioParamKey } from '../data/scenarios';
import { applyScenario } from '../data/scenarios';
import { mortgageCapacity } from '../domain/mortgage';
import { calculateRights } from '../domain/rights';
import type {
  Candidate,
  CommercialTerms,
  DecisionResult,
  LedgerEntry,
  NegotiationTarget,
  ProjectConfig,
  ScenarioId,
  StrategyResult,
  UserProfile,
} from '../domain/types';
import { apartmentValueAt } from '../domain/valuation';
import { evaluateCandidate, type EngineContext, type Evaluation } from './evaluate';
import { assessEvaluation, classify, informationalReasons, isFeasible } from './feasibility';
import { generateStrategies } from './generate';
import { findMaterialUnknowns } from './questions';
import { rankStrategies, selectAlternatives, SIMPLICITY, unconstrainedPreference } from './rank';
import { globalTargets, strategyTargets } from './reverse';
import { evaluateScenarios, type ScenarioEvaluations } from './scenarios';

const sum = (entries: LedgerEntry[], pred: (e: LedgerEntry) => boolean) =>
  entries.filter(pred).reduce((s, e) => s + e.amount, 0);

function resilienceOf(base: Evaluation, adverseFeasible: boolean, adverse: Evaluation): number {
  if (!adverseFeasible || base.valueCreated <= 0) return 0;
  return Math.max(0, Math.min(1, adverse.valueCreated / base.valueCreated));
}

export function buildResult(
  candidate: Candidate,
  evals: ScenarioEvaluations,
  ctx: EngineContext,
  config: ProjectConfig,
): StrategyResult {
  const R = ctx.info.apartmentEquivalents;
  const base = evals.base;
  const { plan, sim } = base;
  const assessments = {
    favorable: assessEvaluation(candidate, evals.favorable, ctx.profile, applyScenario(config, 'favorable'), R),
    base: assessEvaluation(candidate, base, ctx.profile, config, R),
    adverse: assessEvaluation(candidate, evals.adverse, ctx.profile, applyScenario(config, 'adverse'), R),
  };
  const feasibility = classify(assessments.base, assessments.adverse);
  const reasonCodes = [
    ...assessments.base.fails,
    ...assessments.base.missing,
    ...(feasibility === 'fragile' ? (['ADVERSE_FAILS'] as const) : []),
    ...informationalReasons(candidate, base, R, ctx.terms.combinationPct),
  ];

  const ledger = plan.ledger;
  const owner = (e: LedgerEntry) => e.payer === 'owner' && e.direction === 'out';
  const grossSaleProceeds = sum(ledger, (e) => e.direction === 'in');
  const saleDeductions = sum(ledger, (e) => owner(e) && !!e.saleRelated);
  const P = ctx.profile.maxMonthlyRepayment;
  const capacity = P === null ? null : mortgageCapacity(P, config.financing.nominalAnnualInterest, config.financing.durationYears);
  const alt = config.financing.alternativeNetAnnualReturn;

  const metrics = {
    valueCreated: base.valueCreated,
    resilience: resilienceOf(base, isFeasible(assessments.adverse), evals.adverse),
    wholeApartments: plan.wholeApartmentsRetained,
    liquidity: base.liquidity,
    simplicity: SIMPLICITY[candidate.type],
    sustainableMonthlyIncome: base.sustainableMonthlyIncome,
    peakDebt: sim.peakDebt,
  };

  return {
    id: candidate.id,
    strategyType: candidate.type,
    candidate,
    originalRights: R,
    rightsSold: plan.rightsSold + plan.rightsInCombination * (1 - ctx.terms.combinationPct) + plan.rightsInRevenueShare,
    rightsPurchased: plan.rightsPurchased,
    residualRights: plan.rightsHeld,
    completedApartmentTarget: plan.wholeApartmentsRetained,
    grossSaleProceeds,
    netSaleProceeds: grossSaleProceeds - saleDeductions,
    constructionCost: plan.constructionCost,
    bettermentLevy: sum(ledger, (e) => owner(e) && e.category === 'betterment_levy'),
    capitalGainsTaxReserve: sum(ledger, (e) => owner(e) && e.category === 'capital_gains_tax'),
    capitalGainsRange: plan.capitalGainsRange,
    purchaseTax: sum(ledger, (e) => owner(e) && e.category === 'purchase_tax'),
    additionalCosts: sum(ledger, (e) => owner(e) && ['transaction_costs', 'completion_payment', 'rights_purchase'].includes(e.category)),
    personalCapitalRequired: sim.personalCapitalUsed,
    mortgageRequired: sim.peakDebt,
    monthlyRepayment: sim.peakPersonalMonthly,
    peakFundingGap: capacity === null ? sim.peakDebt : Math.max(0, sim.peakDebt - capacity),
    completedPropertyValue: plan.retainedApartmentEquivalents * apartmentValueAt(config, plan.completionMonth),
    estimatedNetMonthlyRentalCashflow: sim.monthlyNetRent - sim.postCompletionMonthly,
    netPresentValue: base.valueCreated / Math.pow(1 + alt, config.analysis.horizonYears),
    futureNetWealth: base.futureNetWealth,
    feasibility,
    reasonCodes: [...new Set(reasonCodes)],
    requiredConditions: assessments.base.conditions,
    scenarioResults: SCENARIO_IDS.map((id) => ({
      scenarioId: id,
      futureNetWealth: evals[id].futureNetWealth,
      valueCreated: evals[id].valueCreated,
      mortgageRequired: evals[id].sim.peakDebt,
      monthlyRepayment: evals[id].sim.peakPersonalMonthly,
      feasible: isFeasible(assessments[id]),
      fails: assessments[id].fails,
    })),
    metrics,
    ledger,
    plan,
    simulation: sim,
  };
}

/**
 * Re-ranks the existing results with the base evaluation replaced by another configuration
 * (resilience is kept from the main run). Returns the top strategy id.
 */
function topUnder(results: StrategyResult[], ctx: EngineContext, config: ProjectConfig): string | null {
  const R = ctx.info.apartmentEquivalents;
  const swapped = results.map((r) => {
    const ev = evaluateCandidate(r.candidate, ctx, config);
    const a = assessEvaluation(r.candidate, ev, ctx.profile, config, R);
    const feasibility = a.fails.length ? 'infeasible' : a.missing.length ? 'unknown' : r.feasibility === 'fragile' ? 'fragile' : 'conditional';
    return {
      ...r,
      feasibility,
      metrics: {
        ...r.metrics,
        valueCreated: ev.valueCreated,
        liquidity: ev.liquidity,
        sustainableMonthlyIncome: ev.sustainableMonthlyIncome,
        peakDebt: ev.sim.peakDebt,
      },
    } as StrategyResult;
  });
  return rankStrategies(swapped, ctx.profile.goal).ranked[0]?.id ?? null;
}

export function analyzeProfile(
  profile: UserProfile,
  terms: CommercialTerms,
  config: ProjectConfig = PROJECT_CONFIG,
): DecisionResult {
  const info = calculateRights(profile.landAreaSqm, config, profile.lotId);
  const ctx: EngineContext = { info, profile, terms };
  const candidates = generateStrategies(info, terms, config);
  const results = candidates.map((c) => buildResult(c, evaluateScenarios(c, ctx, config), ctx, config));

  const { ranked, frontierIds } = rankStrategies(results, profile.goal);
  const recommendation = ranked[0] ?? null;
  const alternatives = selectAlternatives(ranked, recommendation);

  // Negotiation thresholds: for the recommendation and for a goal-preferred strategy that is blocked.
  const negotiationTargets: NegotiationTarget[] = [...globalTargets(ctx, config)];
  const focus = new Map<string, boolean>();
  if (recommendation) focus.set(recommendation.id, false);
  const preferred = unconstrainedPreference(results, profile.goal);
  if (preferred && preferred.id !== recommendation?.id && (preferred.feasibility === 'infeasible' || preferred.feasibility === 'unknown')) {
    focus.set(preferred.id, true);
  }
  for (const r of results) {
    if (r.feasibility === 'infeasible' && r.plan.apartmentsBuilt > 0 && focus.size < 4 && !focus.has(r.id)) {
      // Every blocked whole-apartment strategy explains what would make it feasible.
      if (!results.some((o) => focus.has(o.id) && o.plan.apartmentsBuilt === r.plan.apartmentsBuilt)) focus.set(r.id, true);
    }
  }
  for (const [id, blocked] of focus) {
    const r = results.find((x) => x.id === id);
    if (r) negotiationTargets.push(...strategyTargets(r, ctx, config, blocked));
  }

  // Sensitivity: which assumptions, on their own, change the recommendation.
  const mainTop = recommendation?.id ?? null;
  const byScenario = { base: mainTop } as Record<ScenarioId, string | null>;
  byScenario.favorable = topUnder(results, ctx, applyScenario(config, 'favorable'));
  byScenario.adverse = topUnder(results, ctx, applyScenario(config, 'adverse'));
  const baseParams = scenarioParams(config, 'base');
  const adverseParams = scenarioParams(config, 'adverse');
  const drivers: string[] = [];
  if (mainTop) {
    for (const key of Object.keys(baseParams) as ScenarioParamKey[]) {
      const cfg = applyScenarioParams(config, { ...baseParams, [key]: adverseParams[key] });
      if (topUnder(results, ctx, cfg) !== mainTop) drivers.push(PARAM_LABELS[key]);
    }
  }

  return {
    rights: info,
    results,
    ranked,
    frontierIds,
    recommendation,
    alternatives,
    negotiationTargets,
    followUpQuestions: findMaterialUnknowns(results, profile),
    sensitivity: { byScenario, drivers },
    mortgageCapacity:
      profile.maxMonthlyRepayment === null
        ? null
        : mortgageCapacity(profile.maxMonthlyRepayment, config.financing.nominalAnnualInterest, config.financing.durationYears),
  };
}
