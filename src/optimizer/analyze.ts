/**
 * Entry point: analyzeProfile(profile, terms, config) → DecisionResult.
 * Generate → Evaluate → Filter → Stress-test → Rank and explain.
 */
import { PROJECT_CONFIG } from '../data/config';
import { applyScenario, applyScenarioParams, PARAM_LABELS, scenarioParams, SCENARIO_IDS, type ScenarioParamKey } from '../data/scenarios';
import { developerEconomics } from '../domain/developer';
import { lotPolicy, policyBlock } from '../domain/policy';
import { mortgageCapacity } from '../domain/mortgage';
import { calculateRights } from '../domain/rights';
import { netMonthlyRentPerApartment } from '../domain/taxation';
import type {
  Candidate,
  CommercialTerms,
  DecisionResult,
  DeveloperEconomics,
  LedgerEntry,
  NegotiationTarget,
  ProjectConfig,
  ScenarioId,
  StrategyResult,
  StrategyType,
  UserProfile,
} from '../domain/types';
import { apartmentValueAt, apartmentValueToday } from '../domain/valuation';
import { evaluateCandidate, type EngineContext, type Evaluation } from './evaluate';
import { assess, assessEvaluation, classify, informationalReasons, isFeasible } from './feasibility';
import { generateStrategies } from './generate';
import { findMaterialUnknowns } from './questions';
import { rankStrategies, selectAlternatives, SIMPLICITY, unconstrainedPreference, type Scales } from './rank';
import {
  breakevenSurplusPrice,
  conservativeSurplusPrice,
  developerTargets,
  globalTargets,
  immediateSaleMinPrice,
  strategyTargets,
} from './reverse';
import { evaluateScenarios, type ScenarioEvaluations } from './scenarios';

const sum = (entries: LedgerEntry[], pred: (e: LedgerEntry) => boolean) =>
  entries.filter(pred).reduce((s, e) => s + e.amount, 0);

const COMBINATION_FAMILY: StrategyType[] = ['S02', 'S02C', 'S06', 'S11'];
const DEVELOPER_SALE: StrategyType[] = ['S01', 'S03', 'S05', 'S07', 'S08'];

function resilienceOf(base: Evaluation, adverseFeasible: boolean, adverse: Evaluation): number {
  if (!adverseFeasible || base.valueCreated <= 0) return 0;
  return Math.max(0, Math.min(1, adverse.valueCreated / base.valueCreated));
}

/** Indicative developer margin for the deal a strategy relies on (null when no developer deal). */
export function developerMarginFor(type: StrategyType, dev: DeveloperEconomics): number | null {
  if (COMBINATION_FAMILY.includes(type)) return dev.combinationMargin;
  if (DEVELOPER_SALE.includes(type)) return dev.landPurchaseMargin;
  if (type === 'S04') return dev.revenueShareMargin;
  return null;
}

export function buildScales(ctx: EngineContext, config: ProjectConfig): Scales {
  const R = ctx.info.apartmentEquivalents;
  const maxApartments = Math.max(1, Math.ceil(R - 1e-6));
  return {
    entitlementValue: R * apartmentValueToday(config),
    landValue: R * ctx.info.sqmPerRight * config.market.developerRightsSaleScenario.pricePerOriginalSqm,
    maxApartments,
    monthlyRent: maxApartments * netMonthlyRentPerApartment(config),
  };
}

export function buildResult(
  candidate: Candidate,
  evals: ScenarioEvaluations,
  ctx: EngineContext,
  config: ProjectConfig,
  dev: DeveloperEconomics,
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
  const developerMargin = developerMarginFor(candidate.type, dev);
  const blocked = policyBlock(candidate, R, ctx.terms.combinationPct, config);
  const reasonCodes = [
    ...assessments.base.fails,
    ...assessments.base.missing,
    ...(feasibility === 'fragile' ? (['ADVERSE_FAILS'] as const) : []),
    ...(blocked ? [blocked] : []),
    ...informationalReasons(candidate, base, R, ctx.terms.combinationPct),
  ];

  const ledger = plan.ledger;
  const owner = (e: LedgerEntry) => e.payer === 'owner' && e.direction === 'out';
  const grossSaleProceeds = sum(ledger, (e) => e.direction === 'in');
  const saleDeductions = sum(ledger, (e) => owner(e) && !!e.saleRelated);
  const P = ctx.profile.maxMonthlyRepayment;
  const capacity = P === null ? null : mortgageCapacity(P, config.financing.nominalAnnualInterest, config.financing.durationYears);
  const alt = config.financing.alternativeNetAnnualReturn;
  const financed = sim.drawsByStage.bridge + sim.drawsByStage.construction + sim.drawsByStage.mortgage;

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
    peakFundingGap: sim.unfunded + (capacity === null ? financed : Math.max(0, financed - capacity)),
    completedPropertyValue: plan.retainedApartmentEquivalents * apartmentValueAt(config, plan.completionMonth),
    estimatedNetMonthlyRentalCashflow: sim.monthlyNetRent - sim.postCompletionMonthly,
    netPresentValue: base.valueCreated / Math.pow(1 + alt, config.analysis.horizonYears),
    futureNetWealth: base.futureNetWealth,
    feasibility,
    assessment: assess(assessments.base, assessments.adverse, developerMargin, blocked !== null),
    developerMargin,
    reasonCodes: [...new Set(reasonCodes)],
    requiredConditions: [...assessments.base.conditions, ...assessments.base.commercial],
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

export interface CoreAnalysis {
  ctx: EngineContext;
  scales: Scales;
  dev: DeveloperEconomics;
  results: StrategyResult[];
  ranked: StrategyResult[];
  frontierIds: string[];
}

/** Generate, evaluate across scenarios, assess and rank — without reverse optimisation or sensitivity. */
export function coreAnalysis(profile: UserProfile, terms: CommercialTerms, config: ProjectConfig): CoreAnalysis {
  const info = calculateRights(profile.landAreaSqm, config, profile.lotId);
  const ctx: EngineContext = { info, profile, terms };
  const dev = developerEconomics(info, config, terms.combinationPct);
  const scales = buildScales(ctx, config);
  const results = generateStrategies(info, terms, config).map((c) => buildResult(c, evaluateScenarios(c, ctx, config), ctx, config, dev));
  const { ranked, frontierIds } = rankStrategies(results, profile.goal, scales);
  return { ctx, scales, dev, results, ranked, frontierIds };
}

/**
 * Re-ranks the existing results with the base evaluation replaced by another configuration
 * (resilience is kept from the main run). Returns the top strategy id.
 */
function topUnder(core: CoreAnalysis, config: ProjectConfig): string | null {
  const { ctx, results, scales } = core;
  const R = ctx.info.apartmentEquivalents;
  const swapped = results.map((r) => {
    const ev = evaluateCandidate(r.candidate, ctx, config);
    const a = assessEvaluation(r.candidate, ev, ctx.profile, config, R);
    const feasibility = a.fails.length ? 'infeasible' : a.missing.length ? 'unknown' : r.feasibility === 'fragile' ? 'fragile' : 'conditional';
    return {
      ...r,
      feasibility,
      mortgageRequired: ev.sim.peakDebt,
      metrics: {
        ...r.metrics,
        valueCreated: ev.valueCreated,
        liquidity: ev.liquidity,
        sustainableMonthlyIncome: ev.sustainableMonthlyIncome,
        peakDebt: ev.sim.peakDebt,
      },
    } as StrategyResult;
  });
  return rankStrategies(swapped, ctx.profile.goal, scales).ranked[0]?.id ?? null;
}

function bestBy(results: StrategyResult[], pred: (r: StrategyResult) => boolean): StrategyResult | null {
  return results.filter(pred).reduce<StrategyResult | null>((b, r) => (!b || r.metrics.valueCreated > b.metrics.valueCreated ? r : b), null);
}

const eligibleForBenchmark = (r: StrategyResult) => r.feasibility !== 'infeasible' && r.feasibility !== 'unknown';

export function analyzeProfile(
  profile: UserProfile,
  terms: CommercialTerms,
  config: ProjectConfig = PROJECT_CONFIG,
): DecisionResult {
  const core = coreAnalysis(profile, terms, config);
  const { ctx, results, ranked, frontierIds, dev, scales } = core;
  const recommendation = ranked[0] ?? null;
  const alternatives = selectAlternatives(ranked, recommendation);

  // --- Negotiation thresholds -------------------------------------------------
  const negotiationTargets: NegotiationTarget[] = [...globalTargets(ctx, config), ...developerTargets(dev, ctx, config)];
  const focus = new Map<string, boolean>();
  if (recommendation) focus.set(recommendation.id, false);
  const preferred = unconstrainedPreference(results, profile.goal, scales);
  if (preferred && preferred.id !== recommendation?.id && (preferred.feasibility === 'infeasible' || preferred.feasibility === 'unknown')) {
    focus.set(preferred.id, true);
  }
  for (const r of results) {
    if (r.feasibility === 'infeasible' && r.assessment.commercial !== 'not_offered' && r.plan.apartmentsBuilt >= 1 && focus.size < 4 && !focus.has(r.id)) {
      if (!results.some((o) => focus.has(o.id) && o.plan.wholeApartmentsRetained === r.plan.wholeApartmentsRetained)) focus.set(r.id, true);
    }
  }
  for (const [id, blocked] of focus) {
    const r = results.find((x) => x.id === id);
    if (r) negotiationTargets.push(...strategyTargets(r, ctx, config, blocked));
  }

  // Economic thresholds for every hybrid that sells surplus rights to fund a whole apartment.
  const benchmark =
    bestBy(results, (r) => COMBINATION_FAMILY.includes(r.strategyType) && eligibleForBenchmark(r)) ??
    bestBy(results, (r) => COMBINATION_FAMILY.includes(r.strategyType));
  if (benchmark) {
    const seenTargets = new Set<number>();
    for (const r of results) {
      if (!['S05', 'S03'].includes(r.strategyType) || r.rightsSold <= 1e-6 || r.assessment.commercial === 'not_offered') continue;
      if (seenTargets.has(r.plan.wholeApartmentsRetained)) continue;
      seenTargets.add(r.plan.wholeApartmentsRetained);
      negotiationTargets.push(breakevenSurplusPrice(r.candidate, benchmark.candidate, ctx, config));
      negotiationTargets.push(conservativeSurplusPrice(r.candidate, benchmark.candidate, ctx, config));
    }
  }
  const sale = results.find((r) => r.strategyType === 'S01M');
  const bestOther = bestBy(results, (r) => r.strategyType !== 'S01M' && eligibleForBenchmark(r));
  if (sale && bestOther) negotiationTargets.push(immediateSaleMinPrice(sale.candidate, bestOther.candidate, ctx, config));

  // --- Sensitivity -------------------------------------------------------------
  const mainTop = recommendation?.id ?? null;
  const byScenario = { base: mainTop } as Record<ScenarioId, string | null>;
  byScenario.favorable = topUnder(core, applyScenario(config, 'favorable'));
  byScenario.adverse = topUnder(core, applyScenario(config, 'adverse'));
  const baseParams = scenarioParams(config, 'base');
  const adverseParams = scenarioParams(config, 'adverse');
  const drivers: string[] = [];
  if (mainTop) {
    for (const key of Object.keys(baseParams) as ScenarioParamKey[]) {
      const cfg = applyScenarioParams(config, { ...baseParams, [key]: adverseParams[key] });
      if (topUnder(core, cfg) !== mainTop) drivers.push(PARAM_LABELS[key]);
    }
  }

  const topFor = (p: UserProfile) => coreAnalysis(p, terms, config).ranked[0]?.id ?? null;

  return {
    rights: ctx.info,
    results,
    ranked,
    frontierIds,
    recommendation,
    alternatives,
    negotiationTargets,
    followUpQuestions: findMaterialUnknowns(profile, ctx.info, mainTop, topFor, config),
    sensitivity: { byScenario, drivers },
    mortgageCapacity:
      profile.maxMonthlyRepayment === null
        ? null
        : mortgageCapacity(profile.maxMonthlyRepayment, config.financing.nominalAnnualInterest, config.financing.durationYears),
    developer: dev,
    lotPolicy: lotPolicy(ctx.info, config, terms.combinationPct),
  };
}
