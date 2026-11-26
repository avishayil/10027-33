/**
 * Month-by-month cash-flow simulation.
 *
 * Policy (deterministic):
 *  - Uses are paid from cash first; any shortfall is drawn as mortgage debt.
 *  - Every non-rent source (sale proceeds) first repays outstanding debt.
 *  - Until completion the debt is interest-only; from completion it amortises over the mortgage term.
 *  - Mortgage payments come from the household's income (tracked as a future-valued outflow).
 *  - Net rent (or the equivalent rent saved) arrives only after completion — it never funds
 *    construction-stage payments.
 */
import { monthlyPayment } from './mortgage';
import type { CashEvent, SimulationResult } from './types';

export interface SimulationInput {
  events: CashEvent[];
  startingCash: number;
  annualRate: number;
  mortgageYears: number;
  alternativeReturn: number;
  completionMonth: number;
  horizonMonth: number;
  liquidityMonth: number;
  monthlyNetRent: number;
  rentCountsForRepayment: boolean;
}

const EPS = 0.5;

export function simulateCashflow(input: SimulationInput): SimulationResult {
  const growth = Math.pow(1 + input.alternativeReturn, 1 / 12);
  const r = input.annualRate / 12;
  const byMonth = new Map<number, CashEvent[]>();
  for (const e of input.events) {
    const m = Math.max(0, Math.min(input.horizonMonth - 1, Math.round(e.month)));
    const list = byMonth.get(m) ?? [];
    list.push(e);
    byMonth.set(m, list);
  }

  let cash = input.startingCash;
  let reference = input.startingCash; // starting capital grown at the alternative return
  let debt = 0;
  let peakDebt = 0;
  let totalDrawn = 0;
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
  const yearly: SimulationResult['yearly'] = [];

  for (let m = 0; m < input.horizonMonth; m += 1) {
    if (m > 0) {
      cash *= growth;
      reference *= growth;
      paymentsFV *= growth;
    }

    const events = (byMonth.get(m) ?? []).slice().sort((a, b) => b.amount - a.amount);
    for (const e of events) {
      if (e.amount >= 0) {
        const repay = Math.min(debt, e.amount);
        debt -= repay;
        cash += e.amount - repay;
      } else {
        const need = -e.amount;
        const fromCash = Math.min(Math.max(cash, 0), need);
        cash -= fromCash;
        const draw = need - fromCash;
        if (draw > 0) {
          debt += draw;
          totalDrawn += draw;
        }
      }
    }
    peakDebt = Math.max(peakDebt, debt);
    maxCapitalUsed = Math.max(maxCapitalUsed, Math.min(reference, reference - cash));

    const afterCompletion = m >= input.completionMonth;
    let payment = 0;
    if (debt > 1e-9) {
      if (!afterCompletion) {
        payment = debt * r;
        constructionMonthly = Math.max(constructionMonthly, payment);
      } else {
        if (amortPayment === 0 || Math.abs(debt - amortBase) > EPS) {
          // (Re)start amortisation on the balance at completion (or after a new draw / prepayment).
          amortPayment = monthlyPayment(debt, input.annualRate, input.mortgageYears);
          amortBase = debt;
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
    if (m + 1 === input.completionMonth) {
      cashAtCompletion = cash;
      referenceAtCompletion = reference;
    }
    if ((m + 1) % 12 === 0) yearly.push({ year: (m + 1) / 12, cash, debt });
  }

  // Value everything at the end of the horizon (month H), one growth step after the last month.
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
    yearly,
  };
}
