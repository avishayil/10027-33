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
  futureNetWealth: number;
  /** Wealth created by the land: wealth at horizon − starting capital grown at the alternative return. */
  valueCreated: number;
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
  const horizonMonth = config.analysis.horizonYears * 12;
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
  });

  // Whole apartments at market value; an unresolved fractional share at an illiquidity discount.
  const aptAtHorizon = apartmentValueAt(config, horizonMonth);
  const assetsAtHorizon =
    plan.wholeApartmentsRetained * aptAtHorizon +
    plan.fractionalShare * aptAtHorizon * (1 - config.market.fractionIlliquidityDiscount) +
    plan.heldLandValueAtHorizon;
  const futureNetWealth =
    sim.cashAtHorizon + assetsAtHorizon - sim.debtAtHorizon - sim.personalPaymentsFV - plan.deferredLiabilities;
  const referenceWealth = startingCash * Math.pow(1 + alt, config.analysis.horizonYears);
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
    referenceWealth,
    assetsAtHorizon,
    liquidity,
    sustainableMonthlyIncome,
  };
}
