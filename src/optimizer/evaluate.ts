import { simulateCashflow } from '../domain/cashflow';
import { permitMonth } from '../domain/construction';
import { taxLoanRate, taxLoanSubsidyRate } from '../domain/taxation';
import { approvalMonthOf, buildTransactionPlan, monthlyNetRentFor } from '../domain/transactions';
import { mortgageLtvLimit } from './feasibility';
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
  /** Starting cash grown at the alternative return, in nominal shekels of the horizon year. */
  referenceWealthNominal: number;
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
  /** Interest paid during construction plus the tax-loan interest capitalised to delivery (today's prices). */
  interestToDelivery: number;
  /** Every amount in this view is in today's prices (nominal events and interest deflated on their dates). */
  basis: 'today';
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
  // One money basis (iteration 10 / review D4): nominal (indexed) events deflated to today's prices on their dates.
  const real = (e: LedgerEntry) => (e.priceBasis === 'nominal' ? e.amount * Math.pow(1 + config.analysis.inflation, -e.month / 12) : e.amount);
  const sum = (pred: (e: LedgerEntry) => boolean) => plan.ledger.filter(pred).reduce((s, e) => s + real(e), 0);
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
  // Interest to delivery only (an overdue tax loan's later accrual is excluded), deflated month by month.
  const interestToDelivery = sim.real.interestToCompletion + sim.real.taxLoanInterestToDelivery;
  return {
    apartmentsValue,
    fractionValue,
    ownerCashIn,
    ownerCashOut: ownerCashOut + reserveNet,
    constructionAndCompletionPaid: sum((e) => owner(e) && (e.category === 'construction' || e.category === 'completion_payment')),
    interestToDelivery,
    basis: 'today',
    // The debt is a nominal balance at delivery; shown in today's prices.
    debtAtDelivery: sim.debtAtCompletion * Math.pow(1 + config.analysis.inflation, -plan.completionMonth / 12),
    receivablesAfterDelivery,
    payablesAfterDelivery,
    netPosition:
      apartmentsValue + fractionValue + ownerCashIn - (ownerCashOut + reserveNet) + receivablesAfterDelivery - payablesAfterDelivery - interestToDelivery,
  };
}


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
    const nominal = e.priceBasis === 'nominal';
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

/** The modelled developer-failure month: half-way between the permit and delivery. */
export function failureMonthOf(config: ProjectConfig, completionMonth: number): number {
  return Math.round((permitMonth(config) + completionMonth) / 2);
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
    rentStartMonth: plan.completionMonth + Math.max(0, Math.round(config.market.rentStartDelayMonths)),
    rentRecognition: config.market.lenderRentRecognition,
    preCompletionLandCollateral: plan.preCompletionLandCollateral,
    postCompletionCollateral: plan.postCompletionCollateral,
    workInProgressRecognition: config.financing.workInProgressRecognition,
    discountRate: config.analysis.discountRate,
    approvalMonth: approvalMonthOf(config),
    failureMonth: failureMonthOf(config, plan.completionMonth),
    inflation: config.analysis.inflation,
    // Only when the household said it owns another property and has not ruled out borrowing.
    // A loan on another property only up to the limit the household stated (or in the conditional funding run);
    // never when the household ruled out borrowing.
    taxesFinanceableBySecuredLoan:
      ctx.profile.soleHome === false &&
      ctx.profile.maxMonthlyRepayment !== 0 &&
      (typeof ctx.profile.otherPropertyBorrowingLimit === 'number' || config.financing.otherPropertyLoanAssumed),
    securedLoanLimit: typeof ctx.profile.otherPropertyBorrowingLimit === 'number' ? ctx.profile.otherPropertyBorrowingLimit : undefined,
    securedLoan: config.financing.securedLoan,
    // Refinancing a tax loan on the delivered whole apartments: the "any purpose" share of their value (conditional).
    taxLoanRefinanceLimit: config.financing.ltvLimits.additionalHome * plan.postCompletionCollateral,
    // …and within the status-based mortgage limit, after the project mortgage already on the apartment.
    mortgageLimitShare: mortgageLtvLimit(plan.apartmentValues, ctx.profile.soleHome ?? null, config, ctx.profile.replacementHome === true),
    // Plan amounts in today's prices (and rent, collateral) are converted to nominal shekels on their dates.
    realInputs: { rent: true, collateral: true },
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
  // Iteration 9 / F04: the simulation is in nominal shekels; wealth at the horizon is stated in today's prices, so
  // nominal cash, debt, payments and unfunded amounts are deflated (each unfunded item from its own date).
  const deflate = (m: number) => Math.pow(1 + config.analysis.inflation, -m / 12);
  const unfundedReal = sim.unfundedItems.reduce((x, u) => x + u.amount * deflate(u.month), 0);
  const futureNetWealth =
    (sim.cashAtHorizon - sim.debtAtHorizon - sim.personalPaymentsFV) * deflate(horizonMonth) + assetsAtHorizon - plan.deferredLiabilities - unfundedReal;
  const referenceWealth = startingCash * Math.pow(1 + alt, horizonMonth / 12) * deflate(horizonMonth);
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
    // Nominal shekels of the horizon year (for the optional projection, which is stated in those shekels).
    referenceWealthNominal: startingCash * Math.pow(1 + alt, horizonMonth / 12),
    assetsAtHorizon,
    liquidity,
    sustainableMonthlyIncome,
  };
}
