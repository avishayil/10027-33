/**
 * Indicative developer-side economics. Answers: is the offer we assume plausible for a developer,
 * and what cash price for land is consistent with a given combination offer?
 *
 * Revenue is apartment sales net of VAT. Developer costs: own direct construction cost (no markup),
 * soft costs, VAT on construction services delivered to the owner in a combination, the betterment
 * levy where the developer pays it, land and purchase tax where it buys land.
 * "Developer markup" (the slider) is the profit on construction services sold to an owner;
 * "margin" here is the profit on the whole project as a share of revenue. They are different things.
 * Estimates only — never a confirmed offer.
 */
import type { DeveloperEconomics, ProjectConfig, RightsInfo } from './types';
import { apartmentValueToday } from './valuation';

export function developerEconomics(info: RightsInfo, config: ProjectConfig, combinationPct: number): DeveloperEconomics {
  const R = info.apartmentEquivalents;
  const A = info.landAreaSqm;
  const vat = config.taxation.vatRate;
  const gross = apartmentValueToday(config);
  const a = gross / (1 + vat);
  const d = config.construction.apartmentSizeSqm * config.developer.directCostPerSqm;
  const build = d * (1 + config.developer.softCostRate);
  const L = info.bettermentLevy * config.taxation.bettermentLevyFactor;
  const m = config.developer.targetMarginOnRevenue;
  const purchaseTax = config.taxation.landPurchaseTaxRate;
  const price = config.market.developerRightsSaleScenario.pricePerOriginalSqm;
  const c = combinationPct;

  const safeDiv = (x: number, y: number) => (y > 0 ? x / y : 0);

  const combRevenue = (1 - c) * R * a;
  const combCost = R * build + c * R * d * vat + L;
  const combinationMargin = safeDiv(combRevenue - combCost, combRevenue);

  const landCost = A * price * (1 + purchaseTax);
  const fullRevenue = R * a;
  const landPurchaseMargin = safeDiv(fullRevenue - R * build - landCost, fullRevenue);

  const share = config.commercial.revenueShare;
  const revenueShareMargin = safeDiv(fullRevenue - share * R * gross - R * build - L, fullRevenue);

  const residualLand = (fullRevenue * (1 - m) - R * build) / (1 + purchaseTax);
  const residualLandValuePerSqm = Math.max(0, safeDiv(residualLand, A));

  const perRightLevy = safeDiv(L, R);
  const maxC = safeDiv(a * (1 - m) - build - perRightLevy, a * (1 - m) + d * vat);

  // Cash price that leaves the developer exactly as well off as the combination offer.
  const consistent = (c * R * a + c * R * d * vat + L) / (1 + purchaseTax);

  return {
    impliedCombinationValuePerSqm: safeDiv(c * R * gross, A),
    combinationEntitlementValue: c * R * gross,
    grossSaleValue: A * price,
    combinationMargin,
    landPurchaseMargin,
    maxCombinationAtTargetMargin: Math.max(0, Math.min(1, maxC)),
    residualLandValuePerSqm,
    revenueShareMargin,
    consistentCashPricePerSqm: safeDiv(consistent, A),
  };
}
