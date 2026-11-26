/**
 * Feasibility before profitability. Checks cash, repayment, collateral and timing constraints,
 * and records the commercial/legal dependencies a candidate relies on.
 */
import type {
  Candidate,
  ConditionCode,
  Feasibility,
  ProjectConfig,
  ReasonCode,
  ScenarioAssessment,
  UserProfile,
} from '../domain/types';
import type { Evaluation } from './evaluate';

const DEBT_EPS = 1;

export function assessEvaluation(
  candidate: Candidate,
  ev: Evaluation,
  profile: UserProfile,
  config: ProjectConfig,
  R: number,
): ScenarioAssessment {
  const fails: ReasonCode[] = [];
  const conditions = new Set<ConditionCode>();
  const missing: ReasonCode[] = [];
  const { plan, sim } = ev;
  const needsDebt = sim.peakDebt > DEBT_EPS;

  if (needsDebt) {
    conditions.add('LENDER_CONFIRMATION');
    const P = profile.maxMonthlyRepayment;
    if (profile.availableCapital === null) {
      // We cannot tell whether the user's own money would cover this.
      missing.push('CAPITAL_UNKNOWN');
    } else if (P === 0) {
      fails.push('NO_BORROWING_CAPACITY');
    } else if (P === null) {
      conditions.add('MORTGAGE_CAPACITY_UNKNOWN');
    } else if (sim.peakPersonalMonthly > P + 1) {
      fails.push('REPAYMENT_EXCEEDED');
    }
    const ltv = plan.collateralValue > 0 ? sim.peakDebt / plan.collateralValue : Infinity;
    if (ltv > config.financing.maxLtv) fails.push('LTV_EXCEEDED');
    else if (ltv > config.financing.comfortableLtv) conditions.add('LTV_ABOVE_COMFORT');
  }

  for (const leg of candidate.legs) {
    if (leg.kind === 'sell_rights' && leg.market === 'developer') {
      if (!config.market.developerRightsSaleScenario.confirmedOffer) conditions.add('DEVELOPER_PRICE_UNVERIFIED');
      if (leg.rights < R - 1e-6) conditions.add('PARTIAL_RIGHTS_PURCHASE');
    }
    if (leg.kind === 'sell_rights' && leg.market === 'open_market') {
      if (config.market.immediateLandSalePricePerSqm === null) missing.push('IMMEDIATE_PRICE_UNKNOWN');
      conditions.add('CURRENT_APPRAISAL');
    }
    if (leg.kind === 'hold_land' && !config.market.developerRightsSaleScenario.confirmedOffer) {
      conditions.add('DEVELOPER_PRICE_UNVERIFIED');
    }
    if (leg.kind === 'revenue_share') conditions.add('REVENUE_SHARE_UNVERIFIED');
    if (leg.kind === 'completion') conditions.add('COMPLETION_PRICE');
    if (leg.kind === 'buy_rights') conditions.add('COMPLEMENTARY_SELLER');
    if (leg.kind === 'build' || leg.kind === 'completion') conditions.add('WHOLE_UNIT_ALLOCATION');
  }

  return { fails, conditions: [...conditions], missing };
}

export function isFeasible(a: ScenarioAssessment): boolean {
  return a.fails.length === 0 && a.missing.length === 0;
}

/** Status precedence: infeasible > missing information > fragile > conditional > feasible. */
export function classify(base: ScenarioAssessment, adverse: ScenarioAssessment): Feasibility {
  if (base.fails.length > 0) return 'infeasible';
  if (base.missing.length > 0) return 'unknown';
  if (adverse.fails.length > 0) return 'fragile';
  if (base.conditions.length > 0) return 'conditional';
  return 'estimated_feasible';
}

export function informationalReasons(candidate: Candidate, ev: Evaluation, R: number, combinationPct: number): ReasonCode[] {
  const reasons: ReasonCode[] = [];
  const eq = ev.plan.retainedApartmentEquivalents;
  if (eq - Math.floor(eq + 1e-9) > 0.01) reasons.push('FRACTIONAL_UNIT');
  if (candidate.type === 'S02' && R * combinationPct < 1 - 1e-9) reasons.push('COMBINATION_BELOW_WHOLE_UNIT');
  if (R < 1 - 1e-9) reasons.push('NOT_ENOUGH_RIGHTS');
  if (ev.sim.peakDebt > DEBT_EPS) reasons.push('USES_MORTGAGE');
  else reasons.push('NO_DEBT');
  if (ev.plan.rentCountsForRepayment && ev.sim.peakDebt > DEBT_EPS) reasons.push('RENT_SUPPORTS_REPAYMENT');
  return reasons;
}
