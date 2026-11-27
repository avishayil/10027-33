import { simulateCashflow } from '../domain/cashflow';
import { permitMonth } from '../domain/construction';
import { taxLoanRate, taxLoanSubsidyRate } from '../domain/taxation';
import { approvalMonthOf, buildTransactionPlan, monthlyNetRentFor } from '../domain/transactions';
import type {
  Candidate,
  CommercialTerms,
  ProjectConfig,
  RightsInfo,
  SimulationResult,
  TransactionPlan,
  UserProfile,
  LedgerEntry,
} from '../domain/types';
import { apartmentValueAt, apartmentValueToday } from '../domain/valuation';

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
  /** Position at delivery (today's prices) — what the owner holds and paid, after financing to delivery. */
  delivery: Delivery;
  /** The deal before personal financing (transactionValueOf). */
  transactionValue: number;
  /**
   * The value the ranking compares (iteration 8, "value to you"): transaction value plus the owner's financing flows —
   * loan proceeds, debt service and the debt left at the horizon — at a real discount rate, today's prices.
   */
  comparisonValue: number;
  horizonMonth: number;
  referenceWealth: number;
  assetsAtHorizon: number;
  liquidity: number;
  sustainableMonthlyIncome: number;
}

export interface Delivery {
  apartmentsValue: number;
  fractionValue: number;
  ownerCashIn: number;
  ownerCashOut: number;
  constructionAndCompletionPaid: number;
  /** Interest paid during construction plus the tax-loan interest capitalised to delivery. */
  interestToDelivery: number;
  debtAtDelivery: number;
  /** Receipts due after delivery (e.g. a delayed pool sale) — receivables at delivery, not cash. */
  receivablesAfterDelivery: number;
  /** Payments due after delivery (e.g. the tax on a delayed pool sale). */
  payablesAfterDelivery: number;
  /** Assets + cash in − cash out by delivery + receivables − payables − interest to delivery. */
  netPosition: number;
}

/**
 * The owner's position on the delivery date (today's prices): apartments, what was paid in and out by then, what is
 * still due to or from the owner after it, and the interest to delivery.
 */
export function deliveryOf(plan: TransactionPlan, sim: SimulationResult, config: ProjectConfig): Delivery {
  const sum = (pred: (e: LedgerEntry) => boolean) => plan.ledger.filter(pred).reduce((s, e) => s + e.amount, 0);
  const owner = (e: LedgerEntry) => e.payer === 'owner' && e.direction === 'out';
  const byDelivery = (e: LedgerEntry) => e.month <= plan.completionMonth;
  const aptToday = apartmentValueToday(config);
  const ownerCashOut = sum((e) => owner(e) && !e.deferred && e.category !== 'contingency_reserve' && byDelivery(e));
  const ownerCashIn = sum((e) => e.direction === 'in' && e.category !== 'contingency_release' && byDelivery(e));
  const receivablesAfterDelivery = sum((e) => e.direction === 'in' && e.category !== 'contingency_release' && !byDelivery(e));
  const payablesAfterDelivery = sum((e) => owner(e) && !e.deferred && e.category !== 'contingency_reserve' && !byDelivery(e));
  const reserveNet = sum((e) => e.category === 'contingency_reserve') - sum((e) => e.category === 'contingency_release');
  const apartmentsValue = plan.wholeApartmentValueEq * aptToday;
  const fractionValue = plan.fractionalShare * aptToday * (1 - config.market.fractionIlliquidityDiscount);
  const interestToDelivery = sim.interestPaidToCompletion + sim.taxLoanInterest;
  return {
    apartmentsValue,
    fractionValue,
    ownerCashIn,
    ownerCashOut: ownerCashOut + reserveNet,
    constructionAndCompletionPaid: sum((e) => owner(e) && (e.category === 'construction' || e.category === 'completion_payment')),
    interestToDelivery,
    debtAtDelivery: sim.debtAtCompletion,
    receivablesAfterDelivery,
    payablesAfterDelivery,
    netPosition:
      apartmentsValue + fractionValue + ownerCashIn - (ownerCashOut + reserveNet) + receivablesAfterDelivery - payablesAfterDelivery - interestToDelivery,
  };
}

/** Ledger categories that are nominal amounts (indexed construction payments and their reserve). */
const NOMINAL: ReadonlySet<string> = new Set(['construction', 'contingency_reserve', 'contingency_release']);

/**
 * Transaction value at signing (real, today's prices): every owner ledger flow at its own month — nominal ones
 * deflated by inflation — and the apartments (and any held land) at delivery, before personal financing.
 */
export function transactionValueOf(plan: TransactionPlan, config: ProjectConfig): number {
  const d = config.analysis.discountRate;
  const i = config.analysis.inflation;
  const df = (m: number, nominal: boolean) => Math.pow((1 + d) * (nominal ? 1 + i : 1), -m / 12);
  let pv = 0;
  for (const e of plan.ledger) {
    if (e.deferred) continue;
    const nominal = NOMINAL.has(e.category);
    if (e.direction === 'in') pv += e.amount * df(e.month, nominal);
    else if (e.payer === 'owner') pv -= e.amount * df(e.month, nominal);
  }
  const df0 = (m: number) => df(m, false);
  const aptToday = apartmentValueToday(config);
  const assets = plan.wholeApartmentValueEq * aptToday + plan.fractionalShare * aptToday * (1 - config.market.fractionIlliquidityDiscount);
  pv += assets * df0(plan.completionMonth);
  pv += (plan.heldLandValueAtHorizon - plan.deferredLiabilities) * df0(config.analysis.horizonYears * 12);
  return pv;
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
    discountRate: config.analysis.discountRate,
    approvalMonth: approvalMonthOf(config),
    inflation: config.analysis.inflation,
    // Only when the household said it owns another property and has not ruled out borrowing.
    // A loan on another property only up to the limit the household stated (or in the conditional funding run);
    // never when the household ruled out borrowing.
    taxesFinanceableBySecuredLoan:
      ctx.profile.soleHome === false &&
      ctx.profile.maxMonthlyRepayment !== 0 &&
      (typeof ctx.profile.otherPropertyBorrowingLimit === 'number' || config.financing.otherPropertyLoanAssumed),
    securedLoanLimit: typeof ctx.profile.otherPropertyBorrowingLimit === 'number' ? ctx.profile.otherPropertyBorrowingLimit : undefined,
    // A developer/bank tax loan for combination taxes: only when the configuration enables it (conditional run).
    taxLoan:
      config.financing.taxLoan.available && ctx.profile.maxMonthlyRepayment !== 0
        ? {
            annualRate: taxLoanRate(config),
            subsidyRate: taxLoanSubsidyRate(config),
            limit:
              config.financing.taxLoan.maxShareOfEntitlement === null
                ? undefined
                : // The lender's security is the apartment entitlement the owner receives (before any fraction is sold).
                  config.financing.taxLoan.maxShareOfEntitlement *
                  (plan.retainedApartmentEquivalents + (plan.fractionSettled?.share ?? 0) + plan.apartmentsSoldByOwner) *
                  apartmentValueToday(config),
          }
        : undefined,
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

  const delivery = deliveryOf(plan, sim, config);
  return {
    plan,
    sim,
    startingCash,
    futureNetWealth,
    valueCreated: futureNetWealth - referenceWealth,
    delivery,
    transactionValue: transactionValueOf(plan, config),
    comparisonValue: transactionValueOf(plan, config) + sim.pvFinancing,
    horizonMonth,
    referenceWealth,
    assetsAtHorizon,
    liquidity,
    sustainableMonthlyIncome,
  };
}
