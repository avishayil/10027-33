/**
 * Month-by-month cash-flow simulation with staged financing.
 *
 * Policy (deterministic):
 *  - Sources (sale proceeds) go to cash first; within a month, obligations no lender finances
 *    (taxes, levy, transaction costs) are paid before anything else.
 *  - Cash is kept in reserve for future non-financeable obligations not covered by future sources.
 *  - Financeable uses beyond available cash are borrowed, by stage:
 *      before the permit  → bridge financing (conditional)
 *      permit → completion → construction financing (conditional, staged drawdowns)
 *      from completion     → completed-property mortgage
 *  - A non-financeable shortfall is an UNFUNDED obligation. It is still carried as debt so the
 *    simulation stays consistent, but a strategy with unfunded obligations can never be feasible.
 *  - Surplus cash above the reserve repays debt at the end of each month.
 *  - Interest-only until completion, then amortising. Payments come from income (future-valued outflow).
 *  - Rent arrives only after completion and only for whole, rentable apartments.
 *  - Collateral: before completion, retained land + amounts paid into the asset (sold rights excluded);
 *    from completion, whole retained apartments.
 */
import { monthlyPayment } from './mortgage';
import type { CashEvent, FinancingStage, LedgerCategory, SimulationResult } from './types';

export const NON_FINANCEABLE: ReadonlySet<LedgerCategory> = new Set<LedgerCategory>([
  'capital_gains_tax',
  'purchase_tax',
  'transaction_costs',
  'betterment_levy',
]);

/** Payments that create the asset and therefore count toward pre-completion collateral. */
const ASSET_BUILDING: ReadonlySet<LedgerCategory> = new Set<LedgerCategory>([
  'construction',
  'completion_payment',
  'rights_purchase',
]);

export interface SimulationInput {
  events: CashEvent[];
  startingCash: number;
  annualRate: number;
  mortgageYears: number;
  alternativeReturn: number;
  permitMonth: number;
  completionMonth: number;
  horizonMonth: number;
  liquidityMonth: number;
  monthlyNetRent: number;
  rentCountsForRepayment: boolean;
  preCompletionLandCollateral?: number;
  postCompletionCollateral?: number;
}

const EPS = 0.5;

export function stageOf(month: number, permitMonth: number, completionMonth: number): FinancingStage {
  if (month >= completionMonth) return 'mortgage';
  if (month >= permitMonth) return 'construction';
  return 'bridge';
}

export function simulateCashflow(input: SimulationInput): SimulationResult {
  const growth = Math.pow(1 + input.alternativeReturn, 1 / 12);
  const r = input.annualRate / 12;
  const H = input.horizonMonth;
  const byMonth = new Map<number, CashEvent[]>();
  for (const e of input.events) {
    const m = Math.max(0, Math.min(H - 1, Math.round(e.month)));
    const list = byMonth.get(m) ?? [];
    list.push(e);
    byMonth.set(m, list);
  }

  // Reserve: future non-financeable uses not covered by future sources (undiscounted, conservative).
  const reserveAfter: number[] = new Array(H + 1).fill(0);
  let futureNonFin = 0;
  let futureSources = 0;
  for (let m = H - 1; m >= 0; m -= 1) {
    reserveAfter[m] = Math.max(0, futureNonFin - futureSources);
    for (const e of byMonth.get(m) ?? []) {
      if (e.amount >= 0) futureSources += e.amount;
      else if (NON_FINANCEABLE.has(e.category)) futureNonFin += -e.amount;
    }
  }

  let cash = input.startingCash;
  let reference = input.startingCash;
  let debt = 0;
  let peakDebt = 0;
  let totalDrawn = 0;
  let unfunded = 0;
  const drawsByStage: Record<FinancingStage, number> = { bridge: 0, construction: 0, mortgage: 0 };
  let amortPayment = 0;
  let amortBase = 0;
  let paymentsFV = 0;
  let peakPersonal = 0;
  let constructionMonthly = 0;
  let postCompletionMonthly = 0;
  let cashAtLiquidity = input.startingCash;
  let cashAtCompletion = input.startingCash;
  let referenceAtCompletion = input.startingCash;
  let maxCapitalUsed = 0;
  let paidIntoAsset = 0;
  let peakPreLtv = 0;
  let peakPostLtv = 0;
  const yearly: SimulationResult['yearly'] = [];

  const draw = (amount: number, stage: FinancingStage) => {
    debt += amount;
    totalDrawn += amount;
    drawsByStage[stage] += amount;
  };

  for (let m = 0; m < H; m += 1) {
    if (m > 0) {
      cash *= growth;
      reference *= growth;
      paymentsFV *= growth;
    }
    const events = byMonth.get(m) ?? [];
    const stage = stageOf(m, input.permitMonth, input.completionMonth);

    for (const e of events) if (e.amount >= 0) cash += e.amount;

    // Non-financeable obligations first, from all cash.
    for (const e of events) {
      if (e.amount >= 0 || !NON_FINANCEABLE.has(e.category)) continue;
      const need = -e.amount;
      const fromCash = Math.min(Math.max(cash, 0), need);
      cash -= fromCash;
      if (need - fromCash > 0) {
        unfunded += need - fromCash;
        debt += need - fromCash;
        totalDrawn += need - fromCash;
      }
    }

    // Financeable uses: cash above the reserve, then borrowing for this stage.
    for (const e of events) {
      if (e.amount >= 0 || NON_FINANCEABLE.has(e.category)) continue;
      const need = -e.amount;
      if (ASSET_BUILDING.has(e.category)) paidIntoAsset += need;
      const available = Math.max(0, cash - reserveAfter[m]);
      const fromCash = Math.min(available, need);
      cash -= fromCash;
      if (need - fromCash > 0) draw(need - fromCash, stage);
    }

    // Surplus cash above the reserve repays debt.
    if (debt > 0) {
      const surplus = Math.max(0, cash - reserveAfter[m]);
      const repay = Math.min(debt, surplus);
      debt -= repay;
      cash -= repay;
    }

    peakDebt = Math.max(peakDebt, debt);
    maxCapitalUsed = Math.max(maxCapitalUsed, Math.min(reference, reference - cash));

    const afterCompletion = m >= input.completionMonth;
    if (debt > EPS) {
      if (!afterCompletion) {
        const collateral = (input.preCompletionLandCollateral ?? 0) + paidIntoAsset;
        peakPreLtv = Math.max(peakPreLtv, collateral > 0 ? debt / collateral : Infinity);
      } else {
        const collateral = input.postCompletionCollateral ?? 0;
        peakPostLtv = Math.max(peakPostLtv, collateral > 0 ? debt / collateral : Infinity);
      }
    }

    let payment = 0;
    if (debt > 1e-9) {
      if (!afterCompletion) {
        payment = debt * r;
        constructionMonthly = Math.max(constructionMonthly, payment);
      } else {
        if (amortPayment === 0 || Math.abs(debt - amortBase) > EPS) {
          amortPayment = monthlyPayment(debt, input.annualRate, input.mortgageYears);
        }
        payment = amortPayment;
        postCompletionMonthly = Math.max(postCompletionMonthly, payment);
        const interest = debt * r;
        debt = Math.max(0, debt - (payment - interest));
        amortBase = debt;
      }
    }
    paymentsFV += payment;

    const rent = afterCompletion ? input.monthlyNetRent : 0;
    cash += rent;
    const personal = payment - (input.rentCountsForRepayment ? rent : 0);
    peakPersonal = Math.max(peakPersonal, personal);

    if (m + 1 === input.liquidityMonth) cashAtLiquidity = cash;
    if (m === input.completionMonth) {
      // Snapshot after the completion month's transactions.
      cashAtCompletion = cash;
      referenceAtCompletion = reference;
    }
    if ((m + 1) % 12 === 0) yearly.push({ year: (m + 1) / 12, cash, debt });
  }

  cash *= growth;
  paymentsFV *= growth;

  return {
    cashAtHorizon: cash,
    debtAtHorizon: debt,
    peakDebt,
    totalDrawn,
    peakPersonalMonthly: Math.max(0, peakPersonal),
    constructionPhaseMonthly: constructionMonthly,
    postCompletionMonthly,
    monthlyNetRent: input.monthlyNetRent,
    personalPaymentsFV: paymentsFV,
    cashAtLiquidityDeadline: cashAtLiquidity,
    cashAtCompletion,
    referenceAtCompletion,
    personalCapitalUsed: Math.max(0, maxCapitalUsed),
    drawsByStage,
    unfunded,
    peakPreCompletionLtv: peakPreLtv,
    peakPostCompletionLtv: peakPostLtv,
    yearly,
  };
}
