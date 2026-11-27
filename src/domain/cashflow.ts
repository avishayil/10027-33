/**
 * Month-by-month cash-flow simulation with staged financing. Indicative — not an approved draw schedule.
 *
 * Policy (deterministic):
 *  - Within a month, sources arrive first; then obligations lenders do not finance (taxes, levy, transaction
 *    costs) are paid from cash; then financeable uses.
 *  - Cash is reserved for later non-financeable obligations in date order: the reserve at month m is the largest
 *    cumulative deficit of (non-financeable uses − sources) over any later prefix. A receipt that arrives after a
 *    tax is due can never fund that tax.
 *  - Financeable uses beyond available cash are borrowed, by stage: bridge (before the permit), construction
 *    financing (permit → completion), completed-property mortgage (from completion). All conditional.
 *  - A non-financeable shortfall is an UNFUNDED obligation: reported with date and type, never turned into a
 *    loan, never charged interest. Any unfunded amount makes a strategy infeasible.
 *  - Surplus cash above the reserve repays debt at the end of each month.
 *  - Interest-only until completion, then amortising; the last payment is clamped to principal + interest.
 *  - Rent (or rent saved) arrives only after completion and only from whole apartments.
 *  - Collateral before completion: retained land at the developer price + a recognised share of amounts already
 *    paid into the asset (not the contingency reserve, interest or taxes). From completion: whole apartments.
 *  - Snapshots are taken at the END of the stated month, after that month's transactions (inclusive).
 *  - Events after the requested horizon extend it; nothing is clamped into the final month.
 */
import { monthlyPayment } from './mortgage';
import type { CashEvent, FinancingStage, LedgerCategory, SimulationResult } from './types';

export const NON_FINANCEABLE: ReadonlySet<LedgerCategory> = new Set<LedgerCategory>([
  'capital_gains_tax',
  'purchase_tax',
  'transaction_costs',
  'betterment_levy',
]);

/** Payments that create the asset and can partly count toward pre-completion collateral. */
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
  /** Share of amounts paid into the asset recognised as security before completion (default 1). */
  workInProgressRecognition?: number;
  /**
   * The household owns another property and can borrow against it: taxes, levy and costs that cash cannot cover may
   * be financed by that secured loan (conditional on lender approval) instead of being unfunded.
   */
  taxesFinanceableBySecuredLoan?: boolean;
}

const EPS = 0.5;

export function stageOf(month: number, permitMonth: number, completionMonth: number): FinancingStage {
  if (month >= completionMonth) return 'mortgage';
  if (month >= permitMonth) return 'construction';
  return 'bridge';
}

/**
 * reserve[m] = max(0, max over k > m of Σ_{j=m+1..k} (nonFinanceableUses_j − sources_j)).
 * Computed backwards: reserve[m] = max(0, d[m+1] + reserve[m+1]).
 */
export function datedReserve(byMonth: Map<number, CashEvent[]>, H: number): number[] {
  const reserve: number[] = new Array(H + 1).fill(0);
  for (let m = H - 2; m >= 0; m -= 1) {
    let d = 0;
    for (const e of byMonth.get(m + 1) ?? []) {
      if (e.amount >= 0) d -= e.amount;
      else if (NON_FINANCEABLE.has(e.category)) d += -e.amount;
    }
    reserve[m] = Math.max(0, d + reserve[m + 1]);
  }
  return reserve;
}

export function simulateCashflow(input: SimulationInput): SimulationResult {
  const growth = Math.pow(1 + input.alternativeReturn, 1 / 12);
  const r = input.annualRate / 12;
  const lastEvent = input.events.reduce((m, e) => Math.max(m, Math.round(e.month)), 0);
  const H = Math.max(input.horizonMonth, lastEvent + 1);
  const wip = input.workInProgressRecognition ?? 1;
  const byMonth = new Map<number, CashEvent[]>();
  for (const e of input.events) {
    const m = Math.max(0, Math.round(e.month));
    const list = byMonth.get(m) ?? [];
    list.push(e);
    byMonth.set(m, list);
  }
  const reserveAfter = datedReserve(byMonth, H);

  let cash = input.startingCash;
  let reference = input.startingCash;
  let debt = 0;
  let peakDebt = 0;
  let totalDrawn = 0;
  let unfunded = 0;
  let taxesFinanced = 0;
  // Principal repaid so far (prepayments + amortisation), attributed to the secured tax loan first — so the debt
  // counted against the project's own collateral is never understated.
  let principalRepaid = 0;
  const projectDebt = () => Math.max(0, debt - Math.max(0, taxesFinanced - principalRepaid));
  const unfundedItems: SimulationResult['unfundedItems'] = [];
  const drawsByStage: Record<FinancingStage, number> = { bridge: 0, construction: 0, mortgage: 0 };
  let amortPayment = 0;
  let amortBase = 0;
  let paymentsFV = 0;
  let peakPersonal = 0;
  let constructionMonthly = 0;
  let postCompletionMonthly = 0;
  let cashAtLiquidity = input.startingCash;
  let cashAtCompletion = input.startingCash;
  let debtAtCompletion = 0;
  let interestToCompletion = 0;
  let referenceAtCompletion = input.startingCash;
  let maxCapitalUsed = 0;
  let paidIntoAsset = 0;
  let peakPreLtv = 0;
  let peakPostLtv = 0;
  const yearly: SimulationResult['yearly'] = [];

  for (let m = 0; m < H; m += 1) {
    if (m > 0) {
      cash *= growth;
      reference *= growth;
      paymentsFV *= growth;
    }
    const events = byMonth.get(m) ?? [];
    const stage = stageOf(m, input.permitMonth, input.completionMonth);

    for (const e of events) if (e.amount >= 0) cash += e.amount;

    for (const e of events) {
      if (e.amount >= 0 || !NON_FINANCEABLE.has(e.category)) continue;
      const need = -e.amount;
      const fromCash = Math.min(Math.max(cash, 0), need);
      cash -= fromCash;
      if (need - fromCash > EPS) {
        if (input.taxesFinanceableBySecuredLoan) {
          const draw = need - fromCash;
          debt += draw;
          totalDrawn += draw;
          drawsByStage[stage] += draw;
          taxesFinanced += draw;
        } else {
          unfunded += need - fromCash;
          unfundedItems.push({ month: m, category: e.category, label: e.label, amount: need - fromCash });
        }
      }
    }

    for (const e of events) {
      if (e.amount >= 0 || NON_FINANCEABLE.has(e.category)) continue;
      const need = -e.amount;
      if (ASSET_BUILDING.has(e.category)) paidIntoAsset += need;
      const available = Math.max(0, cash - reserveAfter[m]);
      const fromCash = Math.min(available, need);
      cash -= fromCash;
      const draw = need - fromCash;
      if (draw > 0) {
        debt += draw;
        totalDrawn += draw;
        drawsByStage[stage] += draw;
      }
    }

    if (debt > 0) {
      const repay = Math.min(debt, Math.max(0, cash - reserveAfter[m]));
      debt -= repay;
      principalRepaid += repay;
      cash -= repay;
    }

    peakDebt = Math.max(peakDebt, debt);
    maxCapitalUsed = Math.max(maxCapitalUsed, Math.min(reference, reference - cash));

    const afterCompletion = m >= input.completionMonth;
    if (debt > EPS) {
      if (!afterCompletion) {
        const collateral = (input.preCompletionLandCollateral ?? 0) + paidIntoAsset * wip;
        // The tax loan is secured on the household's other property, not on this project.
        peakPreLtv = Math.max(peakPreLtv, collateral > 0 ? projectDebt() / collateral : projectDebt() > EPS ? Infinity : 0);
      } else {
        const collateral = input.postCompletionCollateral ?? 0;
        peakPostLtv = Math.max(peakPostLtv, collateral > 0 ? projectDebt() / collateral : projectDebt() > EPS ? Infinity : 0);
      }
    }

    let payment = 0;
    if (debt > 1e-9) {
      const interest = debt * r;
      if (m <= input.completionMonth) interestToCompletion += interest;
      if (!afterCompletion) {
        payment = interest;
        constructionMonthly = Math.max(constructionMonthly, payment);
      } else {
        if (amortPayment === 0 || Math.abs(debt - amortBase) > EPS) {
          amortPayment = monthlyPayment(debt, input.annualRate, input.mortgageYears);
        }
        payment = Math.min(amortPayment, debt + interest);
        postCompletionMonthly = Math.max(postCompletionMonthly, payment);
        const before = debt;
        debt = Math.max(0, debt - (payment - interest));
        principalRepaid += before - debt;
        amortBase = debt;
      }
    }
    paymentsFV += payment;

    const rent = afterCompletion ? input.monthlyNetRent : 0;
    cash += rent;
    const personal = payment - (input.rentCountsForRepayment ? rent : 0);
    peakPersonal = Math.max(peakPersonal, personal);

    if (m === input.liquidityMonth) cashAtLiquidity = cash;
    if (m === input.completionMonth) {
      cashAtCompletion = cash;
      debtAtCompletion = debt;
      referenceAtCompletion = reference;
    }
    if ((m + 1) % 12 === 0) yearly.push({ year: (m + 1) / 12, cash, debt });
  }
  if (input.liquidityMonth >= H) cashAtLiquidity = cash;

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
    debtAtCompletion,
    interestPaidToCompletion: interestToCompletion,
    referenceAtCompletion,
    personalCapitalUsed: Math.max(0, maxCapitalUsed),
    drawsByStage,
    unfunded,
    unfundedItems,
    taxesFinancedBySecuredLoan: taxesFinanced,
    peakPreCompletionLtv: peakPreLtv,
    peakPostCompletionLtv: peakPostLtv,
    yearly,
  };
}
