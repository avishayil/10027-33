/**
 * Indicative developer-side economics, per candidate, from the same two-sided ledger as the owner side.
 * Standalone per-owner P&L at today's prices (no financing, timing or project-wide allocation): a model warning
 * signal, not a statement about any real developer's profitability.
 *
 * Revenue (ex VAT): apartments the developer sells on the land it acquires, completion payments from the owner,
 * construction-services fees. Costs: building every unit on the land (direct cost + soft costs), VAT on
 * construction services delivered to the owner without cash consideration (combination), land paid for, revenue
 * share paid, fraction buy-backs, and every tax the ledger assigns to the developer (levy, grossed-up owner tax,
 * the developer's own purchase tax).
 */
import { lotDeveloperPnL, lotViablePct } from './lotDeveloper';
import { buildTransactionPlan } from './transactions';
import type { Candidate, CommercialTerms, DeveloperEconomics, DeveloperPnL, ProjectConfig, RightsInfo, TransactionPlan, UserProfile } from './types';
import { apartmentValueToday } from './valuation';

export function involvesDeveloper(candidate: Candidate): boolean {
  return candidate.legs.some(
    (l) => (l.kind === 'sell_rights' && l.market === 'developer') || l.kind === 'combination' || l.kind === 'revenue_share' || l.kind === 'build',
  );
}

export function candidatePnL(candidate: Candidate, plan: TransactionPlan, info: RightsInfo, config: ProjectConfig, _terms: CommercialTerms): DeveloperPnL | null {
  if (!involvesDeveloper(candidate)) return null;
  const vat = config.taxation.vatRate;
  const a = apartmentValueToday(config) / (1 + vat);
  const d = config.construction.apartmentSizeSqm * config.developer.directCostPerSqm;
  const build = d * (1 + config.developer.softCostRate);
  const sum = (pred: (e: TransactionPlan['ledger'][number]) => boolean) => plan.ledger.filter(pred).reduce((s, e) => s + e.amount, 0);

  const unitsBuilt = info.apartmentEquivalents + plan.rightsPurchased;
  const pooled = plan.fractionSettled?.mode === 'pool' ? plan.fractionSettled.share : 0;
  const ownerDelivered = plan.retainedApartmentEquivalents + plan.apartmentsSoldByOwner + pooled;
  const unitsSold = Math.max(0, unitsBuilt - ownerDelivered);

  const apartmentSales = unitsSold * a;
  const completionRevenue = sum((e) => e.category === 'completion_payment') / (1 + vat);
  const servicesRevenue = sum((e) => e.category === 'construction' && e.payer === 'owner') / (1 + vat);
  const constructionCost = unitsBuilt * build;
  // Output VAT on the barter services (services incl. contractor profit — the same amount as the owner-side
  // ledger). A developer cost only when it bears it; VAT the owner pays is collected and remitted.
  const barterVat = sum((e) => e.category === 'services_vat' && e.payer === 'developer');
  const landPaid = sum((e) => e.category === 'sale_proceeds' && e.direction === 'in');
  const revenueSharePaid = sum((e) => e.category === 'revenue_share' && e.direction === 'in');
  const buyBack = plan.fractionSettled?.mode === 'cash' ? sum((e) => e.category === 'fraction_settlement') : 0;
  // (S13 value-based allocation: the developer pays the excess value in cash or receives the gap as completion.)
  // Developer-borne services VAT is already counted in barterVat (on its own cost basis).
  const devTaxes = sum((e) => e.payer === 'developer' && e.category !== 'services_vat');
  // The lot's public-building obligation (appraisal: 325 m² × ₪8,000/m² shell incl. VAT), at the owner's lot share.
  const publicConstruction = info.table.lotShare * config.publicConstruction.sqmPerLot * config.publicConstruction.costPerSqm;

  const revenue = apartmentSales + completionRevenue + servicesRevenue;
  const costs = constructionCost + barterVat + landPaid + revenueSharePaid + buyBack + devTaxes + publicConstruction;
  const profit = revenue - costs;
  return {
    revenue,
    costs,
    profit,
    marginOnRevenue: revenue > 0 ? profit / revenue : 0,
    marginOnCost: costs > 0 ? profit / costs : 0,
    lines: [
      { label: 'מכירת דירות (ללא מע״מ)', amount: apartmentSales },
      { label: 'תשלומי השלמה מהבעלים', amount: completionRevenue },
      { label: 'שכר שירותי בנייה מהבעלים', amount: servicesRevenue },
      { label: 'עלות בנייה ועלויות רכות', amount: -constructionCost },
      { label: 'מע״מ על שירותי בנייה בקומבינציה', amount: -barterVat },
      { label: 'תשלום עבור קרקע', amount: -landPaid },
      { label: 'תמורות ששולמו לבעלים', amount: -revenueSharePaid },
      { label: 'פיצוי על חלק דירה', amount: -buyBack },
      { label: 'מסים שהיזם נושא בהם', amount: -devTaxes },
      { label: 'חלקכם במבני הציבור במגרש (שמאות עמ׳ 97)', amount: -publicConstruction },
    ].filter((l) => Math.abs(l.amount) > 0.5),
  };
}

function pnlFor(candidate: Candidate, info: RightsInfo, profile: UserProfile, terms: CommercialTerms, config: ProjectConfig): DeveloperPnL | null {
  return candidatePnL(candidate, buildTransactionPlan(candidate, { info, profile, terms, config }), info, config, terms);
}

const withPrice = (config: ProjectConfig, price: number): ProjectConfig => ({
  ...config,
  market: { ...config.market, developerRightsSaleScenario: { ...config.market.developerRightsSaleScenario, pricePerOriginalSqm: price } },
});

/** Summary figures for the developer panel, derived from candidate P&Ls (headline tax arrangement). */
export function developerEconomics(info: RightsInfo, config: ProjectConfig, combinationPct: number, profile: UserProfile = { landAreaSqm: info.landAreaSqm, availableCapital: 0, maxMonthlyRepayment: 0, goal: 'balanced' }): DeveloperEconomics {
  const R = info.apartmentEquivalents;
  const A = info.landAreaSqm;
  const terms: CommercialTerms = { combinationPct, developerMarkup: config.commercial.developerMarkup.default };
  const S01: Candidate = { id: 'S01', type: 'S01', targetApartments: 0, legs: [{ kind: 'sell_rights', rights: R, market: 'developer' }] };
  const S02: Candidate = { id: 'S02', type: 'S02', targetApartments: 0, legs: [{ kind: 'combination', rights: R }] };
  const S04: Candidate = { id: 'S04', type: 'S04', targetApartments: 0, legs: [{ kind: 'revenue_share', rights: R }] };
  const m = config.developer.targetMarginOnRevenue;
  const comb = pnlFor(S02, info, profile, terms, config);
  const land = pnlFor(S01, info, profile, terms, config);
  const rs = pnlFor(S04, info, profile, terms, config);
  const plan02 = buildTransactionPlan(S02, { info, profile, terms, config });
  const combinationTaxCost = plan02.ledger.filter((e) => e.payer === 'developer' && e.category === 'capital_gains_tax').reduce((s, e) => s + e.amount, 0);

  // Land purchase P&L is linear in the price: profit(p) = profit(0) − k·p.
  const p0 = pnlFor(S01, info, profile, terms, withPrice(config, 0))?.profit ?? 0;
  const p1 = pnlFor(S01, info, profile, terms, withPrice(config, 1000))?.profit ?? 0;
  const k = (p0 - p1) / 1000;
  const revenue0 = pnlFor(S01, info, profile, terms, withPrice(config, 0))?.revenue ?? 0;
  const residual = k > 0 ? Math.max(0, (p0 - m * revenue0) / k) : 0;
  const consistent = k > 0 ? Math.max(0, (p0 - (comb?.profit ?? 0)) / k) : 0;

  // Combination margin and the highest % at the target margin come from the lot-level P&L (financing and timing
  // included); the land-purchase and revenue-share figures stay per owner.
  const lotCtx = { info, profile, config };
  const lot = lotDeveloperPnL(lotCtx, config.commercial.taxArrangement, combinationPct);
  const maxC = lotViablePct(lotCtx, config.commercial.taxArrangement) ?? 0;

  return {
    impliedCombinationValuePerSqm: A > 0 ? (combinationPct * R * apartmentValueToday(config)) / A : 0,
    combinationEntitlementValue: combinationPct * R * apartmentValueToday(config),
    grossSaleValue: A * config.market.developerRightsSaleScenario.pricePerOriginalSqm,
    combinationMargin: lot.margin,
    landPurchaseMargin: land?.marginOnRevenue ?? 0,
    maxCombinationAtTargetMargin: maxC,
    residualLandValuePerSqm: A > 0 ? residual : 0,
    revenueShareMargin: rs?.marginOnRevenue ?? 0,
    combinationTaxCost,
    consistentCashPricePerSqm: A > 0 ? consistent : 0,
    lot: {
      units: lot.units,
      servicesUnits: lot.servicesUnits,
      developerUnits: lot.developerUnits,
      revenue: lot.revenue,
      costs: lot.costs,
      financingCost: lot.financingCost,
      profit: lot.profit,
      peakEquity: lot.peakEquity,
      peakLoan: lot.peakLoan,
      lines: lot.lines,
    },
  };
}
