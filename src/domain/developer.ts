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
import { buildTransactionPlan } from './transactions';
import type { Candidate, CommercialTerms, DeveloperEconomics, DeveloperPnL, ProjectConfig, RightsInfo, TransactionPlan, UserProfile } from './types';
import { apartmentValueToday } from './valuation';

export function involvesDeveloper(candidate: Candidate): boolean {
  return candidate.legs.some(
    (l) => (l.kind === 'sell_rights' && l.market === 'developer') || l.kind === 'combination' || l.kind === 'revenue_share' || l.kind === 'build',
  );
}

export function candidatePnL(candidate: Candidate, plan: TransactionPlan, info: RightsInfo, config: ProjectConfig, terms: CommercialTerms): DeveloperPnL | null {
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
  const barterVat = plan.rightsInCombination * terms.combinationPct * d * vat;
  const landPaid = sum((e) => e.category === 'sale_proceeds' && e.direction === 'in');
  const revenueSharePaid = sum((e) => e.category === 'revenue_share' && e.direction === 'in');
  const buyBack = plan.fractionSettled?.mode === 'cash' ? sum((e) => e.category === 'fraction_settlement') : 0;
  // (S13 value-based allocation: the developer pays the excess value in cash or receives the gap as completion.)
  const devTaxes = sum((e) => e.payer === 'developer');

  const revenue = apartmentSales + completionRevenue + servicesRevenue;
  const costs = constructionCost + barterVat + landPaid + revenueSharePaid + buyBack + devTaxes;
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

  // Highest combination % that still leaves the target margin (bracket scan + bisection; margin falls with c).
  const marginAt = (c: number) => pnlFor(S02, info, profile, { ...terms, combinationPct: c }, config)?.marginOnRevenue ?? -1;
  let maxC = 0;
  let prev = 0;
  for (let c = 0; c <= 0.8; c += 0.02) {
    if (marginAt(c) >= m) prev = c;
    else break;
  }
  let lo = prev;
  let hi = Math.min(0.8, prev + 0.02);
  if (marginAt(0) >= m) {
    for (let i = 0; i < 30; i += 1) {
      const mid = (lo + hi) / 2;
      if (marginAt(mid) >= m) lo = mid;
      else hi = mid;
    }
    maxC = lo;
  }

  return {
    impliedCombinationValuePerSqm: A > 0 ? (combinationPct * R * apartmentValueToday(config)) / A : 0,
    combinationEntitlementValue: combinationPct * R * apartmentValueToday(config),
    grossSaleValue: A * config.market.developerRightsSaleScenario.pricePerOriginalSqm,
    combinationMargin: comb?.marginOnRevenue ?? 0,
    landPurchaseMargin: land?.marginOnRevenue ?? 0,
    maxCombinationAtTargetMargin: maxC,
    residualLandValuePerSqm: A > 0 ? residual : 0,
    revenueShareMargin: rs?.marginOnRevenue ?? 0,
    combinationTaxCost,
    consistentCashPricePerSqm: A > 0 ? consistent : 0,
  };
}
