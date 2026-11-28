/**
 * Concession efficiency and feasibility explanations (iteration 10 / I6, review of c689d0b §F2, §F5).
 *
 * A concession is a change to the contract. Each one is the same route re-evaluated on both sides under the changed
 * contract (one snapshot each): the owner's gain is the change in the ranking value (PV, today's prices, real
 * discount rate) and the developer's cost is the change in the PV of its equity flows on the lot at the same rate —
 * compatible units. Efficiency = owner gain ÷ developer cost; with liquidity relief (less own capital needed) per
 * shekel of developer cost alongside. A timing concession can cost the developer less than paying a tax outright — it
 * is computed, not asserted. Only concessions under which the route can be carried out are compared. Efficiency is
 * not a profit or welfare guarantee: credit risk, financing cost and tax gross-up are in the model only as modelled.
 *
 * The feasibility explanation names what binds (financing gap, missing information, market evidence, the developer's
 * hurdle or policy, physical limits) and the concessions that, tested jointly on both sides, would make the route
 * work. When none does, it says that the tested set is bounded — not that no deal exists.
 */
import type { ProjectConfig, ReasonCode, TransactionPlan, UserProfile } from '../domain/types';
import { calculateRights } from '../domain/rights';
import { validateInputs } from '../domain/validation';
import { contractConfig, evaluateRoutes, snapshotForCandidate, type ContractSnapshot, type ContractTerms } from './contract';
import type { PlanTransform } from './evaluate';

export type ConcessionId = 'levy' | 'net_taxes' | 'interest' | 'plus_1pp' | 'payment_timing';

export interface ConcessionRow {
  id: ConcessionId;
  label: string;
  applicable: boolean;
  /** The contract after the concession (for payment timing: same terms, the owner's payments moved to delivery). */
  contract: ContractTerms;
  executable: boolean;
  /**
   * 'lot': a uniform contract term (every owner in the lot gets it) — developerCost is this owner's share of the
   * lot-wide cost and developerCostLot the whole; 'owner': granted to this owner only.
   */
  scope: 'lot' | 'owner';
  ownerGain: number | null;
  developerCost: number | null;
  developerCostLot: number | null;
  efficiency: number | null;
  /** Less own capital the owner needs (₪), and per ₪ of developer cost. */
  liquidityRelief: number | null;
  liquidityPerCost: number | null;
  /** Developer margin after the concession and whether it still reaches the hurdle. */
  developerMargin: number | null;
  developerOk: boolean;
  ownerAccepts: boolean;
  note: string | null;
}

export interface ConcessionFrontier {
  routeId: string;
  base: { ownerValue: number; developerNpv: number | null; margin: number | null; executable: boolean };
  rows: ConcessionRow[];
  /** Executable concessions not dominated on (owner gain ↑, developer cost ↓), best efficiency first. */
  frontier: ConcessionRow[];
}

/** Owner benefit per shekel of developer cost; null when it costs the developer nothing (or the developer gains). */
export function efficiency(ownerGain: number, developerCost: number): number | null {
  return developerCost > 1e-9 ? ownerGain / developerCost : null;
}

const hardOk = (s: ContractSnapshot) => s.result.assessment.affordability === 'fits' || s.result.assessment.affordability === 'fits_with_financing';

/** The owner's construction and completion payments before delivery moved to delivery (the developer carries them). */
export const deferOwnerPayments: PlanTransform = (plan: TransactionPlan) => {
  const E = plan.completionMonth;
  const moves = (e: { month: number; category: string }) => e.month < E && (e.category === 'construction' || e.category === 'completion_payment');
  return {
    ...plan,
    events: plan.events.map((e) => (moves(e) && e.amount < 0 ? { ...e, month: E } : e)).sort((a, b) => a.month - b.month),
    ledger: plan.ledger.map((e) => (moves(e) && e.payer === 'owner' && e.direction === 'out' ? { ...e, month: E } : e)).sort((a, b) => a.month - b.month),
  };
};

function snapshotOf(profile: UserProfile, k: ContractTerms, base: ProjectConfig, routeId: string, transform?: PlanTransform): ContractSnapshot | null {
  const peers = evaluateRoutes(profile, k, base);
  const r = peers.find((x) => x.id === routeId);
  return r ? snapshotForCandidate(profile, k, base, r.candidate, peers, transform) : null;
}

export function concessionFrontier(profile: UserProfile, k0: ContractTerms, base: ProjectConfig, routeId: string): ConcessionFrontier {
  const invalid = validateInputs(profile, { combinationPct: k0.combinationPct, developerMarkup: k0.markup }, contractConfig(base, k0));
  if (invalid.length) throw new Error(invalid.join(' '));
  const s0 = snapshotOf(profile, k0, base, routeId);
  if (!s0) throw new Error(`מסלול לא קיים בתנאים האלה: ${routeId}`);
  const npv = (s: ContractSnapshot) => s.result.developerLot?.equityNpv ?? null;
  const hurdle = base.developer.targetMarginOnRevenue;
  // This owner's share of the lot: a uniform term costs the developer this share of its lot-wide cost per owner.
  const share = Math.max(0, Math.min(1, calculateRights(profile.landAreaSqm, contractConfig(base, k0), profile.lotId).table.lotShare));
  const row = (
    id: ConcessionId,
    label: string,
    scope: 'lot' | 'owner',
    applicable: boolean,
    k1: ContractTerms,
    from: ContractSnapshot | null,
    transform?: PlanTransform,
    note: string | null = null,
  ): ConcessionRow => {
    const blank: ConcessionRow = {
      id,
      label,
      applicable,
      contract: k1,
      executable: false,
      scope,
      ownerGain: null,
      developerCost: null,
      developerCostLot: null,
      efficiency: null,
      liquidityRelief: null,
      liquidityPerCost: null,
      developerMargin: null,
      developerOk: false,
      ownerAccepts: false,
      note,
    };
    if (!applicable || !from) return blank;
    const s1 = snapshotOf(profile, k1, base, routeId, transform);
    if (!s1) return { ...blank, note: 'המסלול לא קיים בתנאים האלה' };
    const executable = hardOk(s1);
    const gain = s1.owner.value - from.owner.value;
    const n0 = npv(from);
    const n1 = npv(s1);
    const lotCost = n0 !== null && n1 !== null ? n0 - n1 : null;
    const cost = lotCost === null ? null : scope === 'lot' ? lotCost * share : lotCost;
    const relief = from.result.personalCapitalRequired - s1.result.personalCapitalRequired;
    return {
      ...blank,
      executable,
      ownerGain: gain,
      developerCost: cost,
      developerCostLot: scope === 'lot' ? lotCost : null,
      efficiency: cost === null ? null : efficiency(gain, cost),
      liquidityRelief: relief,
      liquidityPerCost: cost !== null && cost > 1e-9 ? relief / cost : null,
      developerMargin: s1.developer.margin,
      developerOk: s1.developer.margin !== null && s1.developer.margin >= hurdle - 1e-9,
      ownerAccepts: s1.owner.accepts,
    };
  };

  const rows: ConcessionRow[] = [];
  rows.push(row('levy', 'היזם משלם את היטל ההשבחה', 'lot', k0.arrangement === 'gross', { ...k0, arrangement: 'mixed' }, s0));
  rows.push(row('net_taxes', 'היזם משלם את כל המסים (עסקת נטו)', 'lot', k0.arrangement !== 'net', { ...k0, arrangement: 'net' }, s0));
  // Interest: against the same contract with the developer's tax loan, unsubsidised.
  const kLoan: ContractTerms = { ...k0, funding: 'developer_loan', offer: { ...k0.offer, developerPaysTaxLoanInterest: false } };
  const sLoan = snapshotOf(profile, kLoan, base, routeId);
  const usesLoan = !!sLoan && sLoan.result.simulation.taxLoanDrawn > 1;
  rows.push(
    row('interest', 'היזם נושא בריבית על הלוואת המסים', 'owner', usesLoan, { ...kLoan, offer: { ...kLoan.offer, developerPaysTaxLoanInterest: true } }, sLoan, undefined, usesLoan ? 'לעומת הלוואת מסים מהיזם בלי סבסוד' : 'המסלול לא משתמש בהלוואת מסים'),
  );
  rows.push(row('plus_1pp', 'עוד נקודת אחוז בקומבינציה', 'lot', k0.combinationPct + 0.01 <= 1, { ...k0, combinationPct: Math.round((k0.combinationPct + 0.01) * 1e6) / 1e6 }, s0));
  const pays = s0.result.ledger.some((e) => e.payer === 'owner' && e.direction === 'out' && e.month < s0.result.plan.completionMonth && (e.category === 'construction' || e.category === 'completion_payment'));
  rows.push(row('payment_timing', 'התשלומים שלכם ליזם נדחים למסירה', 'owner', pays, k0, s0, deferOwnerPayments, pays ? null : 'אין במסלול תשלומים ליזם לפני המסירה'));

  const comparable = rows.filter((r) => r.executable && r.ownerGain !== null && r.developerCost !== null);
  const frontier = comparable
    .filter((x) => !comparable.some((o) => o !== x && o.ownerGain! >= x.ownerGain! && o.developerCost! <= x.developerCost! && (o.ownerGain! > x.ownerGain! || o.developerCost! < x.developerCost!)))
    .sort((a, b) => (b.efficiency ?? Infinity) - (a.efficiency ?? Infinity));
  return {
    routeId,
    base: { ownerValue: s0.owner.value, developerNpv: npv(s0), margin: s0.developer.margin, executable: hardOk(s0) },
    rows,
    frontier,
  };
}

export type BindingKind = 'financing_gap' | 'missing_information' | 'market_evidence' | 'developer_hurdle' | 'developer_policy' | 'physical' | 'goal';

export interface FeasibilityExplanation {
  routeId: string;
  owner: { ok: boolean; reason: string | null };
  developer: { ok: boolean; margin: number | null; hurdle: number };
  binding: { kind: BindingKind; codes: string[] }[];
  /** Concessions that, re-evaluated on both sides, make the route executable and keep the developer at the hurdle. */
  closingConcessions: ConcessionRow[];
  /** Always false: only the listed concessions, one at a time, were tested. */
  complete: false;
  missingEvidence: string[];
}

const KIND: Partial<Record<ReasonCode, BindingKind>> = {
  NO_BORROWING_CAPACITY: 'financing_gap',
  REPAYMENT_EXCEEDED: 'financing_gap',
  LTV_EXCEEDED: 'financing_gap',
  UNFUNDED_OBLIGATION: 'financing_gap',
  TAX_LOAN_EXTENSION_NEEDED: 'financing_gap',
  CAPITAL_UNKNOWN: 'missing_information',
  IMMEDIATE_PRICE_UNKNOWN: 'missing_information',
  ADVERSE_FAILS: 'market_evidence',
  DEVELOPER_POLICY_WHOLE_FROM_COMBINATION: 'developer_policy',
  DEVELOPER_POLICY_PER_OWNER_CAP: 'developer_policy',
  NOT_ENOUGH_RIGHTS: 'physical',
  COMBINATION_BELOW_WHOLE_UNIT: 'physical',
  FRACTIONAL_UNIT: 'physical',
  FRACTION_UNRESOLVED: 'physical',
};

export function explainFeasibility(profile: UserProfile, k0: ContractTerms, base: ProjectConfig, routeId: string, frontier?: ConcessionFrontier): FeasibilityExplanation {
  const s0 = snapshotOf(profile, k0, base, routeId);
  if (!s0) throw new Error(`מסלול לא קיים בתנאים האלה: ${routeId}`);
  const byKind = new Map<BindingKind, Set<string>>();
  const add = (k: BindingKind, c: string) => (byKind.get(k) ?? byKind.set(k, new Set()).get(k)!).add(c);
  const fails = s0.result.scenarioResults.find((x) => x.scenarioId === 'base')?.fails ?? [];
  for (const c of [...fails, ...s0.owner.hard]) {
    const kind = KIND[c as ReasonCode];
    // Physical notes (a fraction left over) bind only when the route is otherwise not executable.
    if (kind && (kind !== 'physical' || !hardOk(s0))) add(kind, c);
  }
  if (s0.result.priceDependency) add('market_evidence', s0.result.priceDependency);
  if (s0.owner.reasonCode === 'inventory') add('market_evidence', 'INVENTORY_UNCONFIRMED');
  if (s0.owner.reasonCode === 'policy') add('developer_policy', 'SERVICES_POLICY');
  if (s0.owner.reasonCode === 'goal') add('goal', s0.owner.reason ?? 'GOAL');
  const devOk = s0.developer.margin !== null && s0.developer.margin >= base.developer.targetMarginOnRevenue - 1e-9;
  if (!devOk) add('developer_hurdle', 'BELOW_HURDLE');
  const f = frontier ?? concessionFrontier(profile, k0, base, routeId);
  const closing = s0.owner.accepts && devOk ? [] : f.rows.filter((r) => r.executable && r.ownerAccepts && r.developerOk);
  const missingEvidence = [
    'OUTSIDE_OPTION_UNKNOWN',
    'DEVELOPER_HURDLE_ASSUMED',
    ...Object.entries(base.evidence)
      .filter(([, v]) => v.status === 'hypothetical' || v.status === 'unknown')
      .map(([k]) => k),
  ];
  return {
    routeId,
    owner: { ok: s0.owner.accepts, reason: s0.owner.reason },
    developer: { ok: devOk, margin: s0.developer.margin, hurdle: base.developer.targetMarginOnRevenue },
    binding: [...byKind.entries()].map(([kind, codes]) => ({ kind, codes: [...codes] })),
    closingConcessions: closing,
    complete: false,
    missingEvidence,
  };
}
