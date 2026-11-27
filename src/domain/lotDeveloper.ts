/**
 * Lot-level developer P&L (iteration 6), monthly, at today's prices. The whole lot on the offer's terms:
 *  - the services quota (policy share of the lot's units) is built as construction services paid by those owners;
 *  - every other right goes into combination at the offer's %: owners receive c, the developer sells the rest;
 *  - costs: building every unit (direct + soft), the lot's public buildings, and — on their dates — the owners' taxes
 *    the developer bears under the terms, its purchase tax and any barter VAT it bears (scaled per right from this
 *    owner's own ledger, i.e. as if every owner were like this one);
 *  - revenue: the developer's units ex VAT (a presale share over construction, the rest at delivery) and the
 *    services fees on the owners' payment schedule;
 *  - financing: developer equity first, then an escort loan on the drawn balance, repaid from revenue.
 * Indicative only — a model warning signal, not a statement about a real developer's profitability.
 */
import { getLot } from '../data/parcel33';
import { withArrangement } from './arrangements';
import { completionMonth, constructionQuotePerApartment, milestoneMonth, permitMonth } from './construction';
import { buildTransactionPlan } from './transactions';
import type { Candidate, CommercialTerms, ProjectConfig, RightsInfo, TaxArrangement, UserProfile } from './types';
import { apartmentValueToday } from './valuation';

export interface LotContext {
  info: RightsInfo;
  profile: UserProfile;
  config: ProjectConfig;
}

export interface LotPnL {
  units: number;
  servicesUnits: number;
  ownerCombinationUnits: number;
  developerUnits: number;
  revenue: number;
  /** Costs before financing. */
  costs: number;
  financingCost: number;
  profit: number;
  margin: number;
  peakEquity: number;
  peakLoan: number;
  lines: { label: string; amount: number }[];
}

/** The developer-side cost per right of this owner's full combination: taxes it bears, with their months. */
function developerTaxesPerRight(ctx: LotContext, arrangement: TaxArrangement, c: number): { month: number; amount: number }[] {
  const config = withArrangement(ctx.config, arrangement);
  const R = ctx.info.apartmentEquivalents;
  if (R <= 0) return [];
  const candidate: Candidate = { id: 'S02', type: 'S02', targetApartments: 0, legs: [{ kind: 'combination', rights: R }] };
  const terms: CommercialTerms = { combinationPct: c, developerMarkup: config.commercial.developerMarkup.default };
  const plan = buildTransactionPlan(candidate, { info: ctx.info, profile: ctx.profile, terms, config });
  return plan.ledger.filter((e) => e.payer === 'developer' && e.direction === 'out').map((e) => ({ month: e.month, amount: e.amount / R }));
}

export function lotDeveloperPnL(ctx: LotContext, arrangement: TaxArrangement, c: number): LotPnL {
  const config = withArrangement(ctx.config, arrangement);
  const vat = config.taxation.vatRate;
  const lot = getLot(config.rights.tableVersion, ctx.info.lotId);
  const units = lot.units;
  const servicesUnits = config.developerPolicy.servicesCapShareOfLot * units;
  const combinationRights = units - servicesUnits;
  const ownerCombinationUnits = c * combinationRights;
  const developerUnits = combinationRights - ownerCombinationUnits;
  const permit = permitMonth(config);
  const completion = completionMonth(config);
  const H = completion + 1;
  const flows = new Array<number>(H + 1).fill(0); // + revenue, − cost
  const add = (m: number, x: number) => {
    flows[Math.min(H, Math.max(0, Math.round(m)))] += x;
  };
  const spread = (from: number, to: number, total: number) => {
    const n = Math.max(1, to - from);
    for (let m = from; m < from + n; m += 1) add(m + 1, total / n);
  };

  // Revenue: developer units ex VAT — presales spread over construction, the rest at delivery.
  const a = apartmentValueToday(config) / (1 + vat);
  const sales = developerUnits * a;
  const presale = config.developer.presaleShare;
  spread(permit, completion, sales * presale);
  add(completion, sales * (1 - presale));
  // Services fees ex VAT on the owners' payment schedule (markup at the slider default).
  const quoteExVat = constructionQuotePerApartment(config, config.commercial.developerMarkup.default) / (1 + vat);
  const servicesRevenue = servicesUnits * quoteExVat;
  for (const ms of config.construction.schedule) add(milestoneMonth(ms, config), servicesRevenue * ms.share);

  // Costs: build every unit (direct + soft) over construction; public buildings; developer-borne taxes on their dates.
  const d = config.construction.apartmentSizeSqm * config.developer.directCostPerSqm;
  const direct = units * d;
  const soft = direct * config.developer.softCostRate;
  spread(permit, completion, -direct);
  spread(0, completion, -soft);
  const publicBuildings = config.publicConstruction.sqmPerLot * config.publicConstruction.costPerSqm;
  spread(permit, completion, -publicBuildings);
  let taxes = 0;
  for (const t of developerTaxesPerRight(ctx, arrangement, c)) {
    add(t.month, -t.amount * combinationRights);
    taxes += t.amount * combinationRights;
  }
  const costs = direct + soft + publicBuildings + taxes;
  const revenue = sales + servicesRevenue;

  // Financing: equity first (a share of total costs), then an escort loan; revenue repays the loan first.
  const equityCap = config.developer.equityShare * costs;
  const r = config.developer.escortLoanRate / 12;
  let equity = 0;
  let loan = 0;
  let peakLoan = 0;
  let financingCost = 0;
  for (let m = 0; m <= H; m += 1) {
    if (loan > 0) {
      const i = loan * r;
      loan += i;
      financingCost += i;
    }
    let x = flows[m];
    if (x < 0) {
      const fromEquity = Math.min(-x, Math.max(0, equityCap - equity));
      equity += fromEquity;
      x += fromEquity;
      loan += -x;
    } else if (x > 0) {
      loan -= Math.min(loan, x);
    }
    peakLoan = Math.max(peakLoan, loan);
  }
  const profit = revenue - costs - financingCost;
  return {
    units,
    servicesUnits,
    ownerCombinationUnits,
    developerUnits,
    revenue,
    costs,
    financingCost,
    profit,
    margin: revenue > 0 ? profit / revenue : 0,
    peakEquity: equity,
    peakLoan,
    lines: [
      { label: 'מכירת דירות היזם (ללא מע״מ)', amount: sales },
      { label: 'שכר שירותי בנייה מהבעלים במכסה', amount: servicesRevenue },
      { label: 'בנייה ישירה של כל יחידות המגרש', amount: -direct },
      { label: 'עלויות רכות', amount: -soft },
      { label: 'מבני ציבור במגרש', amount: -publicBuildings },
      { label: 'מסים שהיזם נושא בהם (כולל מס רכישה)', amount: -taxes },
      { label: 'מימון (ליווי בנקאי)', amount: -financingCost },
    ].filter((l) => Math.abs(l.amount) > 0.5),
  };
}

/** Highest combination % at which the lot still leaves the developer its target margin (null: not even at 0%). */
export function lotViablePct(ctx: LotContext, arrangement: TaxArrangement): number | null {
  const target = ctx.config.developer.targetMarginOnRevenue;
  const m = (c: number) => lotDeveloperPnL(ctx, arrangement, c).margin;
  if (m(0) < target) return null;
  let lo = 0;
  let hi = 0.8;
  if (m(hi) >= target) return hi;
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2;
    if (m(mid) >= target) lo = mid;
    else hi = mid;
  }
  return lo;
}
