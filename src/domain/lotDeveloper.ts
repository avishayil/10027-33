/**
 * Lot-level developer P&L, monthly, at today's prices (iteration 6, corrected in iteration 7).
 *
 * Three quantities are kept apart:
 *  - physical units — the lot's apartments (102 / 96 / 100): revenue and construction;
 *  - ownership shares — the allocation-table share of each holding (2353/100000 per 167 m² in lot 149): taxes;
 *  - simulation rights — the owner's 2.25 per 167 m²: used only to translate one user's route into the lot.
 *
 * The lot is built from a *typical* holding (167 m², unknown basis, template tax terms) so it never depends on one
 * user's personal tax position or offer. A user's own route enters as a delta — the typical slice for the user's
 * share is replaced by the user's route — and the financing is recomputed on the combined monthly flows.
 *
 * Lot: the services quota (or expected participation below it) is built as construction services; all other rights
 * go into combination at the offer's %. Revenue: the developer's units ex VAT (presales during construction, the rest
 * at delivery) and services fees at the selected markup. Costs: every unit (direct + soft), the lot's public
 * buildings, and the owners' taxes the developer bears under the terms, on their dates. Financing: developer equity
 * first, then an escort loan; receipts build a cash balance that funds later costs.
 * Indicative only — a model warning signal, not a statement about a real developer's profitability.
 */
import { getLot } from '../data/parcel33';
import { withArrangement } from './arrangements';
import { completionMonth, constructionQuotePerApartment, milestoneMonth, permitMonth } from './construction';
import { lotPolicy } from './policy';
import { calculateRights } from './rights';
import { buildTransactionPlan } from './transactions';
import type { Candidate, CommercialTerms, ProjectConfig, RightsInfo, TaxArrangement, TransactionPlan, UserProfile } from './types';
import { apartmentValueToday } from './valuation';

export interface LotContext {
  info: RightsInfo;
  profile: UserProfile;
  config: ProjectConfig;
}

export interface LotOptions {
  /** Construction-services markup charged to the services owners (default: the slider default). */
  markup?: number;
  /** Share of the services quota actually taken up (default: expected demand, capped at the quota). */
  participation?: number;
  /** A user's route as a change to the lot: monthly flows and its revenue / cost split. */
  delta?: RouteDelta | null;
}

export interface RouteDelta {
  flows: number[];
  revenue: number;
  costs: number;
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
  /** Profit / revenue (ex VAT). */
  margin: number;
  /** Profit / (costs + financing). */
  profitOnCost: number;
  peakEquity: number;
  peakLoan: number;
  lines: { label: string; amount: number }[];
}

// ---------------------------------------------------------------------------
// Financing with a carried-forward cash balance
// ---------------------------------------------------------------------------

export interface FinancingResult {
  financingCost: number;
  peakEquity: number;
  peakLoan: number;
  endingCash: number;
  endingLoan: number;
}

/**
 * Monthly financing of a flow series (+ receipts, − costs). Receipts first build cash that pays later costs; a
 * shortfall is met by developer equity (up to a share of total costs), then an escort loan that accrues interest
 * and is repaid from later cash. Conservation: endingCash − equity = Σ flows − financingCost − endingLoan.
 */
export function financeFlows(flows: number[], o: { equityShareOfCosts: number; totalCosts: number; monthlyRate: number }): FinancingResult {
  const equityCap = o.equityShareOfCosts * o.totalCosts;
  let cash = 0;
  let equity = 0;
  let loan = 0;
  let financingCost = 0;
  let peakLoan = 0;
  for (const x of flows) {
    if (loan > 0) {
      const i = loan * o.monthlyRate;
      loan += i;
      financingCost += i;
    }
    cash += x;
    if (cash < 0) {
      const fromEquity = Math.min(-cash, Math.max(0, equityCap - equity));
      equity += fromEquity;
      cash += fromEquity;
      if (cash < 0) {
        loan += -cash;
        cash = 0;
      }
    } else if (loan > 0) {
      const repay = Math.min(loan, cash);
      loan -= repay;
      cash -= repay;
    }
    peakLoan = Math.max(peakLoan, loan);
  }
  return { financingCost, peakEquity: equity, peakLoan, endingCash: cash, endingLoan: loan };
}

// ---------------------------------------------------------------------------
// The typical holding and the lot
// ---------------------------------------------------------------------------

/** A typical 167 m² holding in the user's lot: unknown basis (conservative), template terms, no personal offer. */
function typical(ctx: LotContext): { info: RightsInfo; profile: UserProfile; config: ProjectConfig } {
  const config: ProjectConfig = { ...ctx.config, commercial: { ...ctx.config.commercial, offer: { levyCap: null, developerPaysTaxLoanInterest: false } } };
  const info = calculateRights(config.rights.originalAreaSqm, config, ctx.info.lotId);
  const profile: UserProfile = { landAreaSqm: info.landAreaSqm, availableCapital: 0, maxMonthlyRepayment: 0, goal: 'balanced', lotId: ctx.info.lotId, acquisitionBasis: null };
  return { info, profile, config };
}

const fullCombination = (rights: number): Candidate => ({ id: 'S02', type: 'S02', targetApartments: 0, legs: [{ kind: 'combination', rights }] });

/** Developer-side payments (taxes, purchase tax, borne VAT) of one plan, with their months. */
function developerPayments(plan: TransactionPlan): { month: number; amount: number }[] {
  return plan.ledger.filter((e) => e.payer === 'developer' && e.direction === 'out').map((e) => ({ month: e.month, amount: e.amount }));
}

/** Number of typical holdings whose rights go into combination (by ownership share). */
export function typicalHoldingsInCombination(ctx: LotContext, servicesUnits: number): number {
  const lot = getLot(ctx.config.rights.tableVersion, ctx.info.lotId);
  return ((lot.units - servicesUnits) / lot.units) / lot.sharePer167;
}

class Flows {
  readonly values: number[];
  constructor(readonly H: number) {
    this.values = new Array<number>(H + 1).fill(0);
  }
  add(m: number, x: number) {
    this.values[Math.min(this.H, Math.max(0, Math.round(m)))] += x;
  }
  /** Spread evenly over months from+1 … to. */
  spread(from: number, to: number, total: number) {
    const n = Math.max(1, to - from);
    for (let m = from; m < from + n; m += 1) this.add(m + 1, total / n);
  }
}

function horizonOf(config: ProjectConfig, plan?: TransactionPlan): number {
  const last = plan ? plan.ledger.reduce((m, e) => Math.max(m, e.month), 0) : 0;
  return Math.max(completionMonth(config) + Math.max(0, config.timeline.settlementDelayMonths), last) + 1;
}

/** Revenue from developer units (ex VAT): a presale share over construction, the rest at delivery. */
function addUnitSales(f: Flows, config: ProjectConfig, units: number): number {
  const a = apartmentValueToday(config) / (1 + config.taxation.vatRate);
  const sales = units * a;
  f.spread(permitMonth(config), completionMonth(config), sales * config.developer.presaleShare);
  f.add(completionMonth(config), sales * (1 - config.developer.presaleShare));
  return sales;
}

/** Direct + soft cost of building `units` physical apartments. */
function addConstruction(f: Flows, config: ProjectConfig, units: number): { direct: number; soft: number } {
  const direct = units * config.construction.apartmentSizeSqm * config.developer.directCostPerSqm;
  const soft = direct * config.developer.softCostRate;
  f.spread(permitMonth(config), completionMonth(config), -direct);
  f.spread(0, completionMonth(config), -soft);
  return { direct, soft };
}

function expectedParticipation(ctx: LotContext): number {
  const policy = lotPolicy(ctx.info, ctx.config);
  const quota = ctx.config.developerPolicy.servicesCapShareOfLot * policy.lotUnits;
  if (quota <= 0) return 0;
  return Math.max(0, Math.min(1, policy.estimatedDemand / quota));
}

export function lotDeveloperPnL(ctx: LotContext, arrangement: TaxArrangement, c: number, opts: LotOptions = {}): LotPnL {
  const t = typical(ctx);
  const config = withArrangement(t.config, arrangement);
  const vat = config.taxation.vatRate;
  const lot = getLot(config.rights.tableVersion, ctx.info.lotId);
  const units = lot.units;
  const markup = opts.markup ?? config.commercial.developerMarkup.default;
  const participation = opts.participation ?? expectedParticipation(ctx);
  const servicesUnits = config.developerPolicy.servicesCapShareOfLot * units * participation;
  const combinationUnits = units - servicesUnits;
  const ownerCombinationUnits = c * combinationUnits;
  const developerUnits = combinationUnits - ownerCombinationUnits;
  const H = Math.max(horizonOf(config), opts.delta ? opts.delta.flows.length - 1 : 0);
  const f = new Flows(H);

  const sales = addUnitSales(f, config, developerUnits);
  const quoteExVat = constructionQuotePerApartment(config, markup) / (1 + vat);
  const servicesRevenue = servicesUnits * quoteExVat;
  for (const ms of config.construction.schedule) f.add(milestoneMonth(ms, config), servicesRevenue * ms.share);
  const { direct, soft } = addConstruction(f, config, units);
  const publicBuildings = config.publicConstruction.sqmPerLot * config.publicConstruction.costPerSqm;
  f.spread(permitMonth(config), completionMonth(config), -publicBuildings);

  // Owners' taxes the developer bears: a typical holding's, times the holdings in combination (ownership shares).
  const terms: CommercialTerms = { combinationPct: c, developerMarkup: markup };
  const holdingPlan = buildTransactionPlan(fullCombination(t.info.apartmentEquivalents), { info: t.info, profile: t.profile, terms, config });
  const holdings = typicalHoldingsInCombination(ctx, servicesUnits);
  let taxes = 0;
  for (const p of developerPayments(holdingPlan)) {
    f.add(p.month, -p.amount * holdings);
    taxes += p.amount * holdings;
  }

  let revenue = sales + servicesRevenue;
  let costs = direct + soft + publicBuildings + taxes;
  if (opts.delta) {
    opts.delta.flows.forEach((x, m) => f.add(m, x));
    revenue += opts.delta.revenue;
    costs += opts.delta.costs;
  }
  const fin = financeFlows(f.values, { equityShareOfCosts: config.developer.equityShare, totalCosts: costs, monthlyRate: config.developer.escortLoanRate / 12 });
  const profit = revenue - costs - fin.financingCost;
  return {
    units,
    servicesUnits,
    ownerCombinationUnits,
    developerUnits,
    revenue,
    costs,
    financingCost: fin.financingCost,
    profit,
    margin: revenue > 0 ? profit / revenue : 0,
    profitOnCost: costs + fin.financingCost > 0 ? profit / (costs + fin.financingCost) : 0,
    peakEquity: fin.peakEquity,
    peakLoan: fin.peakLoan,
    lines: [
      { label: 'מכירת דירות היזם (ללא מע״מ)', amount: sales },
      { label: 'שכר שירותי בנייה מהבעלים במכסה', amount: servicesRevenue },
      { label: 'בנייה ישירה של כל יחידות המגרש', amount: -direct },
      { label: 'עלויות רכות', amount: -soft },
      { label: 'מבני ציבור במגרש', amount: -publicBuildings },
      { label: 'מסים שהיזם נושא בהם (כולל מס רכישה)', amount: -taxes },
      ...(opts.delta ? [{ label: 'השינוי בגלל המסלול שלכם', amount: opts.delta.revenue - opts.delta.costs }] : []),
      { label: 'מימון (ליווי בנקאי)', amount: -fin.financingCost },
    ].filter((l) => Math.abs(l.amount) > 0.5),
  };
}

// ---------------------------------------------------------------------------
// A user's route as a delta to the lot
// ---------------------------------------------------------------------------

/**
 * The lot with this user on the route of `plan` instead of a typical full combination for the user's share. Physical units
 * are the user's simulation rights × (physical units per simulation right); purchased rights come from another
 * owner already in the lot, so they replace that owner's typical slice too — no new apartments.
 * `subsidy`: tax-loan interest the developer bears for this owner (from the owner's simulation).
 */
export function routeDelta(ctx: LotContext, plan: TransactionPlan, terms: CommercialTerms, subsidy = 0): RouteDelta {
  const config = ctx.config;
  const vat = config.taxation.vatRate;
  const lot = getLot(config.rights.tableVersion, ctx.info.lotId);
  const R = ctx.info.apartmentEquivalents;
  if (R <= 0) return { flows: [], revenue: 0, costs: 0 };
  const physicalPerRight = (ctx.info.table.lotShare * lot.units) / R;
  const rights = R + plan.rightsPurchased;
  const H = horizonOf(config, plan);
  const f = new Flows(H);
  let revenue = 0;
  let costs = 0;

  // − the typical full-combination slice for the same ownership share (the user's rights + purchased rights).
  const t = typical(ctx);
  const tConfig = withArrangement(t.config, config.commercial.taxArrangement);
  const scale = ((rights / R) * ctx.info.table.lotShare) / lot.sharePer167;
  const slicePhysical = lot.sharePer167 * lot.units * scale;
  {
    const g = new Flows(H);
    const sales = addUnitSales(g, tConfig, slicePhysical * (1 - terms.combinationPct));
    const build = addConstruction(g, tConfig, slicePhysical);
    const holdingPlan = buildTransactionPlan(fullCombination(t.info.apartmentEquivalents), { info: t.info, profile: t.profile, terms, config: tConfig });
    let taxes = 0;
    for (const p of developerPayments(holdingPlan)) {
      g.add(p.month, -p.amount * scale);
      taxes += p.amount * scale;
    }
    g.values.forEach((x, m) => f.add(m, -x));
    revenue -= sales;
    costs -= build.direct + build.soft + taxes;
  }

  // + the user's route.
  const pooled = plan.fractionSettled?.mode === 'pool' ? plan.fractionSettled.share : 0;
  const ownerDelivered = (plan.retainedApartmentEquivalents + plan.apartmentsSoldByOwner + pooled) * physicalPerRight;
  const unitsBuilt = rights * physicalPerRight;
  revenue += addUnitSales(f, config, Math.max(0, unitsBuilt - ownerDelivered));
  const build = addConstruction(f, config, unitsBuilt);
  costs += build.direct + build.soft;
  for (const e of plan.ledger) {
    const exVat = e.amount / (1 + vat);
    if (e.payer === 'developer' && e.direction === 'out') {
      f.add(e.month, -e.amount);
      costs += e.amount;
    } else if (e.payer === 'owner' && e.direction === 'out' && (e.category === 'completion_payment' || e.category === 'construction')) {
      f.add(e.month, exVat);
      revenue += exVat;
    } else if (e.direction === 'in' && (e.category === 'sale_proceeds' || e.category === 'revenue_share')) {
      f.add(e.month, -e.amount);
      costs += e.amount;
    } else if (e.direction === 'in' && e.category === 'fraction_settlement' && plan.fractionSettled?.mode === 'cash') {
      f.add(e.month, -e.amount);
      costs += e.amount;
    }
  }
  if (subsidy > 0) {
    f.add(completionMonth(config), -subsidy);
    costs += subsidy;
  }
  return { flows: f.values, revenue, costs };
}

// ---------------------------------------------------------------------------
// Thresholds, the 2-D matrix and the project
// ---------------------------------------------------------------------------

function bisect(f: (x: number) => number, lo: number, hi: number, target: number, increasing: boolean): number | null {
  const ok = (x: number) => (increasing ? f(x) >= target : f(x) >= target);
  if (increasing ? !ok(hi) : !ok(lo)) return null;
  if (increasing ? ok(lo) : ok(hi)) return increasing ? lo : hi;
  let a = lo;
  let b = hi;
  for (let i = 0; i < 50; i += 1) {
    const mid = (a + b) / 2;
    if (ok(mid) === increasing) b = mid;
    else a = mid;
  }
  return increasing ? b : a;
}

/** Highest combination % at which the lot still leaves the developer its target margin (null: not even at 0%). */
export function lotViablePct(ctx: LotContext, arrangement: TaxArrangement, opts: LotOptions = {}): number | null {
  const target = ctx.config.developer.targetMarginOnRevenue;
  return bisect((c) => lotDeveloperPnL(ctx, arrangement, c, opts).margin, 0, 0.8, target, false);
}

/** Viable % for each (developer direct cost, apartment price) pair — calculated thresholds, not market estimates. */
export function profitabilityMatrix(
  ctx: LotContext,
  arrangement: TaxArrangement,
  directCosts: number[],
  apartmentPrices: number[],
  opts: LotOptions = {},
): { directCosts: number[]; apartmentPrices: number[]; cells: (number | null)[][] } {
  const cells = directCosts.map((d) =>
    apartmentPrices.map((p) => {
      const config: ProjectConfig = {
        ...ctx.config,
        developer: { ...ctx.config.developer, directCostPerSqm: d },
        market: { ...ctx.config.market, apartmentValuePerSqm: p },
      };
      return lotViablePct({ ...ctx, config }, arrangement, opts);
    }),
  );
  return { directCosts, apartmentPrices, cells };
}

/**
 * At the offer's %: the highest developer direct cost and the lowest apartment price that still leave the target
 * margin (each with the other held at its assumption), and the target expressed as profit on cost.
 */
export function developerBreakEvens(ctx: LotContext, arrangement: TaxArrangement, c: number, opts: LotOptions = {}) {
  const target = ctx.config.developer.targetMarginOnRevenue;
  const withCost = (d: number): ProjectConfig => ({ ...ctx.config, developer: { ...ctx.config.developer, directCostPerSqm: d } });
  const withPrice = (p: number): ProjectConfig => ({ ...ctx.config, market: { ...ctx.config.market, apartmentValuePerSqm: p } });
  return {
    maxDirectCostPerSqm: bisect((d) => lotDeveloperPnL({ ...ctx, config: withCost(d) }, arrangement, c, opts).margin, 0, 40000, target, false),
    minApartmentPricePerSqm: bisect((p) => lotDeveloperPnL({ ...ctx, config: withPrice(p) }, arrangement, c, opts).margin, 5000, 100000, target, true),
    targetMarginOnRevenue: target,
    profitOnCostAtTarget: target / (1 - target),
  };
}

/** The three lots of the plan, each on the offer's terms. */
export function projectDeveloperPnL(ctx: LotContext, arrangement: TaxArrangement, c: number, opts: Omit<LotOptions, 'delta'> = {}) {
  const lots = ctx.config.rights.lotIds.map((id) => {
    const info = calculateRights(ctx.info.landAreaSqm, ctx.config, id);
    return { lotId: id, pnl: lotDeveloperPnL({ ...ctx, info }, arrangement, c, opts) };
  });
  const sum = (k: 'revenue' | 'costs' | 'financingCost' | 'profit' | 'units') => lots.reduce((s, l) => s + l.pnl[k], 0);
  const revenue = sum('revenue');
  const profit = sum('profit');
  return { lots, units: sum('units'), revenue, costs: sum('costs'), financingCost: sum('financingCost'), profit, margin: revenue > 0 ? profit / revenue : 0 };
}
