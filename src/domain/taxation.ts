/**
 * Conservative tax reserves — never an individual assessment.
 * Capital gains are always estimated on the taxable gain, never on gross proceeds.
 */
import type { ProjectConfig, RightsInfo, UserProfile } from './types';

export interface TaxReserve {
  /** Amount used by the engine (conservative end when the basis is unknown). */
  used: number;
  low: number;
  high: number;
}

export function hasKnownBasis(profile: UserProfile): boolean {
  return typeof profile.acquisitionBasis === 'number' && Number.isFinite(profile.acquisitionBasis);
}

/** Levy proxy per apartment-equivalent, after the scenario factor. */
export function levyPerRight(info: RightsInfo, config: ProjectConfig): number {
  if (info.apartmentEquivalents <= 0) return 0;
  return (info.bettermentLevy * config.taxation.bettermentLevyFactor) / info.apartmentEquivalents;
}

/**
 * Capital-gains reserve on disposing of `rightsPortion` apartment-equivalents of land.
 * gain = consideration − deductible costs − deductible levy − acquisition basis share.
 * Unknown basis → range: high assumes zero basis, low assumes the table's incoming value.
 */
export function capitalGainsReserve(args: {
  consideration: number;
  deductibleCosts: number;
  deductibleLevy: number;
  rightsPortion: number;
  info: RightsInfo;
  profile: UserProfile;
  config: ProjectConfig;
}): TaxReserve {
  const { consideration, deductibleCosts, deductibleLevy, rightsPortion, info, profile, config } = args;
  const rate = config.taxation.indicativeCapitalGainsRate;
  const share = info.apartmentEquivalents > 0 ? rightsPortion / info.apartmentEquivalents : 0;
  const taxFor = (basis: number) =>
    Math.max(0, consideration - deductibleCosts - deductibleLevy - basis * share) * rate;
  if (hasKnownBasis(profile)) {
    const t = taxFor(profile.acquisitionBasis as number);
    return { used: t, low: t, high: t };
  }
  const high = taxFor(0);
  const low = taxFor(info.table.incomingValue);
  return { used: high, low, high };
}

/**
 * Effective annual rate of a tax loan to the owner: prime + spread, plus VAT on the interest for a developer loan
 * (Rothstein), or 0 when the developer bears the interest under the offer.
 */
export function taxLoanRate(config: ProjectConfig): number {
  if (config.commercial.offer.developerPaysTaxLoanInterest) return 0;
  return taxLoanCostRate(config);
}

/** The loan's full cost rate (prime + spread, plus VAT on interest for a developer loan), whoever bears it. */
export function taxLoanCostRate(config: ProjectConfig): number {
  const t = config.financing.taxLoan;
  return t.annualRate * (t.vatOnInterest ? 1 + config.taxation.vatRate : 1);
}

/** Rate at which the developer bears the owner's tax-loan interest (0 unless the offer says so). */
export function taxLoanSubsidyRate(config: ProjectConfig): number {
  return config.commercial.offer.developerPaysTaxLoanInterest ? taxLoanCostRate(config) : 0;
}

/** Net monthly rent per apartment-equivalent after maintenance/vacancy and the rental-tax reserve. */
export function netMonthlyRentPerApartment(config: ProjectConfig): number {
  return (
    config.market.monthlyRentPerApartment *
    (1 - config.market.rentalExpenseReserve - config.taxation.rentalTaxReserve)
  );
}
