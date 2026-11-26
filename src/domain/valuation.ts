import type { ProjectConfig, RightsInfo } from './types';

export function apartmentValueToday(config: ProjectConfig): number {
  return config.construction.apartmentSizeSqm * config.market.apartmentValuePerSqm;
}

export function apartmentValueAt(config: ProjectConfig, month: number): number {
  return apartmentValueToday(config) * Math.pow(1 + config.market.apartmentValueAnnualGrowth, month / 12);
}

/** Gross price a developer would pay for `rights` apartment-equivalents (priced per original m²). */
export function developerRightsPrice(rights: number, info: RightsInfo, config: ProjectConfig): number {
  return rights * info.sqmPerRight * config.market.developerRightsSaleScenario.pricePerOriginalSqm;
}

/** Immediate open-market price. Falls back to the historical reference when no valuation exists. */
export function immediateRightsPrice(rights: number, info: RightsInfo, config: ProjectConfig): number {
  const perSqm = config.market.immediateLandSalePricePerSqm ?? config.market.immediateSaleReferencePerSqm;
  return rights * info.sqmPerRight * perSqm;
}
