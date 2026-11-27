/**
 * Entry point: analyzeProfile(profile, terms, config) → DecisionResult.
 * Generate → Evaluate → Filter → Stress-test → Rank and explain.
 */
import { PROJECT_CONFIG } from '../data/config';
import { applyScenario, applyScenarioParams, PARAM_LABELS, scenarioParams, SCENARIO_IDS, type ScenarioParamKey } from '../data/scenarios';
import { TAX_ARRANGEMENTS, withArrangement } from '../domain/arrangements';
import { candidatePnL, developerEconomics } from '../domain/developer';
import {
  developerBreakEvens,
  developerBudget,
  lotDeveloperPnL,
  lotViablePct,
  profitabilityMatrix,
  projectDeveloperPnL,
  routeDelta,
} from '../domain/lotDeveloper';
import { lotPolicy, policyBlock } from '../domain/policy';
import { mortgageCapacity } from '../domain/mortgage';
import { calculateRights } from '../domain/rights';
import { approvalMonthOf } from '../domain/transactions';
import { levyPerRight, netMonthlyRentPerApartment, taxLoanRate } from '../domain/taxation';
import type {
  Candidate,
  ArrangementOutcome,
  CommercialCertainty,
  CommercialTerms,
  DecisionResult,
  DeveloperEconomics,
  LedgerEntry,
  PriceKnob,
  TaxArrangement,
  NegotiationTarget,
  ProjectConfig,
  ScenarioId,
  StrategyResult,
  StrategyType,
  UserProfile,
  FundingAlternative,
  DeveloperThresholds,
} from '../domain/types';
import { apartmentValueAt, apartmentValueToday } from '../domain/valuation';
import { LAND_TRANSACTIONS } from '../data/evidence';
import { developerEquivalentPct, ownerBreakEvenPct } from './arrangementEquivalence';
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
  requiredAdditionalCapital,
  requiredPrice,
  solveMax,
  strategyTargets,
} from './reverse';
import { evaluateScenarios, type ScenarioEvaluations } from './scenarios';

const sum = (entries: LedgerEntry[], pred: (e: LedgerEntry) => boolean) =>
  entries.filter(pred).reduce((s, e) => s + e.amount, 0);

const COMBINATION_FAMILY: StrategyType[] = ['S02', 'S02C', 'S02P', 'S06', 'S11'];

/** Commercial risk as a ranking dimension: no fake probabilities, just an ordinal score. */
export const COMMERCIAL_SCORE: Record<CommercialCertainty, number> = {
  not_required: 1,
  unverified: 0.6,
  questionable: 0.2,
  negotiable: 0,
};

function resilienceOf(base: Evaluation, adverseFeasible: boolean, adverse: Evaluation): number {
  if (!adverseFeasible || base.comparisonValue <= 0) return 0;
  return Math.max(0, Math.min(1, adverse.comparisonValue / base.comparisonValue));
}

/**
 * Which unverified price or term a candidate's outcome hinges on. Such candidates never decide the main verdict
 * (no current market valuation, developer offer, post-approval price, revenue-share % or buy-back price is known);
 * instead the engine reports the price they would need.
 */
export function priceDependencyOf(candidate: Candidate, plan: { fractionSettled: { mode: string } | null }): PriceKnob | null {
  for (const leg of candidate.legs) {
    if (leg.kind === 'sell_rights' && leg.market === 'developer') return 'developer_price';
    if (leg.kind === 'sell_rights' && leg.market === 'post_approval') return 'post_approval_price';
    if (leg.kind === 'sell_rights' && leg.market === 'open_market') return 'immediate_price';
    if (leg.kind === 'buy_rights') return 'complementary_price';
    if (leg.kind === 'revenue_share') return 'revenue_share';
  }
  if (plan.fractionSettled?.mode === 'cash') return 'buyback_factor';
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
  /** Compute the lot-level developer P&L with this owner on the route (iteration 7). */
  withLot = true,
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
  const developerPnL = candidatePnL(candidate, plan, ctx.info, config, ctx.terms);
  // Commercial plausibility from the lot-level P&L (a combination is a lot-wide deal): the lot of typical owners with
  // this owner's share replaced by this route, financing recomputed on the combined monthly flows. Developer-borne
  // tax-loan interest for this owner is part of the route.
  let developerMargin = developerPnL ? developerPnL.marginOnRevenue : null;
  let developerLot: StrategyResult['developerLot'] = null;
  if (developerPnL && withLot) {
    const lotCtx = { info: ctx.info, profile: ctx.profile, config };
    const delta = routeDelta(lotCtx, plan, ctx.terms, sim.taxLoanSubsidy);
    const lot = lotDeveloperPnL(lotCtx, config.commercial.taxArrangement, ctx.terms.combinationPct, {
      markup: ctx.terms.developerMarkup,
      delta,
      userServicesUnits: plan.apartmentsBuilt,
    });
    developerMargin = lot.margin;
    developerLot = {
      units: lot.units,
      servicesUnits: lot.servicesUnits,
      revenue: lot.revenue,
      costs: lot.costs,
      financingCost: lot.financingCost,
      profit: lot.profit,
      margin: lot.margin,
      profitOnCost: lot.profitOnCost,
      userPhysicalUnits: lot.userPhysicalUnits,
      consideration: delta.consideration,
    };
  }
  const blocked = policyBlock(candidate, R, config);
  const reasonCodes = [
    ...assessments.base.fails,
    ...assessments.base.missing,
    ...(feasibility === 'fragile' ? (['ADVERSE_FAILS'] as const) : []),
    ...(blocked ? [blocked] : []),
    ...informationalReasons(candidate, base, R, ctx.terms.combinationPct),
  ];

  const ledger = plan.ledger;
  const owner = (e: LedgerEntry) => e.payer === 'owner' && e.direction === 'out';
  // Proceeds from disposing of rights or apartments only — not released contingency reserves.
  const PROCEEDS = ['sale_proceeds', 'revenue_share', 'apartment_sale', 'fraction_settlement'];
  const grossSaleProceeds = sum(ledger, (e) => e.direction === 'in' && PROCEEDS.includes(e.category));
  const saleDeductions = sum(ledger, (e) => owner(e) && !!e.saleRelated);
  const P = ctx.profile.maxMonthlyRepayment;
  const capacity = P === null ? null : mortgageCapacity(P, config.financing.nominalAnnualInterest, config.financing.durationYears);
  const ownerOut = (e: LedgerEntry) => owner(e) && !e.deferred && e.category !== 'contingency_reserve';
  // Position at delivery (today's prices) — the basis of the ranking value (deliveryOf, evaluate.ts).
  const delivery = base.delivery;
  const levyEntries = ledger.filter((e) => e.category === 'betterment_levy' && e.payer !== 'seller');
  const ownerLevyPaid = levyEntries.filter((e) => e.payer === 'owner' && !e.deferred);
  const levy = {
    total: R * levyPerRight(ctx.info, config),
    owner: ownerLevyPaid.reduce((s, e) => s + e.amount, 0),
    developer: levyEntries.filter((e) => e.payer === 'developer').reduce((s, e) => s + e.amount, 0),
    buyer: levyEntries.filter((e) => e.payer === 'buyer').reduce((s, e) => s + (e.rightsPortion ?? 0), 0) * levyPerRight(ctx.info, config),
    deferred: levyEntries.filter((e) => e.payer === 'owner' && e.deferred).reduce((s, e) => s + e.amount, 0),
    ownerMonth: ownerLevyPaid.length ? Math.min(...ownerLevyPaid.map((e) => e.month)) : null,
  };

  const metrics = {
    // Ranking value: position at delivery minus interest after delivery (iteration 6), not the 10-year wealth.
    valueCreated: base.comparisonValue,
    resilience: resilienceOf(base, isFeasible(assessments.adverse), evals.adverse),
    wholeApartments: plan.wholeApartmentsRetained,
    liquidity: base.liquidity,
    simplicity: SIMPLICITY[candidate.type],
    sustainableMonthlyIncome: base.sustainableMonthlyIncome,
    peakDebt: sim.peakDebt,
    commercialScore: 0,
  };
  const assessment = assess(assessments.base, assessments.adverse, developerMargin, blocked !== null);
  metrics.commercialScore = COMMERCIAL_SCORE[assessment.commercial];

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
    servicesVat: sum(ledger, (e) => owner(e) && e.category === 'services_vat'),
    approvalRisk: sum(ledger, (e) => ownerOut(e) && e.month < approvalMonthOf(config)),
    noApproval: noApprovalOutcome(ledger, ownerOut, sim, config),
    capitalGainsRange: plan.capitalGainsRange,
    purchaseTax: sum(ledger, (e) => owner(e) && e.category === 'purchase_tax'),
    additionalCosts: sum(ledger, (e) => owner(e) && ['transaction_costs', 'completion_payment', 'rights_purchase'].includes(e.category)),
    personalCapitalRequired: sim.personalCapitalUsed,
    mortgageRequired: sim.peakDebt,
    monthlyRepayment: sim.peakPersonalMonthly,
    // Stage-by-stage: what is not covered at the peak — unfunded obligations plus debt beyond repayment capacity.
    peakFundingGap: sim.unfunded + (capacity === null ? sim.peakDebt : Math.max(0, sim.peakDebt - capacity)),
    completedPropertyValue:
      (plan.wholeApartmentValueEq + plan.fractionalShare * (1 - config.market.fractionIlliquidityDiscount)) * apartmentValueAt(config, plan.completionMonth),
    estimatedNetMonthlyRentalCashflow: sim.monthlyNetRent - sim.postCompletionMonthly,
    transactionValue: base.transactionValue,
    futureNetWealth: base.futureNetWealth,
    cashAtSigning: 0,
    delivery,
    comparisonValue: base.comparisonValue,
    developerLot,
    levy,
    priceDependency: priceDependencyOf(candidate, plan),
    netCashAtDelivery: sim.cashAtCompletion - sim.referenceAtCompletion,
    feasibility,
    assessment,
    developerMargin,
    developerPnL,
    reasonCodes: [...new Set(reasonCodes)],
    requiredConditions: [...assessments.base.conditions, ...assessments.base.commercial],
    scenarioResults: SCENARIO_IDS.map((id) => ({
      scenarioId: id,
      futureNetWealth: evals[id].futureNetWealth,
      valueCreated: evals[id].valueCreated,
      comparisonValue: evals[id].comparisonValue,
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

/** The outcome if the plan is never approved (see StrategyResult.noApproval). */
function noApprovalOutcome(
  ledger: LedgerEntry[],
  ownerOut: (e: LedgerEntry) => boolean,
  sim: StrategyResult['simulation'],
  config: ProjectConfig,
): StrategyResult['noApproval'] {
  const approval = approvalMonthOf(config);
  const before = ledger.filter((e) => ownerOut(e) && e.month < approval);
  const advances = before.reduce((s, e) => s + e.amount, 0);
  const nonRefundable = before.filter((e) => e.category === 'purchase_tax' || e.category === 'transaction_costs').reduce((s, e) => s + e.amount, 0);
  const purchasedRights = before.filter((e) => e.category === 'rights_purchase').reduce((s, e) => s + e.amount, 0);
  const interest = sim.interestToApproval;
  const refundable = advances - nonRefundable;
  return {
    advances,
    interest,
    nonRefundable,
    purchasedRights,
    protected: interest + nonRefundable,
    partial: interest + nonRefundable + refundable / 2,
    unprotected: advances + interest,
    apartments: 0,
    rent: 0,
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
  const dev = developerEconomics(info, config, terms.combinationPct, profile, terms.developerMarkup);
  const scales = buildScales(ctx, config);
  const results = generateStrategies(info, terms, config).map((c) => buildResult(c, evaluateScenarios(c, ctx, config), ctx, config));
  for (const r of results) r.cashAtSigning = cashAtSigning(r);
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
    // Commercial plausibility is re-evaluated under the stressed configuration, not reused from the base.
    const pnl = candidatePnL(r.candidate, ev.plan, ctx.info, config, ctx.terms);
    const commercial: CommercialCertainty =
      r.assessment.commercial === 'negotiable' ? 'negotiable' : pnl && pnl.marginOnRevenue < 0 ? 'questionable' : r.assessment.commercial === 'not_required' ? 'not_required' : 'unverified';
    return {
      ...r,
      feasibility,
      assessment: { ...r.assessment, commercial },
      mortgageRequired: ev.sim.peakDebt,
      metrics: {
        ...r.metrics,
        commercialScore: COMMERCIAL_SCORE[commercial],
        valueCreated: ev.comparisonValue,
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
    if (r.feasibility === 'infeasible' && r.assessment.commercial !== 'negotiable' && r.plan.apartmentsBuilt >= 1 && focus.size < 4 && !focus.has(r.id)) {
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
      if (!['S05', 'S03'].includes(r.strategyType) || r.rightsSold <= 1e-6 || r.assessment.commercial === 'negotiable') continue;
      if (seenTargets.has(r.plan.wholeApartmentsRetained)) continue;
      seenTargets.add(r.plan.wholeApartmentsRetained);
      negotiationTargets.push(breakevenSurplusPrice(r.candidate, benchmark.candidate, ctx, config));
      negotiationTargets.push(conservativeSurplusPrice(r.candidate, benchmark.candidate, ctx, config));
    }
  }
  // Routes that depend on an unverified price: the price they would need — never an assumed price.
  const priceConditional: DecisionResult['priceConditional'] = [];
  const seenKnobTargets = new Set<string>();
  for (const r of results) {
    if (!r.priceDependency || r.assessment.commercial === 'negotiable') continue;
    const key = `${r.priceDependency}|${r.plan.wholeApartmentsRetained}|${r.strategyType === 'S01M' || r.strategyType === 'S09' || r.strategyType === 'S01' ? r.strategyType : ''}`;
    if (seenKnobTargets.has(key)) continue;
    seenKnobTargets.add(key);
    priceConditional.push({ result: r, threshold: requiredPrice(r.candidate, r.priceDependency, ctx, config, recommendation?.candidate ?? null) });
  }

  // Land value references for this owner's area: dated, typed — and the current market price stays unknown.
  const A = ctx.info.landAreaSqm;
  const parcel33 = LAND_TRANSACTIONS.filter((t) => t.parcel === 33);
  const perSqm = parcel33.map((t) => t.price / t.areaSqm).sort((x, y) => x - y);
  const median = perSqm.length % 2 ? perSqm[(perSqm.length - 1) / 2] : (perSqm[perSqm.length / 2 - 1] + perSqm[perSqm.length / 2]) / 2;
  const latest = [...parcel33].sort((x, y) => y.date.localeCompare(x.date))[0];
  const levyProxy = R_total(ctx, config);
  const landReferences: DecisionResult['landReferences'] = [
    { label: 'העסקה האחרונה שאותרה בחלקה 33', amount: (latest.price / latest.areaSqm) * A, date: latest.date, level: 'observedTransaction', note: 'לפני עדכון הטבלאות; מדווחת, לא אומתה מול רשות המסים' },
    { label: `חציון ${parcel33.length} עסקאות מדווחות בחלקה`, amount: median * A, date: '2024–2026', level: 'observedTransaction', note: 'היסטורי בלבד — לא מחיר היום' },
    { label: 'שווי הזכויות בטבלת ההקצאה', amount: ctx.info.table.allocationValue, date: '2026-11-23', level: 'planningAppraisal', note: `מגרש ${ctx.info.lotId}; שמאות איזון — לא מחיר מכירה` },
    { label: 'שווי בטבלה פחות אומדן היטל השבחה', amount: ctx.info.table.allocationValue - levyProxy, date: '2026-11-23', level: 'planningAppraisal', note: 'עוגן שמאי בלבד — לא תמורה נטו אחרי מסים' },
    { label: 'מחיר מכירה בשוק החופשי היום', amount: null, date: '—', level: 'unknown', note: 'לא נמצאה עסקה מאומתת אחרי עדכון הטבלאות' },
    { label: 'מחיר שיזם מציע עבור הזכויות', amount: null, date: '—', level: 'unknown', note: 'אין הצעה מאושרת' },
  ];
  // How close is the household to an evidence-based route? Extra capital for the most attractive ones.
  const nearMiss: DecisionResult['nearMiss'] = [];
  if (!recommendation && profile.availableCapital !== null) {
    const evidenceBased = results
      .filter((r) => r.priceDependency === null && r.assessment.commercial !== 'negotiable' && r.feasibility === 'infeasible')
      .sort((a, b) => b.metrics.wholeApartments - a.metrics.wholeApartments || b.metrics.valueCreated - a.metrics.valueCreated);
    const seen = new Set<StrategyType>();
    for (const r of evidenceBased) {
      if (seen.has(r.strategyType) || nearMiss.length >= 3) continue;
      seen.add(r.strategyType);
      const t = requiredAdditionalCapital(r.candidate, ctx, config);
      nearMiss.push({ result: r, additionalCapital: t.value });
    }
    nearMiss.sort((a, b) => (a.additionalCapital ?? Infinity) - (b.additionalCapital ?? Infinity));
  }

  // Extra capital each evidence-based route type would need — for the one-per-deal-family summary.
  const capitalGaps: DecisionResult['capitalGaps'] = [];
  if (profile.availableCapital !== null) {
    const seenGap = new Set<StrategyType>();
    const known = new Map(nearMiss.map((n) => [n.result.id, n.additionalCapital]));
    for (const r of results) {
      if (r.priceDependency !== null || r.assessment.commercial === 'negotiable' || r.feasibility !== 'infeasible') continue;
      if (seenGap.has(r.strategyType)) continue;
      seenGap.add(r.strategyType);
      capitalGaps.push({ result: r, additionalCapital: known.has(r.id) ? known.get(r.id)! : requiredAdditionalCapital(r.candidate, ctx, config).value });
    }
  }

  let projection: DecisionResult['projection'] = null;
  if (recommendation) {
    const pcfg: ProjectConfig = {
      ...config,
      market: { ...config.market, apartmentValueAnnualGrowth: config.projection.apartmentValueAnnualGrowth },
      financing: { ...config.financing, alternativeNetAnnualReturn: config.projection.alternativeNetAnnualReturn },
    };
    const ev = evaluateCandidate(recommendation.candidate, ctx, pcfg);
    const monthsLiving = Math.max(0, ev.horizonMonth - ev.plan.completionMonth);
    projection = {
      years: ev.horizonMonth / 12,
      apartmentGrowth: config.projection.apartmentValueAnnualGrowth,
      alternativeReturn: config.projection.alternativeNetAnnualReturn,
      assets: ev.assetsAtHorizon,
      cash: ev.sim.cashAtHorizon,
      debt: ev.sim.debtAtHorizon,
      mortgagePaymentsFV: ev.sim.personalPaymentsFV,
      deferredLiabilities: ev.plan.deferredLiabilities,
      unfunded: ev.sim.unfunded,
      startingCapitalGrown: ev.referenceWealth,
      total: ev.valueCreated,
      housingBenefit: ev.plan.housingBenefitMonthly * monthsLiving,
    };
  }
  const levies = config.rights.lotIds.map((lot) => calculateRights(A, config, lot).bettermentLevy * config.taxation.bettermentLevyFactor);

  // Owner's acceptable price vs the developer's plausible price for surplus rights: overlap or not.
  for (const t of [...negotiationTargets]) {
    if (t.code !== 'BREAKEVEN_SURPLUS_PRICE') continue;
    const devMax = dev.residualLandValuePerSqm;
    negotiationTargets.push({
      code: 'NEGOTIATION_RANGE',
      kind: 'developer',
      strategyId: t.strategyId,
      value: t.value,
      upper: devMax,
      overlap: t.value !== null && t.value <= devMax,
      unit: 'ils_per_sqm',
      current: config.market.developerRightsSaleScenario.pricePerOriginalSqm,
    });
  }

  // --- Tax arrangements: the same household under gross / mixed / net combination terms --------------------
  // A developer that takes on taxes offers a lower %, so each other arrangement is evaluated at its
  // developer-equivalent % — never at the slider's % (that would treat the taxes as free).
  const headline = config.commercial.taxArrangement;
  const eqCtx = { info: ctx.info, profile, config };
  const arrangementTops: { arrangement: TaxArrangement; top: StrategyResult | null; combinationPct: number | null }[] = [];
  const arrangements: ArrangementOutcome[] = TAX_ARRANGEMENTS.map((arrangement) => {
    const pct = arrangement === headline ? terms.combinationPct : developerEquivalentPct(eqCtx, headline, terms.combinationPct, arrangement);
    const c2 =
      arrangement === headline
        ? core
        : pct === null
          ? null
          : coreAnalysis(profile, { ...terms, combinationPct: pct }, withArrangement(config, arrangement));
    const top = c2?.ranked[0] ?? null;
    arrangementTops.push({ arrangement, top, combinationPct: pct });
    return {
      arrangement,
      combinationPct: pct,
      ownerBreakEvenPct: arrangement === headline ? terms.combinationPct : ownerBreakEvenPct(eqCtx, headline, terms.combinationPct, arrangement),
      viablePct: lotViablePct(eqCtx, arrangement),
      recommendationId: top?.id ?? null,
      wholeApartments: top?.metrics.wholeApartments ?? 0,
      feasibility: top?.feasibility ?? null,
      cashAtSigning: top ? cashAtSigning(top) : 0,
      mortgageRequired: top?.mortgageRequired ?? 0,
    };
  });
  // Fallback if the headline's unconfirmed terms fail: the gross-deal winner if different, otherwise the best
  // alternative that is not commercially questionable.
  // The gross run's own result (its ledger and % are gross terms) — never a same-id result from the headline run.
  const gross = arrangementTops.find((x) => x.arrangement === 'gross' && x.arrangement !== headline);
  const grossFallback = gross?.top && gross.top.id !== recommendation?.id && gross.combinationPct !== null ? gross.top : undefined;
  const fallbackTerms: DecisionResult['fallbackTerms'] = grossFallback ? { arrangement: 'gross', combinationPct: gross!.combinationPct! } : null;
  const fallback =
    grossFallback ??
    ranked.find((r) => r !== recommendation && r.strategyType !== recommendation?.strategyType && r.assessment.commercial !== 'questionable') ??
    null;
  const negotiationOnly = results.filter((r) => r.assessment.commercial === 'negotiable');
  // --- Funding for the owner's taxes: never assumed in the headline; evaluated as conditional routes -----------
  const fundingAlternatives = fundingAlternativesFor(profile, terms, config, ctx);
  // Nothing fits under the headline terms? Give a direction anyway, least demanding first: financing the taxes
  // under the offer's own terms (a loan on another property, then a developer/bank tax loan), then other tax terms
  // (mixed before net) at the lower % a developer would offer for them.
  let conditionalRecommendation: DecisionResult['conditionalRecommendation'] = null;
  if (!recommendation) {
    for (const method of ['other_property', 'developer_loan'] as const) {
      const f = fundingAlternatives.find((x) => x.method === method && x.top);
      if (f?.top) {
        conditionalRecommendation = { result: f.top, kind: 'funding', method, arrangement: headline, combinationPct: terms.combinationPct };
        break;
      }
    }
  }
  if (!recommendation && !conditionalRecommendation) {
    const order: TaxArrangement[] = ['mixed', 'net'];
    for (const arr of order) {
      if (arr === headline) continue;
      const hit = arrangementTops.find((x) => x.arrangement === arr && x.top);
      if (hit?.top && hit.combinationPct !== null) {
        conditionalRecommendation = { result: hit.top, kind: 'arrangement', method: null, arrangement: arr, combinationPct: hit.combinationPct };
        break;
      }
    }
  }
  // With no evidence-based recommendation, the price a sale (or other price-dependent route) would need is measured
  // against the conditional direction — at its own terms — so "sell" can be a direction with a price to ask for.
  if (!recommendation && conditionalRecommendation) {
    const bench = { id: conditionalRecommendation.result.id, value: conditionalRecommendation.result.comparisonValue };
    for (const p of priceConditional) {
      p.threshold = requiredPrice(p.result.candidate, p.result.priceDependency!, ctx, config, null, bench);
    }
  }
  // A questionable or unconfirmed winner is never the only answer: if no evidence-based alternative exists, the
  // fallback is a price-dependent route (sale first), shown with the price it would need.
  let finalFallback = fallback;
  let fallbackThreshold: DecisionResult['fallbackThreshold'] = null;
  if (recommendation && !finalFallback && priceConditional.length) {
    const order = ['S01M', 'S01', 'S09', 'S04'];
    const pick = [...priceConditional].sort((x, y) => (order.indexOf(x.result.strategyType) + 99) % 99 - (order.indexOf(y.result.strategyType) + 99) % 99)[0];
    finalFallback = pick.result;
    fallbackThreshold = pick.threshold;
  }


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

  // Material outcome signature: which strategy, whether it is affordable, and the funding need (rounded).
  const signature = (c: CoreAnalysis) => {
    const t = c.ranked[0];
    if (!t) return 'none';
    const need = Math.round((t.simulation.unfunded + t.mortgageRequired) / 25000);
    return `${t.id}|${t.assessment.affordability}|${need}`;
  };
  const mainSignature = signature(core);
  const changesOutcome = (p: UserProfile) => signature(coreAnalysis(p, terms, config)) !== mainSignature;

  return {
    rights: ctx.info,
    results,
    ranked,
    frontierIds,
    recommendation,
    alternatives,
    negotiationTargets,
    followUpQuestions: findMaterialUnknowns(profile, ctx.info, changesOutcome, config),
    sensitivity: { byScenario, drivers },
    mortgageCapacity:
      profile.maxMonthlyRepayment === null
        ? null
        : mortgageCapacity(profile.maxMonthlyRepayment, config.financing.nominalAnnualInterest, config.financing.durationYears),
    developer: dev,
    lotPolicy: lotPolicy(ctx.info, config),
    arrangements,
    fallback: finalFallback,
    fallbackThreshold,
    fallbackTerms,
    negotiationOnly,
    priceConditional,
    landReferences,
    lotAssumed: ctx.info.lotAssumed,
    levyRangeAcrossLots: { min: Math.min(...levies), max: Math.max(...levies) },
    projection,
    nearMiss,
    capitalGaps,
    conditionalRecommendation,
    fundingAlternatives,
    developerThresholds: developerThresholdsFor(ctx, terms, config),
  };
}

const withTaxLoan = (config: ProjectConfig, over: Partial<ProjectConfig['financing']['taxLoan']> = {}): ProjectConfig => ({
  ...config,
  financing: { ...config.financing, taxLoan: { ...config.financing.taxLoan, available: true, ...over } },
});

/**
 * Funding routes for the owner's taxes the household must still obtain: a developer/bank tax loan (prime + 2% + VAT on
 * interest, capped), and — when the household owns another property but gave no borrowing limit — a loan on it.
 * Each with its best route, the loan, the interest, the balance due at delivery, what the owner saves if the developer
 * also bears the interest, and the highest rate at which the route still fits.
 */
function fundingAlternativesFor(profile: UserProfile, terms: CommercialTerms, config: ProjectConfig, ctx: EngineContext): FundingAlternative[] {
  const out: FundingAlternative[] = [];
  const R = ctx.info.apartmentEquivalents;
  const fits = (r: StrategyResult, cfg: ProjectConfig) => {
    const a = assessEvaluation(r.candidate, evaluateCandidate(r.candidate, ctx, cfg), profile, cfg, R);
    return a.fails.length === 0 && a.missing.length === 0;
  };
  if (!config.financing.taxLoan.available && config.financing.taxLoan.considerAsAlternative && profile.maxMonthlyRepayment !== 0) {
    const cfg = withTaxLoan(config);
    const run = coreAnalysis(profile, terms, cfg);
    const top = run.ranked.find((r) => r.simulation.taxLoanDrawn > 0) ?? null;
    let saving = 0;
    let maxRate: number | null = null;
    if (top) {
      const free = { ...cfg, commercial: { ...cfg.commercial, offer: { ...cfg.commercial.offer, developerPaysTaxLoanInterest: true } } };
      const freeEv = evaluateCandidate(top.candidate, ctx, free);
      saving = Math.max(0, top.simulation.taxLoanInterest - freeEv.sim.taxLoanInterest);
      maxRate = solveMax(0, 0.3, (x) => fits(top, withTaxLoan(config, { annualRate: x, vatOnInterest: false })));
    }
    const smaller = run.ranked.find((r) => r.strategyType === 'S13' && r.metrics.wholeApartments === 1 && r.plan.apartmentRooms.includes(3)) ?? null;
    out.push({
      smaller,
      method: 'developer_loan',
      annualRate: taxLoanRate(cfg),
      top,
      loan: top?.simulation.taxLoanDrawn ?? 0,
      interest: top?.simulation.taxLoanInterest ?? 0,
      atMaturity: top?.simulation.taxLoanAtMaturity ?? 0,
      savingIfDeveloperPaysInterest: saving,
      maxRate,
    });
  }
  if (profile.soleHome === false && profile.maxMonthlyRepayment !== 0 && typeof profile.otherPropertyBorrowingLimit !== 'number' && !config.financing.otherPropertyLoanAssumed) {
    const cfg: ProjectConfig = { ...config, financing: { ...config.financing, otherPropertyLoanAssumed: true } };
    const run = coreAnalysis(profile, terms, cfg);
    const top = run.ranked.find((r) => r.simulation.taxesFinancedBySecuredLoan > 0) ?? null;
    out.push({
      method: 'other_property',
      annualRate: config.financing.nominalAnnualInterest,
      top,
      loan: top?.simulation.taxesFinancedBySecuredLoan ?? 0,
      interest: 0,
      atMaturity: top?.simulation.taxesFinancedBySecuredLoan ?? 0,
      savingIfDeveloperPaysInterest: 0,
      maxRate: null,
      smaller: null,
    });
  }
  return out;
}

/** Developer-side thresholds on the lot model, for the panel (computed once per analysis). */
function developerThresholdsFor(ctx: EngineContext, terms: CommercialTerms, config: ProjectConfig): DeveloperThresholds {
  const lotCtx = { info: ctx.info, profile: ctx.profile, config };
  const arr = config.commercial.taxArrangement;
  const opts = { markup: terms.developerMarkup };
  const b = developerBreakEvens(lotCtx, arr, terms.combinationPct, opts);
  const project = projectDeveloperPnL(lotCtx, arr, terms.combinationPct, opts);
  return {
    matrix: profitabilityMatrix(lotCtx, arr, [8000, 9000, 10000, 11000], [23000, 25000, 28000, 32000], opts),
    maxDirectCostPerSqm: b.maxDirectCostPerSqm,
    minApartmentPricePerSqm: b.minApartmentPricePerSqm,
    targetMarginOnRevenue: b.targetMarginOnRevenue,
    profitOnCostAtTarget: b.profitOnCostAtTarget,
    project: {
      lots: project.lots.map((l) => ({ lotId: l.lotId, profit: l.pnl.profit, margin: l.pnl.margin, units: l.pnl.units })),
      profit: project.profit,
      margin: project.margin,
      units: project.units,
    },
    participation: [0, 0.5, 1].map((share) => ({ share, margin: lotDeveloperPnL(lotCtx, arr, terms.combinationPct, { ...opts, participation: share }).margin })),
    budget: budgetView(lotCtx, arr, terms, opts),
  };
}

function budgetView(lotCtx: { info: EngineContext['info']; profile: UserProfile; config: ProjectConfig }, arr: TaxArrangement, terms: CommercialTerms, opts: { markup: number }) {
  const config = lotCtx.config;
  const b = developerBudget(config, lotCtx.info.lotId);
  const scaled = (f: number): ProjectConfig => ({
    ...config,
    developer: {
      ...config.developer,
      survey: { ...config.developer.survey, aboveGroundPerSqm: config.developer.survey.aboveGroundPerSqm * f, undergroundPerSqm: config.developer.survey.undergroundPerSqm * f },
    },
  });
  const margin = (cfg: ProjectConfig) => lotDeveloperPnL({ ...lotCtx, config: cfg }, arr, terms.combinationPct, opts).margin;
  return {
    direct: b.direct,
    perSaleableSqm: b.perSaleableSqm,
    lines: b.lines,
    sensitivity: [
      { label: 'עלות לפי הסקר', margin: margin(config) },
      { label: 'הסקר −10%', margin: margin(scaled(0.9)) },
      { label: 'הסקר +10%', margin: margin(scaled(1.1)) },
      { label: 'עלויות עקיפות 27% (כמו בשמאות למבני ציבור)', margin: margin({ ...config, developer: { ...config.developer, softCostRate: 0.27 } }) },
    ],
  };
}

function R_total(ctx: EngineContext, config: ProjectConfig): number {
  return ctx.info.apartmentEquivalents * levyPerRight(ctx.info, config);
}

export { withArrangement };

/** Owner cash obligations at signing (month 0), excluding the contingency reserve. */
export function cashAtSigning(r: StrategyResult): number {
  return r.ledger
    .filter((e) => e.payer === 'owner' && e.direction === 'out' && e.month === 0 && !e.deferred && e.category !== 'contingency_reserve')
    .reduce((s, e) => s + e.amount, 0);
}
