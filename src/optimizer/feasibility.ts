/**
 * Feasibility before profitability. Three independent questions:
 *  - affordability: can the household fund every obligation, at every stage?
 *  - resilience: does it still fit in the adverse scenario?
 *  - commercial certainty: are the terms it relies on confirmed, and plausible for a developer?
 */
import type {
  Affordability,
  Assessment,
  Candidate,
  CommercialCertainty,
  ConditionCode,
  Feasibility,
  ProjectConfig,
  ReasonCode,
  ScenarioAssessment,
  UserProfile,
} from '../domain/types';
import type { Evaluation } from './evaluate';

const EPS = 1;

export function assessEvaluation(
  candidate: Candidate,
  ev: Evaluation,
  profile: UserProfile,
  config: ProjectConfig,
  R: number,
): ScenarioAssessment {
  const fails: ReasonCode[] = [];
  const conditions = new Set<ConditionCode>();
  const commercial = new Set<ConditionCode>();
  const missing: ReasonCode[] = [];
  const { sim } = ev;
  const capitalKnown = profile.availableCapital !== null;

  if (sim.unfunded > EPS) {
    // Taxes, levy and transaction costs are not financed by lenders.
    if (capitalKnown) fails.push('UNFUNDED_OBLIGATION');
    else missing.push('CAPITAL_UNKNOWN');
  }

  const financed = sim.drawsByStage.bridge + sim.drawsByStage.construction + sim.drawsByStage.mortgage + sim.taxLoanDrawn;
  if (financed > EPS) {
    const P = profile.maxMonthlyRepayment;
    if (!capitalKnown) {
      if (!missing.includes('CAPITAL_UNKNOWN')) missing.push('CAPITAL_UNKNOWN');
    } else if (P === 0) {
      fails.push('NO_BORROWING_CAPACITY');
    } else if (P === null) {
      conditions.add('MORTGAGE_CAPACITY_UNKNOWN');
    } else if (sim.peakPersonalMonthly > P + 1) {
      fails.push('REPAYMENT_EXCEEDED');
    }
    if (sim.drawsByStage.bridge > EPS) conditions.add('BRIDGE_FINANCING');
    if (sim.taxesFinancedBySecuredLoan > EPS) conditions.add('SECURED_LOAN_OTHER_PROPERTY');
    if (sim.taxLoanDrawn > EPS) conditions.add('TAX_LOAN');
    if (sim.taxLoanRefinanced > EPS) conditions.add('TAX_LOAN_REFINANCE');
    if (sim.taxLoanAtMaturity > EPS && ev.plan.fractionSettled) conditions.add('REPAID_FROM_POOL_SALE');
    if (sim.drawsByStage.construction > EPS) conditions.add('CONSTRUCTION_FINANCING');
    conditions.add('LENDER_CONFIRMATION');
    // Without the user's capital the borrowing need itself is unknown, so collateral cannot be judged either.
    // Construction-stage limit before delivery; the Bank of Israel limit by property status on the delivered homes.
    const postLimit = mortgageLtvLimit(ev.plan.apartmentValues, profile.soleHome ?? null, config);
    const exceeds = sim.peakPreCompletionLtv > config.financing.maxLtv || sim.peakPostCompletionLtv > postLimit + 1e-9;
    const ltv = Math.max(sim.peakPreCompletionLtv, sim.peakPostCompletionLtv);
    if (capitalKnown && exceeds) fails.push('LTV_EXCEEDED');
    else if (capitalKnown && ltv > config.financing.comfortableLtv) conditions.add('LTV_ABOVE_COMFORT');
  }

  const hasCombination = candidate.legs.some((l) => l.kind === 'combination');
  if (hasCombination) {
    const arr = config.commercial.taxArrangement;
    if (arr === 'net') commercial.add('NET_TAX_TERMS');
    if (arr === 'mixed' || arr === 'net') commercial.add('LEVY_TERMS');
    if (config.commercial.combinationSaleDate === 'approval') commercial.add('SALE_DATE_DEFERRAL');
  }
  if (candidate.legs.some((l) => l.kind === 'completion') && profile.soleHome == null) commercial.add('COMPLETION_CLASSIFICATION');
  for (const leg of candidate.legs) {
    if (leg.kind === 'sell_rights' && leg.market === 'developer') {
      if (!config.market.developerRightsSaleScenario.confirmedOffer) commercial.add('DEVELOPER_PRICE_UNVERIFIED');
      if (leg.rights < R - 1e-6) commercial.add('PARTIAL_RIGHTS_PURCHASE');
    }
    if (leg.kind === 'sell_rights' && leg.market === 'open_market') commercial.add('CURRENT_APPRAISAL');
    if (leg.kind === 'sell_rights' && leg.market === 'post_approval') commercial.add('PLANNING_APPROVAL');
    if (leg.kind === 'revenue_share') commercial.add('REVENUE_SHARE_UNVERIFIED');
    if (leg.kind === 'completion') commercial.add('COMPLETION_PRICE');
    if (leg.kind === 'buy_rights') commercial.add('COMPLEMENTARY_SELLER');
    if (leg.kind === 'settle_fraction_cash' || leg.kind === 'balancing_pool') commercial.add('FRACTION_SETTLEMENT');
    if (leg.kind === 'build' && hasCombination) commercial.add('MIXED_STRUCTURE');
    if (leg.kind === 'build' || leg.kind === 'completion') commercial.add('WHOLE_UNIT_ALLOCATION');
    if (leg.kind === 'build') commercial.add('SERVICES_CAPACITY');
  }

  return { fails, conditions: [...conditions], commercial: [...commercial], missing };
}

/**
 * Highest mortgage LTV on the delivered apartments (Bank of Israel directive 329): a sole home 75%, any further
 * apartment 50% (an additional / investment home); an unknown status counts as an additional home until answered.
 * With several apartments the limit is value-weighted — the most valuable one is the sole home.
 */
export function mortgageLtvLimit(values: number[], soleHome: boolean | null, config: ProjectConfig): number {
  const l = config.financing.ltvLimits;
  const total = values.reduce((s, v) => s + v, 0);
  if (total <= 0) return soleHome === true ? l.soleHome : l.additionalHome;
  if (soleHome !== true) return l.additionalHome;
  const first = Math.max(...values);
  return (first * l.soleHome + (total - first) * l.additionalHome) / total;
}

export function isFeasible(a: ScenarioAssessment): boolean {
  return a.fails.length === 0 && a.missing.length === 0;
}

/** Status precedence: infeasible > missing information > fragile > needs financing > feasible. */
export function classify(base: ScenarioAssessment, adverse: ScenarioAssessment): Feasibility {
  if (base.fails.length > 0) return 'infeasible';
  if (base.missing.length > 0) return 'unknown';
  if (adverse.fails.length > 0) return 'fragile';
  if (base.conditions.length > 0) return 'conditional';
  return 'estimated_feasible';
}

export function assess(
  base: ScenarioAssessment,
  adverse: ScenarioAssessment,
  developerMargin: number | null,
  blockedByPolicy = false,
): Assessment {
  const affordability: Affordability =
    base.fails.length > 0 ? 'does_not_fit' : base.missing.length > 0 ? 'unknown' : base.conditions.length > 0 ? 'fits_with_financing' : 'fits';
  const commercial: CommercialCertainty = blockedByPolicy
    ? 'negotiable'
    : developerMargin !== null && developerMargin < 0 ? 'questionable' : base.commercial.length > 0 ? 'unverified' : 'not_required';
  return { affordability, resilience: adverse.fails.length > 0 ? 'fragile' : 'robust', commercial };
}

export function informationalReasons(candidate: Candidate, ev: Evaluation, R: number, combinationPct: number): ReasonCode[] {
  const reasons: ReasonCode[] = [];
  if (ev.plan.fractionalShare > 0.01) reasons.push('FRACTIONAL_UNIT');
  if ((candidate.type === 'S02' || candidate.type === 'S02C') && R * combinationPct < 1 - 1e-9) reasons.push('COMBINATION_BELOW_WHOLE_UNIT');
  if (R < 1 - 1e-9) reasons.push('NOT_ENOUGH_RIGHTS');
  if (ev.sim.totalDrawn > EPS) reasons.push('USES_MORTGAGE');
  else reasons.push('NO_DEBT');
  if (ev.plan.rentCountsForRepayment && ev.sim.totalDrawn > EPS) reasons.push('RENT_SUPPORTS_REPAYMENT');
  return reasons;
}
