import type { ProjectConfig } from './types';

/** Contractual quote per apartment: S × cost × (1 + markup) × (1 + VAT). Excludes levy, indexation, contingency. */
export function constructionQuotePerApartment(config: ProjectConfig, markup: number): number {
  const c = config.construction;
  return c.apartmentSizeSqm * c.costPerSqm * (1 + markup) * (1 + config.taxation.vatRate);
}

/** Value of construction services without the developer's markup (used as combination consideration). */
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

export function milestoneMonth(at: number, config: ProjectConfig): number {
  return Math.round(at * config.construction.durationYears * 12);
}

export function completionMonth(config: ProjectConfig): number {
  return milestoneMonth(1, config);
}

export function permitMonth(config: ProjectConfig): number {
  return milestoneMonth(config.construction.permitAt, config);
}

export interface Installment {
  month: number;
  amount: number;
  label: string;
  quote: number;
  indexation: number;
  reserve: number;
}

/** Construction installments for `apartments` apartments, indexed to the payment date. */
export function constructionInstallments(config: ProjectConfig, markup: number, apartments: number): Installment[] {
  if (apartments <= 0) return [];
  const quote = constructionQuotePerApartment(config, markup) * apartments;
  const uplift = costUplift(config);
  return config.construction.schedule.map((m) => {
    const month = milestoneMonth(m.at, config);
    const base = quote * m.share;
    const withReserve = base * uplift;
    const indexed = withReserve * Math.pow(1 + config.construction.annualIndexation, month / 12);
    return {
      month,
      amount: indexed,
      label: m.label,
      quote: base,
      reserve: withReserve - base,
      indexation: indexed - withReserve,
    };
  });
}
