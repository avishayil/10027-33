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
  'services_vat',
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
  /** First month with rent (default: delivery). */
  rentStartMonth?: number;
  /** Share of rent counted against the repayment limit (default 1). Cash still receives all of it. */
  rentRecognition?: number;
  preCompletionLandCollateral?: number;
  postCompletionCollateral?: number;
  /** Share of amounts paid into the asset recognised as security before completion (default 1). */
  workInProgressRecognition?: number;
  /**
   * The household owns another property and can borrow against it: taxes, levy and costs that cash cannot cover may
   * be financed by that secured loan (conditional on lender approval) instead of being unfunded.
   */
  taxesFinanceableBySecuredLoan?: boolean;
  /**
   * A tax loan from the developer or the financing bank (combination deals): covers eligible tax events cash cannot
   * pay. Interest is capitalised until completion (no payments before it); the balance is then refinanced as a
   * mortgage on the delivered apartment, where the LTV test applies (not against the pre-delivery land price).
   */
  taxLoan?: {
    annualRate: number;
    limit?: number;
    /** Interest the developer bears instead of the owner (the owner's rate is then 0): accrued as a subsidy. */
    subsidyRate?: number;
  };
  /**
   * The conditional facility that may refinance a tax loan at maturity on the delivered apartment (e.g. the "any purpose"
   * 50% of its value). Default: no limit (unit tests); the engine always passes the limit. Cash repays first; what this
   * facility cannot cover is a maturity gap, never silently turned into a mortgage.
   */
  taxLoanRefinanceLimit?: number;
  /**
   * Total mortgage limit on the delivered apartment as a share of its value (status-based, e.g. 75%): the refinance
   * may only use what the project mortgage leaves of it (iteration 10 / review D3). Default: no combined limit.
   */
  mortgageLimitShare?: number;
  /** Most that can be borrowed against the other property (default: no limit). */
  securedLoanLimit?: number;
  /** Real annual discount rate for pvInterest (default 0). */
  discountRate?: number;
  /** A month at which to measure a developer failure during construction: interest paid and debt outstanding then. */
  failureMonth?: number;
  /** Plan approval month: interest paid up to it is what a cancellation would cost in financing. */
  approvalMonth?: number;
  /** Inflation to deflate the (nominal) financing flows in pvFinancing (default 0). */
  inflation?: number;
  /**
   * Today's-price amounts (events with priceBasis 'real', rent and collateral values) are converted to nominal shekels on
   * their date with `inflation`, so cash, debt and repayments share one money basis (iteration 9 / F04).
   */
  realInputs?: { rent: boolean; collateral: boolean };
  /** The loan on another property ("any purpose"): its own rate and term; it amortises from the draw. */
  securedLoan?: { annualRate: number; years: number };
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
  // One money basis: every amount in nominal shekels on its date.
  const index = (m: number) => Math.pow(1 + (input.inflation ?? 0), m / 12);
  const byMonth = new Map<number, CashEvent[]>();
  for (const e of input.events) {
    const m = Math.max(0, Math.round(e.month));
    const list = byMonth.get(m) ?? [];
    list.push(e.priceBasis === 'real' ? { ...e, amount: e.amount * index(m), priceBasis: 'nominal' } : e);
    byMonth.set(m, list);
  }
  const rentAt = (m: number) => input.monthlyNetRent * (input.realInputs?.rent ? index(m) : 1);
  const collateralAt = (x: number, m: number) => x * (input.realInputs?.collateral ? index(m) : 1);
  const reserveAfter = datedReserve(byMonth, H);

  let cash = input.startingCash;
  let reference = input.startingCash;
  let debt = 0;
  let peakDebt = 0;
  let totalDrawn = 0;
  let unfunded = 0;
  let taxesFinanced = 0;
  let taxLoanBalance = 0;
  let taxLoanDrawn = 0;
  let taxLoanInterest = 0;
  let taxLoanAtMaturity = 0;
  let taxLoanSubsidy = 0;
  let pvInterest = 0;
  let interestToApproval = 0;
  let interestToFailure = 0;
  let debtAtFailure = 0;
  // Financing flows in nominal terms, deflated and discounted to today: + proceeds, − debt service, − debt at the end.
  let pvFinancing = 0;
  const dfNominal = (m: number) => Math.pow((1 + (input.inflation ?? 0)) * (1 + (input.discountRate ?? 0)), -m / 12);
  const draw = (m: number, x: number) => {
    pvFinancing += x * dfNominal(m);
  };
  const service = (m: number, x: number) => {
    pvFinancing -= x * dfNominal(m);
  };
  const dfMonth = (m: number) => Math.pow(1 + (input.discountRate ?? 0), -m / 12);
  const subsidyMonthly = input.taxLoan?.subsidyRate ? input.taxLoan.subsidyRate / 12 : 0;
  let taxLoanRefinanced = 0;
  let taxLoanMaturityGap = 0;
  let taxLoanMatured = false;
  // The refinance facility's limit in nominal shekels, fixed at maturity.
  let refinanceCap = 0;
  const refinanceLimit = input.taxLoanRefinanceLimit ?? Infinity;
  // External project draws only (construction, completion, …) — a tax loan refinanced into the mortgage is a transfer.
  let projectDrawn = 0;
  let taxLoanInterestToDelivery = 0;
  // Interest deflated to today's prices on the month it accrues (for the today's-price views).
  const deflateAt = (m: number) => Math.pow(1 + (input.inflation ?? 0), -m / 12);
  let realInterestToCompletion = 0;
  let realTaxLoanInterestToDelivery = 0;
  let realInterestToApproval = 0;
  let realInterestToFailure = 0;
  const taxLoanLimit = input.taxLoan?.limit ?? Infinity;
  const securedLimit = input.securedLoanLimit ?? Infinity;
  let interestAfterCompletion = 0;
  const taxLoanMonthly = input.taxLoan ? input.taxLoan.annualRate / 12 : 0;
  // Facilities kept apart: project debt (construction → mortgage on the delivered apartment), the loan on another
  // property (its own rate, amortising from the draw, secured outside the project) and the tax loan.
  let secured = 0;
  let securedPayment = 0;
  let securedPeak = 0;
  const securedRate = (input.securedLoan?.annualRate ?? input.annualRate) / 12;
  const securedYears = input.securedLoan?.years ?? input.mortgageYears;
  let projectPeak = 0;
  let mortgageMonthsUsed = 0;
  const projectDebt = () => debt;
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
    if (taxLoanBalance > 0) {
      // Capitalised until delivery; an overdue balance after delivery keeps accruing at the same rate.
      const accrued = taxLoanBalance * taxLoanMonthly;
      taxLoanBalance += accrued;
      taxLoanInterest += accrued;
      if (m <= input.completionMonth) {
        taxLoanInterestToDelivery += accrued;
        realTaxLoanInterestToDelivery += accrued * deflateAt(m);
      }
      if (taxLoanMatured) pvInterest += accrued * dfMonth(m);
      // Interest the developer pays on the owner's behalf (it accrues on the developer, not on the balance).
      if (m <= input.completionMonth) taxLoanSubsidy += taxLoanBalance * subsidyMonthly;
    }

    for (const e of events) if (e.amount >= 0) cash += e.amount;

    for (const e of events) {
      if (e.amount >= 0 || !NON_FINANCEABLE.has(e.category)) continue;
      const need = -e.amount;
      const fromCash = Math.min(Math.max(cash, 0), need);
      cash -= fromCash;
      let short = need - fromCash;
      if (short > EPS && input.taxesFinanceableBySecuredLoan) {
        // A loan secured on the household's other property, up to the limit the household stated.
        const x = Math.min(short, Math.max(0, securedLimit - taxesFinanced));
        secured += x;
        totalDrawn += x;
        taxesFinanced += x;
        draw(m, x);
        short -= x;
        // An "any purpose" loan amortises from the draw: the payment is recomputed on the new balance.
        if (x > 0) securedPayment = monthlyPayment(secured, securedRate * 12, securedYears);
      }
      if (short > EPS && input.taxLoan && e.taxLoanEligible) {
        // A developer/bank tax loan for combination taxes, up to the facility cap.
        const x = Math.min(short, Math.max(0, taxLoanLimit - taxLoanDrawn));
        totalDrawn += x;
        taxLoanDrawn += x;
        // Drawn after delivery it is due at once: the maturity step below repays or refinances it, or reports a gap.
        taxLoanBalance += x;
        draw(m, x);
        short -= x;
      }
      if (short > EPS) {
        unfunded += short;
        unfundedItems.push({ month: m, category: e.category, label: e.label, amount: short });
      }
    }

    for (const e of events) {
      if (e.amount >= 0 || NON_FINANCEABLE.has(e.category)) continue;
      const need = -e.amount;
      if (ASSET_BUILDING.has(e.category)) paidIntoAsset += need;
      const available = Math.max(0, cash - reserveAfter[m]);
      const fromCash = Math.min(available, need);
      cash -= fromCash;
      const x = need - fromCash;
      if (x > 0) {
        debt += x;
        totalDrawn += x;
        drawsByStage[stage] += x;
        projectDrawn += x;
        draw(m, x);
      }
    }

    // Tax-loan maturity (delivery; iteration 9 / F03). Maximum exposure is measured before any same-month repayment.
    // 1. cash first; 2. the explicit, conditional refinance facility on the delivered apartment, up to its limit;
    // 3. whatever remains is a maturity gap — it stays outstanding (overdue) and is reported, never turned into debt.
    peakDebt = Math.max(peakDebt, debt + taxLoanBalance + secured);
    if (taxLoanBalance > 0 && m >= input.completionMonth) {
      if (!taxLoanMatured) {
        taxLoanMatured = true;
        taxLoanAtMaturity = taxLoanBalance;
        // The any-purpose ceiling, and what the status-based mortgage limit leaves after the project mortgage — both in
        // nominal shekels of the maturity month.
        const combined =
          input.mortgageLimitShare === undefined ? Infinity : Math.max(0, collateralAt(input.mortgageLimitShare * (input.postCompletionCollateral ?? 0), m) - debt);
        refinanceCap = Math.min(collateralAt(refinanceLimit, m), combined);
        // The capitalised tax-loan interest falls due at maturity.
        pvInterest += taxLoanInterest * dfMonth(m);
      }
      const repay = Math.min(taxLoanBalance, Math.max(0, cash - reserveAfter[m]));
      taxLoanBalance -= repay;
      cash -= repay;
      service(m, repay);
      const x = Math.min(taxLoanBalance, Math.max(0, refinanceCap - taxLoanRefinanced));
      if (x > 0) {
        debt += x;
        drawsByStage.mortgage += x;
        taxLoanRefinanced += x;
        taxLoanBalance -= x;
      }
      taxLoanMaturityGap = Math.max(taxLoanMaturityGap, taxLoanBalance);
    }

    if (debt > 0) {
      const repay = Math.min(debt, Math.max(0, cash - reserveAfter[m]));
      debt -= repay;
      cash -= repay;
      service(m, repay);
    }
    if (taxLoanBalance > 0) {
      const repay = Math.min(taxLoanBalance, Math.max(0, cash - reserveAfter[m]));
      taxLoanBalance -= repay;
      cash -= repay;
      service(m, repay);
    }

    peakDebt = Math.max(peakDebt, debt + taxLoanBalance + secured);
    projectPeak = Math.max(projectPeak, debt);
    securedPeak = Math.max(securedPeak, secured);
    maxCapitalUsed = Math.max(maxCapitalUsed, Math.min(reference, reference - cash));

    const afterCompletion = m >= input.completionMonth;
    if (debt > EPS) {
      if (!afterCompletion) {
        const collateral = collateralAt(input.preCompletionLandCollateral ?? 0, m) + paidIntoAsset * wip;
        // Not on this project's land: a loan secured on the household's other property, and the tax loan — the
        // developer/escort bank underwrites it on the owner's apartment entitlement, and it is tested on the
        // delivered apartment once refinanced (post-completion LTV).
        peakPreLtv = Math.max(peakPreLtv, collateral > 0 ? projectDebt() / collateral : projectDebt() > EPS ? Infinity : 0);
      } else {
        const collateral = collateralAt(input.postCompletionCollateral ?? 0, m);
        peakPostLtv = Math.max(peakPostLtv, collateral > 0 ? projectDebt() / collateral : projectDebt() > EPS ? Infinity : 0);
      }
    }

    let payment = 0;
    if (debt > 1e-9) {
      const interest = debt * r;
      if (m <= input.completionMonth) {
        interestToCompletion += interest;
        realInterestToCompletion += interest * deflateAt(m);
      } else interestAfterCompletion += interest;
      pvInterest += interest * dfMonth(m);
      if (input.approvalMonth !== undefined && m <= input.approvalMonth) {
        interestToApproval += interest;
        realInterestToApproval += interest * deflateAt(m);
      }
      if (input.failureMonth !== undefined && m <= input.failureMonth) {
        interestToFailure += interest;
        realInterestToFailure += interest * deflateAt(m);
      }
      if (!afterCompletion) {
        payment = interest;
        constructionMonthly = Math.max(constructionMonthly, payment);
      } else {
        if (amortPayment === 0 || Math.abs(debt - amortBase) > EPS) {
          amortPayment = monthlyPayment(debt, input.annualRate, input.mortgageYears);
        }
        payment = Math.min(amortPayment, debt + interest);
        debt = Math.max(0, debt - (payment - interest));
        amortBase = debt;
        mortgageMonthsUsed += 1;
      }
    }
    // The loan on another property: interest and principal every month from the draw.
    if (secured > 1e-9) {
      const interest = secured * securedRate;
      if (m <= input.completionMonth) {
        interestToCompletion += interest;
        realInterestToCompletion += interest * deflateAt(m);
      } else interestAfterCompletion += interest;
      pvInterest += interest * dfMonth(m);
      if (input.approvalMonth !== undefined && m <= input.approvalMonth) {
        interestToApproval += interest;
        realInterestToApproval += interest * deflateAt(m);
      }
      if (input.failureMonth !== undefined && m <= input.failureMonth) {
        interestToFailure += interest;
        realInterestToFailure += interest * deflateAt(m);
      }
      const p = Math.min(securedPayment, secured + interest);
      secured = Math.max(0, secured - (p - interest));
      payment += p;
      if (!afterCompletion) constructionMonthly = Math.max(constructionMonthly, payment);
    }
    if (afterCompletion) postCompletionMonthly = Math.max(postCompletionMonthly, payment);
    paymentsFV += payment;
    service(m, payment);

    const rent = afterCompletion && m >= (input.rentStartMonth ?? input.completionMonth) ? rentAt(m) : 0;
    cash += rent;
    const personal = payment - (input.rentCountsForRepayment ? rent * (input.rentRecognition ?? 1) : 0);
    peakPersonal = Math.max(peakPersonal, personal);

    if (m === input.liquidityMonth) cashAtLiquidity = cash;
    if (m === input.completionMonth) {
      cashAtCompletion = cash;
      // Including a tax-loan balance that is overdue (neither repaid nor refinanced at maturity).
      debtAtCompletion = debt + secured + taxLoanBalance;
      referenceAtCompletion = reference;
    }
    if (m === input.failureMonth) debtAtFailure = debt + secured + taxLoanBalance;
    if ((m + 1) % 12 === 0) yearly.push({ year: (m + 1) / 12, cash, debt });
  }
  if (input.liquidityMonth >= H) cashAtLiquidity = cash;
  // Debt left at the end is still owed.
  service(H, debt + taxLoanBalance + secured);

  cash *= growth;
  paymentsFV *= growth;

  return {
    cashAtHorizon: cash,
    debtAtHorizon: debt + taxLoanBalance + secured,
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
    taxLoanDrawn,
    taxLoanInterest,
    taxLoanAtMaturity,
    interestAfterCompletion,
    taxLoanRefinanced,
    taxLoanMaturityGap,
    taxLoanSubsidy,
    taxLoanInterestToDelivery,
    taxLoanRefinanceCap: Number.isFinite(refinanceCap) ? refinanceCap : 0,
    real: {
      interestToCompletion: realInterestToCompletion,
      taxLoanInterestToDelivery: realTaxLoanInterestToDelivery,
      interestToApproval: realInterestToApproval,
      interestToFailure: realInterestToFailure,
    },
    pvInterest,
    interestToApproval,
    interestToFailure,
    debtAtFailure,
    pvFinancing,
    facilities: [
      { type: 'project_loan', drawn: projectDrawn, peak: projectPeak, annualRate: input.annualRate, repayment: 'interest_only_then_amortising', termMonths: input.mortgageYears * 12, monthsUsed: mortgageMonthsUsed },
      { type: 'secured_other_property', drawn: taxesFinanced, peak: securedPeak, annualRate: securedRate * 12, repayment: 'amortising_from_draw', termMonths: securedYears * 12, monthsUsed: 0 },
      { type: 'tax_loan', drawn: taxLoanDrawn, peak: taxLoanAtMaturity, annualRate: taxLoanMonthly * 12, repayment: 'bullet_at_delivery', termMonths: input.completionMonth, monthsUsed: 0 },
      // The part of the tax loan moved into the mortgage at maturity: a transfer between facilities, not a new draw.
      { type: 'tax_loan_refinance', drawn: taxLoanRefinanced, peak: taxLoanRefinanced, annualRate: input.annualRate, repayment: 'interest_only_then_amortising', termMonths: input.mortgageYears * 12, monthsUsed: 0 },
    ].filter((f) => f.drawn > 0.5) as SimulationResult['facilities'],
    peakPreCompletionLtv: peakPreLtv,
    peakPostCompletionLtv: peakPostLtv,
    yearly,
  };
}
