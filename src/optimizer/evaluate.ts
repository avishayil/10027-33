import { simulateCashflow } from '../domain/cashflow';
import { permitMonth } from '../domain/construction';
import { buildTransactionPlan, monthlyNetRentFor } from '../domain/transactions';
import type {
  Candidate,
  CommercialTerms,
  ProjectConfig,
  RightsInfo,
  SimulationResult,
  TransactionPlan,
  UserProfile,
} from '../domain/types';
import { apartmentValueAt } from '../domain/valuation';

export interface EngineContext {
  info: RightsInfo;
  profile: UserProfile;
  terms: CommercialTerms;
}

export interface Evaluation {
  plan: TransactionPlan;
  sim: SimulationResult;
  startingCash: number;
  /**
   * Projected net realization value at the common horizon (pre-liquidation: apartments at market value, no exit
   * tax on a home that is kept), including the user's starting cash grown at the assumed return.
   */
  futureNetWealth: number;
  /**
   * Net realization value attributable to the land: futureNetWealth − starting capital grown. It does NOT subtract
   * what the land is already worth today; the incremental gain vs selling today is computed in analyze.ts.
   */
  valueCreated: number;
  horizonMonth: number;
  referenceWealth: number;
  assetsAtHorizon: number;
  liquidity: number;
  sustainableMonthlyIncome: number;
}

export function liquidityYears(profile: UserProfile, config: ProjectConfig): number {
  return profile.liquidityDeadlineYears ?? config.analysis.liquidityDeadlineYears;
}

/** Forward evaluation of one candidate under one (already scenario-adjusted) configuration. */
export function evaluateCandidate(candidate: Candidate, ctx: EngineContext, config: ProjectConfig): Evaluation {
  const plan = buildTransactionPlan(candidate, { ...ctx, config });
  const startingCash = Math.max(0, ctx.profile.availableCapital ?? 0);
  // Common horizon within a scenario: at least the configured horizon and a year after completion, so a delayed
  // delivery is never valued as a completed apartment before it exists.
  const horizonMonth = Math.max(config.analysis.horizonYears * 12, permitMonth(config) + 1, plan.completionMonth + 12);
  const alt = config.financing.alternativeNetAnnualReturn;
  const liqYears = liquidityYears(ctx.profile, config);

  const sim = simulateCashflow({
    events: plan.events,
    startingCash,
    annualRate: config.financing.nominalAnnualInterest,
    mortgageYears: config.financing.durationYears,
    alternativeReturn: alt,
    permitMonth: permitMonth(config),
    completionMonth: plan.completionMonth,
    horizonMonth,
    liquidityMonth: Math.max(1, Math.round(liqYears * 12)),
    monthlyNetRent: monthlyNetRentFor(plan, config),
    rentCountsForRepayment: plan.rentCountsForRepayment,
    preCompletionLandCollateral: plan.preCompletionLandCollateral,
    postCompletionCollateral: plan.postCompletionCollateral,
    workInProgressRecognition: config.financing.workInProgressRecognition,
    // Only when the household said it owns another property and has not ruled out borrowing.
    taxesFinanceableBySecuredLoan: ctx.profile.soleHome === false && ctx.profile.maxMonthlyRepayment !== 0,
  });

  // Whole apartments at market value; an unresolved fractional share at an illiquidity discount.
  const aptAtHorizon = apartmentValueAt(config, horizonMonth);
  const assetsAtHorizon =
    plan.wholeApartmentValueEq * aptAtHorizon +
    plan.fractionalShare * aptAtHorizon * (1 - config.market.fractionIlliquidityDiscount) +
    plan.heldLandValueAtHorizon;
  // Unfunded obligations stay as liabilities (they are not loans and carry no modelled interest).
  const futureNetWealth =
    sim.cashAtHorizon + assetsAtHorizon - sim.debtAtHorizon - sim.personalPaymentsFV - plan.deferredLiabilities - sim.unfunded;
  const referenceWealth = startingCash * Math.pow(1 + alt, horizonMonth / 12);
  const referenceAtDeadline = startingCash * Math.pow(1 + alt, liqYears);
  const liquidity = Math.max(0, sim.cashAtLiquidityDeadline - referenceAtDeadline);
  const investedProceeds = Math.max(0, sim.cashAtCompletion - sim.referenceAtCompletion);
  const sustainableMonthlyIncome =
    sim.monthlyNetRent - sim.postCompletionMonthly + (investedProceeds * alt) / 12;

  return {
    plan,
    sim,
    startingCash,
    futureNetWealth,
    valueCreated: futureNetWealth - referenceWealth,
    horizonMonth,
    referenceWealth,
    assetsAtHorizon,
    liquidity,
    sustainableMonthlyIncome,
  };
}
