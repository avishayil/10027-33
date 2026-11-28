/**
 * Iteration 10 (review of c689d0b, §A/§F): one executable contract, evaluated once, read by both sides.
 *
 * A contract is the commercial terms (combination %, tax arrangement, markup, offer overrides) plus the funding the
 * household relies on, applied to one route. `evaluateContract` runs the route once (all scenarios, the household's
 * ledger and cash flow, and the lot-level developer P&L with this route's delta, services slots and tax subsidy) and
 * returns a snapshot. The owner's view and the developer's view both come from that snapshot, so they always concern
 * exactly the same deal — never the household's best route against a generic developer baseline.
 */
import { withArrangement } from '../domain/arrangements';
import { simulateCashflow } from '../domain/cashflow';
import { calculateRights } from '../domain/rights';
import type { Candidate, CommercialTerms, ConsiderationReconciliation, Goal, InventoryClaim, PriceKnob, ProjectConfig, StrategyResult, TaxArrangement, UserProfile } from '../domain/types';
import { facilitiesOf, facilityEvents, ledgerEvents, type BilateralEvent, type FinancingFacility, type PartyId } from '../kernel/events';
import { KERNEL_VERSION, PACK_ID, SCHEMA_VERSION } from '../kernel/version';
import { buildResult } from './analyze';
import type { EngineContext, PlanTransform } from './evaluate';
import { generateStrategies } from './generate';
import { evaluateScenarios } from './scenarios';

export type ContractFunding = 'none' | 'developer_loan' | 'other_property';
export type ContractStatus = 'infeasible' | 'modeled_conditional' | 'terms_confirmed';
export type OwnerReason = 'unfunded' | 'missing_info' | 'price' | 'inventory' | 'policy' | 'goal';

export interface ContractTerms {
  arrangement: TaxArrangement;
  combinationPct: number;
  markup: number;
  offer: { levyCap: number | null; developerPaysTaxLoanInterest: boolean };
  funding: ContractFunding;
}

export interface ContractSnapshot {
  /** Shared economic contract versions (docs/ECONOMIC-CONTRACT.md). */
  schemaVersion: string;
  kernelVersion: string;
  packId: string;
  packVersion: string;
  /** The scenario the projections are read from (the base; the others are in result.scenarioResults). */
  scenarioId: 'base';
  /** Stable id of (lot, terms, funding, route) — the same id on both sides and in every branch. */
  id: string;
  /** Fingerprint of the household inputs, the whole configuration and the contract terms it was computed from. */
  inputHash: string;
  /** Parties that appear in the events (owner and developer always). */
  participants: PartyId[];
  /** Every transfer of the route (ledger) and of its financing, source → destination, liable vs payer. */
  events: BilateralEvent[];
  /** Financing facilities used, each reconciled to its terminal balance; all conditional on the lender. */
  facilities: FinancingFacility[];
  /** Physical and economic claims on the lot's inventory (owner, pool, unallocated). */
  inventoryClaims: InventoryClaim[];
  /** Evidence entries the route depends on (config.evidence keys and the allocation tables). */
  evidenceIds: string[];
  lotId: string;
  contract: ContractTerms;
  routeId: string;
  route: Candidate;
  owner: {
    value: number;
    transactionValue: number;
    accepts: boolean;
    /** Why the owner does not accept (hard constraint, evidence or goal), or null. */
    reason: string | null;
    reasonCode: OwnerReason | null;
    /** Hard constraints that fail (cash, repayment, collateral, missing information). */
    hard: string[];
    wholeApartments: number;
    borrowing: number;
  };
  developer: { margin: number | null; profit: number | null; hurdle: number; ok: boolean };
  consideration: ConsiderationReconciliation | null;
  /** Everything the result still depends on: lender, contract terms, evidence, outside options. */
  conditions: string[];
  status: ContractStatus;
  result: StrategyResult;
}

/** Stable fingerprint (FNV-1a over a key-sorted JSON). */
export function fingerprint(x: unknown): string {
  const stable = (v: unknown): unknown =>
    Array.isArray(v) ? v.map(stable) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, stable((v as Record<string, unknown>)[k])])) : v;
  const s = JSON.stringify(stable(x));
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** The configuration a contract runs on: arrangement, offer overrides and only the funding the contract names. */
export function contractConfig(base: ProjectConfig, k: ContractTerms): ProjectConfig {
  const cfg = withArrangement(base, k.arrangement);
  return {
    ...cfg,
    commercial: { ...cfg.commercial, offer: { ...k.offer } },
    financing: {
      ...cfg.financing,
      taxLoan: { ...cfg.financing.taxLoan, available: k.funding === 'developer_loan', considerAsAlternative: false },
      otherPropertyLoanAssumed: k.funding === 'other_property',
    },
  };
}

/** Routes whose outcome needs actual apartment inventory (a tier or a mix of sizes) — by capability, not by id. */
export function needsInventory(c: Candidate): boolean {
  return c.legs.some((l) => l.kind === 'tier_apartment' || l.kind === 'apartment_mix');
}

/** Every route of a contract, each evaluated once (owner and route-specific developer side together). */
export function evaluateRoutes(profile: UserProfile, k: ContractTerms, base: ProjectConfig): StrategyResult[] {
  const { info, terms, config, ctx } = contractContext(profile, k, base);
  return generateStrategies(info, terms, config).map((c) => buildResult(c, evaluateScenarios(c, ctx, config), ctx, config));
}

function contractContext(profile: UserProfile, k: ContractTerms, base: ProjectConfig) {
  const config = contractConfig(base, k);
  const info = calculateRights(profile.landAreaSqm, config, profile.lotId);
  const terms: CommercialTerms = { combinationPct: k.combinationPct, developerMarkup: k.markup };
  const ctx: EngineContext = { info, profile, terms };
  return { config, info, terms, ctx };
}

/** One explicit candidate (e.g. a route with a group-specific pool sale) on a contract; `peers` = the goal's reference set. */
export function snapshotForCandidate(
  profile: UserProfile,
  k: ContractTerms,
  base: ProjectConfig,
  candidate: Candidate,
  peers: StrategyResult[],
  transform?: PlanTransform,
): ContractSnapshot {
  const { config, ctx } = contractContext(profile, k, base);
  const r = buildResult(candidate, evaluateScenarios(candidate, ctx, config, transform), ctx, config);
  return toSnapshot(r, peers, profile, k, base, inputHashOf(profile, k, base));
}

/** The same simulation with its dated facility flows (re-run once from its stored input when they were not kept). */
function withFlows(sim: StrategyResult['simulation']): StrategyResult['simulation'] {
  return sim.input.recordFlows ? sim : simulateCashflow({ ...sim.input, recordFlows: true });
}

/** The canonical input fingerprint: household inputs, the whole configuration and the contract terms. */
export function inputHashOf(profile: UserProfile, k: ContractTerms, base: ProjectConfig): string {
  return fingerprint({ profile, config: configHash(base), contract: k });
}

// The configuration is large and immutable per object: hash it once per object.
const configHashes = new WeakMap<ProjectConfig, string>();
function configHash(c: ProjectConfig): string {
  let h = configHashes.get(c);
  if (h === undefined) {
    h = fingerprint(c);
    configHashes.set(c, h);
  }
  return h;
}

/** Evidence entries a route depends on: the price knobs of its legs and the official allocation tables. */
export function evidenceIdsOf(c: Candidate): string[] {
  const knobs = new Set<PriceKnob | 'allocation_tables_106b'>(['allocation_tables_106b']);
  for (const l of c.legs) {
    if (l.kind === 'sell_rights') knobs.add(l.market === 'developer' ? 'developer_price' : l.market === 'post_approval' ? 'post_approval_price' : 'immediate_price');
    if (l.kind === 'revenue_share') knobs.add('revenue_share');
    if (l.kind === 'buy_rights') knobs.add('complementary_price');
    if (l.kind === 'settle_fraction_cash') knobs.add('buyback_factor');
  }
  return [...knobs];
}

const hardOk = (r: StrategyResult) => r.assessment.affordability === 'fits' || r.assessment.affordability === 'fits_with_financing';

/**
 * Goal-specific acceptance on top of the hard constraints (review A2): the whole-apartment goal needs the most whole
 * apartments any fundable route reaches on these terms (not merely one); no-risk needs no borrowing; cash-soon needs
 * cash before the deadline; income needs a positive net income.
 */
export function goalReason(goal: Goal, r: StrategyResult, peers: StrategyResult[]): string | null {
  switch (goal) {
    case 'maximize_apartments': {
      const best = Math.max(0, ...peers.filter(hardOk).map((p) => p.metrics.wholeApartments));
      if (r.metrics.wholeApartments < Math.max(1, best)) return `פחות דירות שלמות מהאפשרי בתנאים האלה (${best})`;
      return null;
    }
    case 'minimize_risk':
      return r.simulation.totalDrawn > 1 ? 'דורש הלוואה' : null;
    case 'immediate_cash':
      return r.metrics.liquidity > 0 ? null : 'אין כסף עד המועד שהגדרתם';
    case 'passive_income':
      return r.metrics.sustainableMonthlyIncome > 0 ? null : 'אין הכנסה חודשית נטו';
    default:
      return null;
  }
}

/** Snapshots of every route of a contract, with acceptance on both sides and the status of the result. */
export function snapshotsFor(profile: UserProfile, k: ContractTerms, base: ProjectConfig): ContractSnapshot[] {
  const results = evaluateRoutes(profile, k, base);
  const inputHash = inputHashOf(profile, k, base);
  return results.map((r) => toSnapshot(r, results, profile, k, base, inputHash));
}

function toSnapshot(r: StrategyResult, results: StrategyResult[], profile: UserProfile, k: ContractTerms, base: ProjectConfig, inputHash: string): ContractSnapshot {
  const lotId = profile.lotId || base.rights.defaultLotId;
  const hurdle = base.developer.targetMarginOnRevenue;
  const baseFails = r.scenarioResults.find((s) => s.scenarioId === 'base')?.fails ?? [];
  const hard = [...new Set([...baseFails, ...r.reasonCodes.filter((c) => c === 'CAPITAL_UNKNOWN')])];
  let code: OwnerReason | null = null;
  let reason: string | null = null;
  if (!hardOk(r)) [code, reason] = r.assessment.affordability === 'unknown' ? ['missing_info', 'חסר מידע (הון / החזר)'] : ['unfunded', 'לא ניתן לממן'];
  else if (r.priceDependency) [code, reason] = ['price', 'תלוי במחיר שלא ידוע'];
  else if (needsInventory(r.candidate)) [code, reason] = ['inventory', 'תלוי במלאי דירות שלא אושר'];
  else if (r.assessment.commercial === 'negotiable') [code, reason] = ['policy', 'היזם לא צפוי להציע (מדיניות שירותי בנייה)'];
  else {
    reason = goalReason(profile.goal, r, results);
    code = reason ? 'goal' : null;
  }
  const margin = r.developerLot?.margin ?? r.developerMargin ?? null;
  const developerOk = margin !== null && margin >= hurdle - 1e-9;
  const conditions = [
    ...r.requiredConditions,
    // Neither side's outside option is known: the owner's no-agreement value (no current land price) and whether
    // the developer's hurdle is its actual requirement.
    'OUTSIDE_OPTION_UNKNOWN',
    'DEVELOPER_HURDLE_ASSUMED',
    ...(r.developerLot?.consideration.material ? ['CONSIDERATION_MISMATCH'] : []),
  ];
  const accepts = reason === null;
  const status: ContractStatus = !accepts || !developerOk ? 'infeasible' : conditions.length ? 'modeled_conditional' : 'terms_confirmed';
  // Events, parties and facilities are derived on first use (searches build thousands of snapshots and read few).
  let events: BilateralEvent[] | null = null;
  let participants: PartyId[] | null = null;
  let facilities: FinancingFacility[] | null = null;
  const eventsOf = () => (events ??= [...ledgerEvents(r.plan, r.candidate), ...facilityEvents(withFlows(r.simulation))]);
  return {
    schemaVersion: SCHEMA_VERSION,
    kernelVersion: KERNEL_VERSION,
    packId: PACK_ID,
    packVersion: base.version,
    scenarioId: 'base',
    get participants() {
      return (participants ??= [...new Set<PartyId>(['owner', 'developer', ...eventsOf().flatMap((e) => [e.source, e.destination])])]);
    },
    get events() {
      return eventsOf();
    },
    get facilities() {
      return (facilities ??= facilitiesOf(r.simulation, r.plan));
    },
    inventoryClaims: r.developerLot?.consideration.claims ?? [],
    evidenceIds: evidenceIdsOf(r.candidate),
    id: fingerprint({ lotId, contract: k, route: r.candidate }),
    inputHash,
    lotId,
    contract: k,
    routeId: r.id,
    route: r.candidate,
    owner: {
      value: r.comparisonValue,
      transactionValue: r.transactionValue,
      accepts,
      reason,
      reasonCode: code,
      hard,
      wholeApartments: r.metrics.wholeApartments,
      borrowing: r.simulation.totalDrawn,
    },
    developer: { margin, profit: r.developerLot?.profit ?? null, hurdle, ok: developerOk },
    consideration: r.developerLot?.consideration ?? null,
    conditions: [...new Set(conditions)],
    status,
    result: r,
  };
}
