/**
 * Stage-contingent contracts without probabilities (iteration 10 / I5, review of c689d0b §C).
 *
 * Three states the household cannot know at signing: the plan is approved and the financing the contract relies on is
 * confirmed; it is approved but no financing is available (no mortgage, no loan on another property, no tax loan); it
 * is never approved. Every row is an explicit contract (its own terms, funding and route), evaluated in each state:
 *  - a fixed contract is carried out as written or not at all — no implicit fallback. A state where it cannot be
 *    carried out is "not executable" (default / cancellation), never silently replaced by the combination;
 *  - an option contract states its terms: plain combination now (the agreed fallback), an option to switch to route X
 *    at the exercise date (approval) only if financing is confirmed, fee unknown. Up to the exercise date it is the
 *    fallback contract (common prefix — the same events in every state); X's obligations from before the exercise date
 *    become due at it, never retroactively. Both sides are recomputed on the switched plan;
 *  - financed branch: only the facilities the contract names (a mortgage within the household's repayment, and the
 *    tax loan / other-property loan only when the contract includes it); no-financing branch: none at all. Unknown
 *    capital is never executable.
 * Utilities are values to the owner relative to the same reference (keeping the land, no deal): approved states use
 * the ranking value; no approval uses minus the maximum modelled loss. Regret over all three states; minimax.
 */
import { calculateRights } from '../domain/rights';
import type { Candidate, CommercialTerms, DecisionResult, ProjectConfig, StrategyResult, TransactionPlan, UserProfile } from '../domain/types';
import { approvalMonthOf, buildTransactionPlan } from '../domain/transactions';
import { buildResult } from './analyze';
import { contractConfig, fingerprint, needsInventory, type ContractTerms } from './contract';
import type { EngineContext, PlanTransform } from './evaluate';
import { evaluateScenarios } from './scenarios';

export type ContractState = 'financed' | 'no_financing' | 'no_approval';
export const STATES: ContractState[] = ['financed', 'no_financing', 'no_approval'];
export type Facility = 'mortgage' | 'tax_loan' | 'other_property';

export interface StateOutcome {
  /** Utility to the owner in this state; null = the contract cannot be carried out here. */
  value: number | null;
  executable: boolean;
  /** Why it cannot be carried out (hard constraints / missing information), or null. */
  reason: string | null;
  /** Facilities enabled in this branch for this contract. */
  facilities: Facility[];
  /** Lot-level developer profit in this state (approved states only). */
  developerProfit: number | null;
  /** For option rows in the financed state: whether the option is exercised. */
  exercised?: boolean;
}

export interface OptionTerms {
  targetRouteId: string;
  targetContract: ContractTerms;
  fallbackRouteId: string;
  /** Exercise at plan approval (month, base timeline). */
  exerciseMonth: number;
  condition: 'financing_confirmed';
  /** Not known — not invented. */
  fee: null;
  /** What the option is worth to the owner (gain if financed) and what it costs the developer, same states. */
  premium: { ownerMax: number | null; developerMin: number | null; agreeable: boolean | null };
}

export interface ContingentRow {
  id: string;
  kind: 'fixed' | 'option';
  label: string;
  routeId: string;
  contract: ContractTerms;
  /** A conditional direction (another arrangement or a funding facility), not the current terms. */
  conditional: boolean;
  option: OptionTerms | null;
  states: Record<ContractState, StateOutcome>;
  regret: Record<ContractState, number | null>;
  /** Largest regret over all three states (Infinity when this contract fails where another works). */
  maxRegret: number;
}

export interface ContingentResult {
  rows: ContingentRow[];
  /** The explicit fallback of the option rows (plain combination), null when not available. */
  fallbackId: string | null;
  exerciseMonth: number;
}

/**
 * Regret of each row in each state = best utility in that state − its own; a row that cannot be carried out where
 * another can → Infinity; a state where nothing can be carried out costs every row the same (0). Pure (review C4).
 */
export function minimaxRegret(utilities: (number | null)[][]): { regrets: (number | null)[][]; maxRegret: number[] } {
  const n = utilities[0]?.length ?? 0;
  const best = Array.from({ length: n }, (_, s) => {
    const ok = utilities.map((u) => u[s]).filter((x): x is number => x !== null);
    return ok.length ? Math.max(...ok) : null;
  });
  const regrets = utilities.map((u) => u.map((x, s) => (best[s] === null ? 0 : x === null ? null : best[s]! - x)));
  const maxRegret = regrets.map((r) => Math.max(0, ...r.map((x) => (x === null ? Infinity : x))));
  return { regrets, maxRegret };
}

type Timed = { month: number; amount: number; category: string; payer?: string; direction?: string };
/**
 * The switched plan at exercise month E: the fallback's events before E (the common prefix, already paid), X's events
 * from E on, and X's own events from before E moved to E (they could not have been paid earlier). An event both
 * contracts have before E (same category, payer, direction and amount) is paid once, at its date.
 */
export function shiftBeforeExercise(x: TransactionPlan, prefix: TransactionPlan, E: number): TransactionPlan {
  const merge = <T extends Timed>(xs: T[], ps: T[]): T[] => {
    const pre = ps.filter((e) => e.month < E);
    const used = new Set<number>();
    const out: T[] = [];
    for (const e of xs) {
      if (e.month >= E) {
        out.push(e);
        continue;
      }
      const j = pre.findIndex((p, k) => !used.has(k) && p.month === e.month && p.category === e.category && p.payer === e.payer && p.direction === e.direction && Math.abs(p.amount - e.amount) < 1);
      if (j >= 0) {
        used.add(j);
        out.push(e);
      } else out.push({ ...e, month: E });
    }
    pre.forEach((p, k) => !used.has(k) && out.push(p));
    return out.sort((a, b) => a.month - b.month);
  };
  return { ...x, events: merge(x.events, prefix.events), ledger: merge(x.ledger, prefix.ledger) };
}

const hardOk = (r: StrategyResult) => r.assessment.affordability === 'fits' || r.assessment.affordability === 'fits_with_financing';

function facilitiesOf(profile: UserProfile, k: ContractTerms): Facility[] {
  const out: Facility[] = [];
  if (profile.maxMonthlyRepayment !== 0) out.push('mortgage');
  if (k.funding === 'developer_loan') out.push('tax_loan');
  if (k.funding === 'other_property' || (profile.soleHome === false && typeof profile.otherPropertyBorrowingLimit === 'number' && profile.otherPropertyBorrowingLimit > 0))
    out.push('other_property');
  return out;
}

function run(profile: UserProfile, k: ContractTerms, base: ProjectConfig, candidate: Candidate, transform?: PlanTransform): StrategyResult {
  const config = contractConfig(base, k);
  const info = calculateRights(profile.landAreaSqm, config, profile.lotId);
  const terms: CommercialTerms = { combinationPct: k.combinationPct, developerMarkup: k.markup };
  const ctx: EngineContext = { info, profile, terms };
  return buildResult(candidate, evaluateScenarios(candidate, ctx, config, transform), ctx, config);
}

function outcome(r: StrategyResult, facilities: Facility[]): StateOutcome {
  const ok = hardOk(r);
  return {
    value: ok ? r.comparisonValue : null,
    executable: ok,
    reason: ok ? null : r.assessment.affordability === 'unknown' ? 'חסר מידע (הון / החזר)' : 'לא ניתן לממן',
    facilities,
    developerProfit: r.developerLot?.profit ?? null,
  };
}

const noFinancingProfile = (p: UserProfile): UserProfile => ({ ...p, maxMonthlyRepayment: 0, otherPropertyBorrowingLimit: 0 });

/** A fixed contract in the three states. */
function fixedStates(profile: UserProfile, k: ContractTerms, base: ProjectConfig, c: Candidate): { states: Record<ContractState, StateOutcome>; financed: StrategyResult } {
  const financed = run(profile, k, base, c);
  const nf = noFinancingProfile(profile);
  const noFin = run(nf, { ...k, funding: 'none' }, base, c);
  return {
    financed,
    states: {
      financed: outcome(financed, facilitiesOf(profile, k)),
      no_financing: outcome(noFin, []),
      no_approval: { value: -financed.noApproval.unprotected, executable: true, reason: null, facilities: [], developerProfit: null },
    },
  };
}

export function contingentPlan(result: DecisionResult, profile: UserProfile, terms: CommercialTerms, config: ProjectConfig): ContingentResult {
  const baseK: ContractTerms = {
    arrangement: config.commercial.taxArrangement,
    combinationPct: terms.combinationPct,
    markup: terms.developerMarkup,
    offer: config.commercial.offer,
    funding: 'none',
  };
  const E = approvalMonthOf(config);
  // Contracts shown: the recommendation, the alternatives and the conditional direction under its own terms. Renting
  // out (S14) is a use of the same apartments; price- and inventory-dependent routes are hypothetical — left out.
  const usable = (r: StrategyResult | null | undefined): r is StrategyResult => !!r && r.strategyType !== 'S14' && !r.priceDependency && !needsInventory(r.candidate);
  const entries: { r: StrategyResult; k: ContractTerms; conditional: boolean }[] = [];
  for (const r of [result.recommendation, ...result.alternatives].filter(usable)) entries.push({ r, k: baseK, conditional: false });
  const cond = result.conditionalRecommendation;
  if (cond && usable(cond.result)) {
    const k: ContractTerms =
      cond.kind === 'funding'
        ? { ...baseK, arrangement: cond.arrangement, combinationPct: cond.combinationPct, funding: cond.method ?? 'none' }
        : { ...baseK, arrangement: cond.arrangement, combinationPct: cond.combinationPct };
    entries.push({ r: cond.result, k, conditional: true });
  }
  // The explicit fallback of option contracts: the plain full combination on the current terms.
  const fallback = result.results.find((r) => r.id === 'S02') ?? null;
  if (fallback && !entries.some((e) => e.r.id === 'S02' && !e.conditional)) entries.unshift({ r: fallback, k: baseK, conditional: false });

  const rows: ContingentRow[] = [];
  const seen = new Set<string>();
  const blank = { financed: null, no_financing: null, no_approval: null };
  const fixed = new Map<string, { states: Record<ContractState, StateOutcome>; financed: StrategyResult; k: ContractTerms; c: Candidate }>();
  for (const { r, k, conditional } of entries) {
    const id = fingerprint({ k, route: r.candidate });
    if (seen.has(id)) continue;
    seen.add(id);
    const f = fixedStates(profile, k, config, r.candidate);
    fixed.set(id, { ...f, k, c: r.candidate });
    rows.push({ id, kind: 'fixed', label: r.id, routeId: r.id, contract: k, conditional, option: null, states: f.states, regret: { ...blank }, maxRegret: Infinity });
  }

  const fbId = fallback ? fingerprint({ k: baseK, route: fallback.candidate }) : null;
  const fb = fbId ? fixed.get(fbId) ?? null : null;
  if (fallback && fb) {
    for (const [id, x] of fixed) {
      // An option switches the route (and, if the contract names one, the funding facility) — not the tax arrangement
      // or the combination %, which are the same deal terms before and after the exercise date.
      if (id === fbId || !x.states.financed.executable) continue;
      if (x.k.arrangement !== baseK.arrangement || Math.abs(x.k.combinationPct - baseK.combinationPct) > 1e-9) continue;
      // Switched at E: the fallback's prefix (in each scenario's own timeline), then X.
      const transform: PlanTransform = (plan, cfg) => {
        const prefix = buildTransactionPlan(fallback.candidate, {
          info: calculateRights(profile.landAreaSqm, cfg, profile.lotId),
          profile,
          terms: { combinationPct: baseK.combinationPct, developerMarkup: baseK.markup },
          config: contractConfig(cfg, baseK),
        });
        return shiftBeforeExercise(plan, prefix, approvalMonthOf(cfg));
      };
      const switched = run(profile, x.k, config, x.c, transform);
      const sw = outcome(switched, facilitiesOf(profile, x.k));
      const fbF = fb.states.financed;
      // Exercised only when it can be carried out and beats staying with the fallback.
      const exercise = sw.executable && (fbF.value === null || sw.value! > fbF.value);
      const financed: StateOutcome = exercise ? { ...sw, exercised: true } : { ...fbF, exercised: false };
      const ownerMax = exercise ? (fbF.value === null ? null : Math.max(0, sw.value! - fbF.value)) : 0;
      const developerMin = exercise && fbF.developerProfit !== null && sw.developerProfit !== null ? Math.max(0, fbF.developerProfit - sw.developerProfit) : null;
      const optId = fingerprint({ fallback: fbId, target: id, E });
      if (seen.has(optId)) continue;
      seen.add(optId);
      rows.push({
        id: optId,
        kind: 'option',
        label: `${fallback.id}→${x.c.id}`,
        routeId: fallback.id,
        contract: baseK,
        conditional: x.k !== baseK,
        option: {
          targetRouteId: x.c.id,
          targetContract: x.k,
          fallbackRouteId: fallback.id,
          exerciseMonth: E,
          condition: 'financing_confirmed',
          fee: null,
          premium: { ownerMax, developerMin, agreeable: ownerMax !== null && developerMin !== null ? developerMin <= ownerMax : null },
        },
        states: { financed, no_financing: fb.states.no_financing, no_approval: fb.states.no_approval },
        regret: { ...blank },
        maxRegret: Infinity,
      });
    }
  }

  const { regrets, maxRegret } = minimaxRegret(rows.map((r) => STATES.map((s) => r.states[s].value)));
  rows.forEach((r, i) => {
    STATES.forEach((s, j) => (r.regret[s] = regrets[i][j]));
    r.maxRegret = maxRegret[i];
  });
  rows.sort((a, b) => a.maxRegret - b.maxRegret);
  return { rows, fallbackId: fallback?.id ?? null, exerciseMonth: E };
}
