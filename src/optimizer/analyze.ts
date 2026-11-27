/**
 * Entry point: analyzeProfile(profile, terms, config) → DecisionResult.
 * Generate → Evaluate → Filter → Stress-test → Rank and explain.
 */
import { PROJECT_CONFIG } from '../data/config';
import { applyScenario, applyScenarioParams, PARAM_LABELS, scenarioParams, SCENARIO_IDS, type ScenarioParamKey } from '../data/scenarios';
import { candidatePnL, developerEconomics } from '../domain/developer';
import { lotPolicy, policyBlock } from '../domain/policy';
import { mortgageCapacity } from '../domain/mortgage';
import { calculateRights } from '../domain/rights';
import { levyPerRight, netMonthlyRentPerApartment } from '../domain/taxation';
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
} from '../domain/types';
import { apartmentValueAt, apartmentValueToday } from '../domain/valuation';
import { LAND_TRANSACTIONS } from '../data/evidence';
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
  if (!adverseFeasible || base.valueCreated <= 0) return 0;
  return Math.max(0, Math.min(1, adverse.valueCreated / base.valueCreated));
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
    if (leg.kind === 'buy_rights') return 'post_approval_price';
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
  const developerMargin = developerPnL ? developerPnL.marginOnRevenue : null;
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
  const alt = config.financing.alternativeNetAnnualReturn;
  const aptToday = apartmentValueToday(config);
  const ownerOut = (e: LedgerEntry) => owner(e) && !e.deferred && e.category !== 'contingency_reserve';
  const ownerCashOut = sum(ledger, ownerOut);
  const ownerCashIn = sum(ledger, (e) => e.direction === 'in' && e.category !== 'contingency_release') ;
  const reserveNet = sum(ledger, (e) => e.category === 'contingency_reserve') - sum(ledger, (e) => e.category === 'contingency_release');
  const apartmentsValue = plan.wholeApartmentValueEq * aptToday;
  const fractionValue = plan.fractionalShare * aptToday * (1 - config.market.fractionIlliquidityDiscount);
  const delivery = {
    apartmentsValue,
    fractionValue,
    ownerCashIn,
    ownerCashOut: ownerCashOut + reserveNet,
    constructionAndCompletionPaid: sum(ledger, (e) => owner(e) && (e.category === 'construction' || e.category === 'completion_payment')),
    interestToDelivery: sim.interestPaidToCompletion,
    debtAtDelivery: sim.debtAtCompletion,
    netPosition: apartmentsValue + fractionValue + ownerCashIn - (ownerCashOut + reserveNet) - sim.interestPaidToCompletion,
  };
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
    valueCreated: base.valueCreated,
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
    netPresentValue: base.valueCreated / Math.pow(1 + alt, base.horizonMonth / 12),
    futureNetWealth: base.futureNetWealth,
    cashAtSigning: 0,
    delivery,
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
  const dev = developerEconomics(info, config, terms.combinationPct, profile);
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
  const arrangements: ArrangementOutcome[] = (['gross', 'mixed', 'net'] as TaxArrangement[]).map((arrangement) => {
    const c2 = arrangement === config.commercial.taxArrangement ? core : coreAnalysis(profile, terms, withArrangement(config, arrangement));
    const top = c2.ranked[0] ?? null;
    return {
      arrangement,
      recommendationId: top?.id ?? null,
      wholeApartments: top?.metrics.wholeApartments ?? 0,
      feasibility: top?.feasibility ?? null,
      cashAtSigning: top ? cashAtSigning(top) : 0,
      mortgageRequired: top?.mortgageRequired ?? 0,
    };
  });
  // Fallback if the headline's unconfirmed terms fail: the gross-deal winner if different, otherwise the best
  // alternative that is not commercially questionable.
  const grossTop = arrangements.find((x) => x.arrangement === 'gross')?.recommendationId ?? null;
  const grossFallback = grossTop && grossTop !== recommendation?.id ? results.find((r) => r.id === grossTop) : undefined;
  const fallback =
    grossFallback ??
    ranked.find((r) => r !== recommendation && r.strategyType !== recommendation?.strategyType && r.assessment.commercial !== 'questionable') ??
    null;
  const negotiationOnly = results.filter((r) => r.assessment.commercial === 'negotiable');
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
    negotiationOnly,
    priceConditional,
    landReferences,
    lotAssumed: ctx.info.lotAssumed,
    levyRangeAcrossLots: { min: Math.min(...levies), max: Math.max(...levies) },
    projection,
    nearMiss,
  };
}

function R_total(ctx: EngineContext, config: ProjectConfig): number {
  return ctx.info.apartmentEquivalents * levyPerRight(ctx.info, config);
}

export function withArrangement(config: ProjectConfig, taxArrangement: TaxArrangement): ProjectConfig {
  return { ...config, commercial: { ...config.commercial, taxArrangement } };
}

/** Owner cash obligations at signing (month 0), excluding the contingency reserve. */
export function cashAtSigning(r: StrategyResult): number {
  return r.ledger
    .filter((e) => e.payer === 'owner' && e.direction === 'out' && e.month === 0 && !e.deferred && e.category !== 'contingency_reserve')
    .reduce((s, e) => s + e.amount, 0);
}
