import type { PaymentMilestone, ProjectConfig } from './types';

/** Contractual quote per apartment: S × cost × (1 + markup) × (1 + VAT). Excludes levy, indexation, contingency. */
export function constructionQuotePerApartment(config: ProjectConfig, markup: number): number {
  const c = config.construction;
  return c.apartmentSizeSqm * c.costPerSqm * (1 + markup) * (1 + config.taxation.vatRate);
}

/**
 * Taxable market value of construction services per apartment in a combination: direct cost plus an ordinary
 * contractor profit (instruction 23/98, 15–20%) plus VAT. Excludes the developer's entrepreneurial profit from
 * selling apartments (EA 6672/19 Yekutieli). Separate from the commercial markup slider.
 */
export function constructionServiceTaxValuePerApartment(config: ProjectConfig): number {
  const c = config.construction;
  return c.apartmentSizeSqm * c.costPerSqm * (1 + config.commercial.contractorProfitRate) * (1 + config.taxation.vatRate);
}

/** Legacy (iteration 1–2) valuation without contractor profit — kept only for the named legacy fixture. */
export function constructionServiceValuePerApartment(config: ProjectConfig): number {
  const c = config.construction;
  return c.apartmentSizeSqm * c.costPerSqm * (1 + config.taxation.vatRate);
}

/**
 * Contingency and realised overrun are tracked separately and never stacked:
 * the reserve is consumed first, so the uplift is max(contingency, overrun).
 */
export function costUplift(config: ProjectConfig): number {
  return 1 + Math.max(config.construction.contingency, config.construction.costOverrun);
}

/** Plan approval (months from signing). */
export function approvalMonth(config: ProjectConfig): number {
  return Math.round(config.timeline.approvalMonths);
}

/** Building permit: after approval, never before it. */
export function permitMonth(config: ProjectConfig): number {
  return approvalMonth(config) + Math.max(0, Math.round(config.timeline.permitAfterApprovalMonths));
}

/** Delivery: the end of the construction period that starts at the permit. */
export function completionMonth(config: ProjectConfig): number {
  return permitMonth(config) + Math.max(1, Math.round(config.timeline.constructionMonths));
}

/** Month of a payment milestone. */
export function milestoneMonth(m: PaymentMilestone, config: ProjectConfig): number {
  if (m.phase === 'signing') return 0;
  const permit = permitMonth(config);
  if (m.phase === 'permit') return permit;
  return Math.round(permit + m.at * (completionMonth(config) - permit));
}

export interface Installment {
  month: number;
  /** Cash actually paid at this milestone (indexed quote + any overrun not covered by the reserve). */
  amount: number;
  label: string;
  quote: number;
  indexation: number;
  /** Overrun at this milestone (scenario-driven), whether or not the reserve covers it. */
  overrun: number;
}

export interface ConstructionSchedule {
  installments: Installment[];
  /** Contingency held as liquidity from signing (not spent in the base case). */
  reserveHeld: number;
  /** Unused reserve released at completion. */
  reserveReleased: number;
  /** Actual construction spend: indexed quote + realised overrun. */
  actualSpend: number;
}

/**
 * Construction schedule for `apartments` (possibly fractional) apartments.
 * The contingency is a liquidity reserve, not a cost: it is held from signing, consumed only by a realised
 * overrun (adverse scenario), and the unused part is released at completion — never counted twice.
 */
export function constructionSchedule(config: ProjectConfig, markup: number, apartments: number): ConstructionSchedule {
  if (apartments <= 0) return { installments: [], reserveHeld: 0, reserveReleased: 0, actualSpend: 0 };
  const quote = constructionQuotePerApartment(config, markup) * apartments;
  const base = config.construction.schedule.map((m) => {
    const month = milestoneMonth(m, config);
    const q = quote * m.share;
    const indexed = q * Math.pow(1 + config.construction.annualIndexation, month / 12);
    return { month, label: m.label, quote: q, indexed };
  });
  const reserveHeld = config.construction.contingency * base.reduce((s, b) => s + b.indexed, 0);
  let reserveLeft = reserveHeld;
  let actualSpend = 0;
  const installments = base.map((b) => {
    const overrun = b.indexed * config.construction.costOverrun;
    const covered = Math.min(reserveLeft, overrun);
    reserveLeft -= covered;
    actualSpend += b.indexed + overrun;
    return { month: b.month, label: b.label, quote: b.quote, indexation: b.indexed - b.quote, overrun, amount: b.indexed + overrun - covered };
  });
  return { installments, reserveHeld, reserveReleased: reserveLeft, actualSpend };
}

/** @deprecated kept for callers that only need the per-milestone cash amounts. */
export function constructionInstallments(config: ProjectConfig, markup: number, apartments: number): Installment[] {
  return constructionSchedule(config, markup, apartments).installments;
}
