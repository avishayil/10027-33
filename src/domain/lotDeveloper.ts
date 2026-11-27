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
import type {
  Candidate,
  CommercialTerms,
  ConsiderationReconciliation,
  ProjectConfig,
  RightsInfo,
  TaxArrangement,
  TransactionPlan,
  UserProfile,
} from './types';

export interface LotContext {
  info: RightsInfo;
  profile: UserProfile;
  config: ProjectConfig;
}

/**
 * The developer's direct construction budget for a lot: the plan's built areas (Table 5) priced at the appraisers'
 * survey — above ground at the tower rate (the lots are 20 floors, 72 m), underground at the underground rate,
 * balconies at a share of the main rate. Or an override per saleable m².
 */
export function developerBudget(config: ProjectConfig, lotId: string) {
  const lot = getLot(config.rights.tableVersion, lotId);
  const s = config.developer.survey;
  const saleable = lot.residentialArea;
  const aboveGround = lot.aboveGroundArea * s.aboveGroundPerSqm;
  const underground = lot.undergroundArea * s.undergroundPerSqm;
  const balconies = lot.balconyArea * s.aboveGroundPerSqm * s.balconyShare;
  const direct = config.developer.directCostPerSqm !== null ? config.developer.directCostPerSqm * saleable : aboveGround + underground + balconies;
  return {
    direct,
    perSaleableSqm: direct / saleable,
    saleableArea: saleable,
    buildingClass: lot.heightM > 29 ? ('tower' as const) : lot.heightM > 13 ? ('high' as const) : ('low' as const),
    lines: { aboveGround, underground, balconies },
  };
}

/** Direct cost per saleable m² for the lot (the budget, or the override). */
export function directCostPerSaleableSqm(config: ProjectConfig, lotId: string): number {
  return developerBudget(config, lotId).perSaleableSqm;
}

export interface LotOptions {
  /** Construction-services markup charged to the services owners (default: the slider default). */
  markup?: number;
  /** Share of the services quota actually taken up (default: expected demand, capped at the quota). */
  participation?: number;
  /** A user's route as a change to the lot: monthly flows and its revenue / cost split. */
  delta?: RouteDelta | null;
  /** Quota slots the user's route takes (whole slots — `serviceApartments(candidate)`), never a fraction. */
  userServicesUnits?: number;
}

export interface RouteDelta {
  consideration: ConsiderationReconciliation;
  flows: number[];
  revenue: number;
  costs: number;
  /** Physical apartments the user receives (whole apartments counted as units, a fraction as its share). */
  userPhysicalUnits: number;
}

export interface LotPnL {
  units: number;
  /** Saleable (door-to-door) residential area of the lot, m². */
  saleableArea: number;
  /** Physical apartments the user receives on the route (0 without a route). */
  userPhysicalUnits: number;
  servicesUnits: number;
  /** Typical services participants the user's slots displace into combination. */
  displacedParticipants: number;
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

/** Revenue from the developer's saleable area (ex VAT): a presale share over construction, the rest at delivery. */
function addAreaSales(f: Flows, config: ProjectConfig, area: number): number {
  const perSqm = config.market.apartmentValuePerSqm / (1 + config.taxation.vatRate);
  const sales = area * perSqm;
  f.spread(permitMonth(config), completionMonth(config), sales * config.developer.presaleShare);
  f.add(completionMonth(config), sales * (1 - config.developer.presaleShare));
  return sales;
}

/** Direct + soft cost of building `area` saleable m² (with their share of service, underground and balcony area). */
function addConstruction(f: Flows, config: ProjectConfig, lotId: string, area: number): { direct: number; soft: number } {
  const direct = area * directCostPerSaleableSqm(config, lotId);
  const soft = direct * config.developer.softCostRate;
  f.spread(permitMonth(config), completionMonth(config), -direct);
  f.spread(0, completionMonth(config), -soft);
  return { direct, soft };
}

/** The construction-services quota in whole apartment slots. */
export function quotaSlots(config: ProjectConfig, units: number): number {
  return Math.floor(config.developerPolicy.servicesCapShareOfLot * units + 1e-9);
}

/** Slots taken by typical participants and by the user, and the participants the user displaces into combination. */
export function quotaUse(config: ProjectConfig, units: number, participation: number, userSlots: number) {
  const quota = quotaSlots(config, units);
  const typicalWanted = Math.floor(quota * participation + 1e-9);
  const typical = Math.max(0, Math.min(typicalWanted, quota - userSlots));
  return { quota, typical, user: Math.min(userSlots, quota), displaced: typicalWanted - typical, free: quota - typical - Math.min(userSlots, quota) };
}

function expectedParticipation(ctx: LotContext): number {
  const policy = lotPolicy(ctx.info, ctx.config);
  const quota = quotaSlots(ctx.config, policy.lotUnits);
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
  const area = lot.residentialArea;
  const areaPerUnit = area / units;
  // Typical services participants, less the slots a user on construction services takes (never beyond the quota).
  // Whole slots (iteration 9 / F02): ⌊25% × 102⌋ = 25. Typical participants each take one slot; a user on construction
  // services takes whole slots too (a partial S11 apartment still takes one). When the quota is full, the participant the
  // user displaces moves into combination — the combination area (and its taxes) below grows by exactly that slot.
  const use = quotaUse(config, units, participation, opts.userServicesUnits ?? 0);
  const servicesUnits = use.typical;
  const combinationArea = area - servicesUnits * areaPerUnit;
  const ownerCombinationUnits = (c * combinationArea) / areaPerUnit;
  const developerUnits = ((1 - c) * combinationArea) / areaPerUnit;
  const H = Math.max(horizonOf(config), opts.delta ? opts.delta.flows.length - 1 : 0);
  const f = new Flows(H);

  const sales = addAreaSales(f, config, (1 - c) * combinationArea);
  // Services owners pay the owners' price per m² (₪11,000 × (1 + markup)) for their apartment's area.
  const quoteExVat = (constructionQuotePerApartment(config, markup) / (1 + vat)) * (areaPerUnit / config.construction.apartmentSizeSqm);
  const servicesRevenue = servicesUnits * quoteExVat;
  for (const ms of config.construction.schedule) f.add(milestoneMonth(ms, config), servicesRevenue * ms.share);
  const { direct, soft } = addConstruction(f, config, ctx.info.lotId, area);
  const publicBuildings = config.publicConstruction.sqmPerLot * config.publicConstruction.costPerSqm;
  f.spread(permitMonth(config), completionMonth(config), -publicBuildings);

  // Owners' taxes the developer bears: a typical holding's, times the holdings in combination (ownership shares).
  const terms: CommercialTerms = { combinationPct: c, developerMarkup: markup };
  const holdingPlan = buildTransactionPlan(fullCombination(t.info.apartmentEquivalents), { info: t.info, profile: t.profile, terms, config });
  const holdings = (combinationArea / area) / lot.sharePer167;
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
    saleableArea: area,
    userPhysicalUnits: opts.delta?.userPhysicalUnits ?? 0,
    servicesUnits,
    displacedParticipants: use.displaced,
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
  const consideration = considerationReconciliation(ctx, plan);
  if (R <= 0) return { consideration, flows: [], revenue: 0, costs: 0, userPhysicalUnits: 0 };
  // Saleable area per simulation right of this owner (ownership share × the lot's saleable area).
  const areaPerRight = officialAreaPerRight(ctx);
  const rights = R + plan.rightsPurchased;
  const H = horizonOf(config, plan);
  const f = new Flows(H);
  let revenue = 0;
  let costs = 0;

  // − the typical full-combination slice for the same ownership share (the user's rights + purchased rights).
  const t = typical(ctx);
  const tConfig = withArrangement(t.config, config.commercial.taxArrangement);
  const scale = ((rights / R) * ctx.info.table.lotShare) / lot.sharePer167;
  const sliceArea = lot.sharePer167 * lot.residentialArea * scale;
  {
    const g = new Flows(H);
    const sales = addAreaSales(g, tConfig, sliceArea * (1 - terms.combinationPct));
    const build = addConstruction(g, tConfig, ctx.info.lotId, sliceArea);
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

  // + the user's route. The lot's unit mix is fixed, so the developer gives up the market value of what it delivers
  // (in area-equivalents of value); the physical count is tracked separately.
  const deliveredArea = consideration.officialAreaSqm;
  const rightsArea = rights * areaPerRight;
  revenue += addAreaSales(f, config, Math.max(0, rightsArea - deliveredArea));
  const build = addConstruction(f, config, ctx.info.lotId, rightsArea);
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
  const userPhysicalUnits = plan.wholeApartmentsRetained + plan.apartmentsSoldByOwner + plan.fractionalShare;
  return { consideration, flows: f.values, revenue, costs, userPhysicalUnits };
}

/** Official saleable area per simulation right: the holding's ownership share of the lot's saleable area ÷ its rights. */
export function officialAreaPerRight(ctx: LotContext): number {
  const lot = getLot(ctx.config.rights.tableVersion, ctx.info.lotId);
  const R = ctx.info.apartmentEquivalents;
  return R > 0 ? (ctx.info.table.lotShare * lot.residentialArea) / R : 0;
}

/**
 * What the owner receives and what the developer gives up for it, on one basis (gross, today's prices). The developer
 * gives up the official area; the owner model credits the standard area; the difference is shown, never dropped.
 */
export function considerationReconciliation(ctx: LotContext, plan: TransactionPlan): ConsiderationReconciliation {
  const config = ctx.config;
  const pooled = plan.fractionSettled?.mode === 'pool' ? plan.fractionSettled.share : 0;
  const eq = plan.retainedApartmentEquivalents + plan.apartmentsSoldByOwner + pooled;
  const perSqm = config.market.apartmentValuePerSqm;
  const standardAreaSqm = eq * config.construction.apartmentSizeSqm;
  const officialAreaSqm = eq * officialAreaPerRight(ctx);
  return {
    apartmentEquivalents: eq,
    standardAreaSqm,
    officialAreaSqm,
    unallocatedAreaSqm: officialAreaSqm - standardAreaSqm,
    ownerValue: standardAreaSqm * perSqm,
    developerForgoneValue: officialAreaSqm * perSqm,
    unallocatedValue: (officialAreaSqm - standardAreaSqm) * perSqm,
  };
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
