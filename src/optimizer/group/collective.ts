/**
 * Collective allocation for an anonymous group of owners in one lot (iteration 10 / I4, review of c689d0b §B).
 *
 * One common contract for the whole group (the selected tax arrangement, combination %, markup and offer terms, and
 * one funding facility offered to all) — options from different arrangements or individual loans are never summed.
 * Every option is a contract snapshot (`snapshotsFor`) with its id; policy-blocked, price-dependent and
 * inventory-dependent routes are not options at all.
 *
 * Shared resources, conserved:
 *  - construction-services slots: whole slots, at most the slots the user says are free (validated ≤ the lot quota);
 *  - the balancing pool: shares S pooled → ⌊S⌋ whole units sold; each pooled owner is credited only their pro-rata part
 *    of those units' proceeds (units ÷ S of their share) and keeps the rest as an illiquid fractional share. Pooled
 *    owners are re-evaluated with that sale (taxes, cash flow and financing recomputed), never credited the full share.
 *
 * Objective, lexicographic: fewest owners left without an option (their outside option — no agreement — has no known
 * value), then everyone at or above their own reservation (the best option that needs no shared resource), then most
 * owners on their first choice, then the total value. The developer side is one P&L for the lot with all the group's
 * routes together (deltas summed against the same typical-lot baseline, slots summed). The search is a bounded
 * branch-and-bound over at most MAX_OPTIONS options (+ the reservation option) per owner, and says so.
 * Inputs are typed by the user, never inferred from the allocation table, never stored.
 */
import { PROJECT_CONFIG } from '../../data/config';
import { getLot } from '../../data/parcel33';
import { lotDeveloperPnL, quotaSlots, routeDelta, type RouteDelta } from '../../domain/lotDeveloper';
import { serviceApartments } from '../../domain/policy';
import { calculateRights } from '../../domain/rights';
import type { Candidate, CommercialTerms, Goal, ProjectConfig, StrategyResult, TaxArrangement, UserProfile } from '../../domain/types';
import { maxAreaInLot, validateInputs } from '../../domain/validation';
import { completionMonth as completionMonthOf } from '../../domain/construction';
import { apartmentValueAt } from '../../domain/valuation';
import { contractConfig, snapshotForCandidate, snapshotsFor, type ContractFunding, type ContractSnapshot, type ContractTerms } from '../contract';

export interface GroupMember {
  label: string;
  landAreaSqm: number;
  availableCapital: number | null;
  maxMonthlyRepayment: number | null;
  goal: Goal;
}

/** The group's common setting: the lot (from the user's own selection), free slots after outside commitments, the terms. */
export interface GroupContext {
  lotId: string;
  members: GroupMember[];
  slotsAvailable: number;
  terms: CommercialTerms;
  offer: ContractTerms['offer'];
  arrangement: TaxArrangement;
}

export interface MemberOption {
  contractId: string;
  routeId: string;
  title: string;
  /** Preference order among this owner's accepted options under the common contract (0 = first choice). */
  rank: number;
  value: number;
  wholeApartments: number;
  slots: number;
  poolShare: number;
  conditions: string[];
  snapshot: ContractSnapshot;
}

export type MemberStatus = 'at_or_above_reservation' | 'no_reservation_option' | 'outside_option';

export interface MemberPlan {
  member: GroupMember;
  options: MemberOption[];
  /** The best option that needs no shared resource (the reservation); null if the owner has none. */
  reservation: MemberOption | null;
  chosen: MemberOption | null;
  /** The chosen option re-evaluated with the group's pool sale (its own contract id), and its value. */
  chosenSnapshot: ContractSnapshot | null;
  chosenValue: number | null;
  /** First choice alone, ignoring the others. */
  alone: MemberOption | null;
  status: MemberStatus;
}

export interface PoolAllocation {
  shares: number;
  units: number;
  /** units ÷ shares: the part of every pooled share actually sold. */
  soldFraction: number;
  /** Net proceeds of the whole units sold (price × (1 − sale costs) × units), before the owners' taxes. */
  proceeds: number;
  perMember: { share: number; soldShare: number; cash: number; residualShare: number }[];
  /** Shares not sold: kept as illiquid fractional shares (no cash unless a buyer or a buy-out is agreed). */
  residualShares: number;
  residualValueGross: number;
}

export interface GroupResult {
  lotId: string;
  contract: ContractTerms;
  /** Contracts evaluated for the group: one per funding facility offered to all. */
  fundingsTried: ContractFunding[];
  members: MemberPlan[];
  slotsAvailable: number;
  slotsUsed: number;
  pool: PoolAllocation;
  assigned: number;
  firstChoices: number;
  totalValue: number;
  /** One lot P&L with all the group's routes; ok = at least the hurdle. */
  developer: { margin: number | null; profit: number | null; hurdle: number; ok: boolean };
  status: 'infeasible' | 'modeled_conditional';
  conditions: string[];
  fairness: { rule: string; holdsForAll: boolean; noReservation: number; outside: number };
  uncoordinated: { slotsDemanded: number; poolShares: number; feasible: boolean; problems: string[] };
  search: { explored: number; maxMembers: number; maxOptions: number; truncated: boolean; complete: false };
}

export const MAX_MEMBERS = 8;
export const MAX_OPTIONS = 5;
const MAX_LEAVES = 200_000;
const EPS = 1e-9;

/** Problems with a group's inputs (plain Hebrew); empty when valid. */
export function validateGroup(g: GroupContext, config: ProjectConfig): string[] {
  const errors: string[] = [];
  if (!g.members.length) errors.push('אין בעלים בקבוצה.');
  if (g.members.length > MAX_MEMBERS) errors.push(`עד ${MAX_MEMBERS} בעלים בתכנון קבוצתי.`);
  if (!config.rights.lotIds.includes(g.lotId)) errors.push(`מגרש לא מוכר: ${g.lotId}`);
  else {
    const total = g.members.reduce((s, m) => s + (Number.isFinite(m.landAreaSqm) ? m.landAreaSqm : 0), 0);
    const cap = maxAreaInLot(config, g.lotId);
    if (total > cap + 1e-6) errors.push(`סך השטחים בקבוצה (${Math.round(total).toLocaleString('he-IL')} מ״ר) גדול מכל המגרש (${Math.round(cap).toLocaleString('he-IL')} מ״ר).`);
    const quota = quotaSlots(config, getLot(config.rights.tableVersion, g.lotId).units);
    if (!Number.isInteger(g.slotsAvailable) || g.slotsAvailable < 0) errors.push('מספר המקומות לשירותי בנייה חייב להיות מספר שלם לא שלילי.');
    else if (g.slotsAvailable > quota) errors.push(`במגרש יש לכל היותר ${quota} מקומות לשירותי בנייה (המכסה) — לא ${g.slotsAvailable}.`);
  }
  g.members.forEach((m) => {
    for (const e of validateInputs(memberProfile(m, g.lotId), g.terms, config)) errors.push(`${m.label}: ${e}`);
  });
  return [...new Set(errors)];
}

/** Whole units from pooled shares and each owner's pro-rata part (pure; review G1). */
export function poolAllocation(shares: number[], unitPrice: number, costRate: number): PoolAllocation {
  const S = shares.reduce((s, x) => s + x, 0);
  const units = Math.floor(S + EPS);
  const f = S > EPS ? units / S : 0;
  const net = unitPrice * (1 - costRate);
  const perMember = shares.map((share) => ({ share, soldShare: share * f, cash: share * f * net, residualShare: share * (1 - f) }));
  const residualShares = Math.max(0, S - units);
  return { shares: S, units, soldFraction: f, proceeds: units * net, perMember, residualShares, residualValueGross: residualShares * unitPrice };
}

const memberProfile = (m: GroupMember, lotId: string): UserProfile => ({
  landAreaSqm: m.landAreaSqm,
  availableCapital: m.availableCapital,
  maxMonthlyRepayment: m.maxMonthlyRepayment,
  goal: m.goal,
  lotId,
});

const poolShareOf = (r: StrategyResult) => (r.plan.fractionSettled?.mode === 'pool' ? r.plan.fractionSettled.share : 0);
const withSoldFraction = (c: Candidate, f: number): Candidate => ({
  ...c,
  legs: c.legs.map((l) => (l.kind === 'balancing_pool' ? { ...l, soldFraction: f } : l)),
});

interface Prepared {
  member: GroupMember;
  profile: UserProfile;
  peers: StrategyResult[];
  options: MemberOption[];
  reservation: MemberOption | null;
}

function prepare(m: GroupMember, k: ContractTerms, lotId: string, config: ProjectConfig, titleOf: (r: StrategyResult) => string): Prepared {
  const profile = memberProfile(m, lotId);
  const snaps = snapshotsFor(profile, k, config);
  // Renting out (S14) is a use of the same apartments, not another deal; inventory, price and policy-blocked routes are
  // already rejected by the snapshot.
  const accepted = snaps.filter((s) => s.owner.accepts && s.result.strategyType !== 'S14').sort((a, b) => b.owner.value - a.owner.value);
  const toOption = (s: ContractSnapshot, rank: number): MemberOption => ({
    contractId: s.id,
    routeId: s.routeId,
    title: titleOf(s.result),
    rank,
    value: s.owner.value,
    wholeApartments: s.owner.wholeApartments,
    slots: serviceApartments(s.route),
    poolShare: poolShareOf(s.result),
    conditions: s.conditions,
    snapshot: s,
  });
  const all = accepted.map(toOption);
  const options = all.slice(0, MAX_OPTIONS);
  const reservation = all.find((o) => o.slots === 0 && o.poolShare === 0) ?? null;
  if (reservation && !options.includes(reservation)) options.push(reservation);
  return { member: m, profile, peers: snaps.map((s) => s.result), options, reservation };
}

interface Plan {
  choice: (MemberOption | null)[];
  values: (number | null)[];
  snaps: (ContractSnapshot | null)[];
  outside: number;
  first: number;
  value: number;
  pool: PoolAllocation;
}

/** Lexicographic: fewer outside options, more first choices, more total value. */
const better = (a: Plan, b: Plan | null) =>
  !b || a.outside < b.outside || (a.outside === b.outside && (a.first > b.first || (a.first === b.first && a.value > b.value + 1e-6)));

function search(prep: Prepared[], k: ContractTerms, config: ProjectConfig, slotsAvailable: number) {
  const unitPrice = apartmentValueAt(contractConfig(config, k), completionMonthOf(config));
  const costRate = config.taxation.saleTransactionCostRate;
  const cache = new Map<string, ContractSnapshot>();
  /** A pooled option re-evaluated with the group's actual sale (sold fraction f). */
  const pooled = (i: number, o: MemberOption, f: number): ContractSnapshot => {
    const key = `${i}|${o.routeId}|${f.toFixed(9)}`;
    if (!cache.has(key)) cache.set(key, snapshotForCandidate(prep[i].profile, k, config, withSoldFraction(o.snapshot.route, f), prep[i].peers));
    return cache.get(key)!;
  };
  // Upper bounds for pruning (pre-pool values never fall when a pooled share is only partly sold).
  const maxValue = prep.map((p) => Math.max(0, ...p.options.map((o) => o.value)));
  const suffix = (xs: number[]) => xs.map((_, i) => xs.slice(i).reduce((s, x) => s + x, 0));
  const valueBound = suffix(maxValue);
  const hasOpt = suffix(prep.map((p) => (p.options.length ? 1 : 0)));

  let best: Plan | null = null;
  let explored = 0;
  let truncated = false;
  const choice: (MemberOption | null)[] = [];
  const walk = (i: number, slots: number, outside: number, first: number, value: number) => {
    if (truncated || slots > slotsAvailable) return;
    if (best) {
      const minOutside = outside + (prep.length - i - (hasOpt[i] ?? 0));
      if (minOutside > best.outside) return;
      if (minOutside === best.outside && first + (hasOpt[i] ?? 0) < best.first) return;
      if (minOutside === best.outside && first + (hasOpt[i] ?? 0) === best.first && value + (valueBound[i] ?? 0) <= best.value + 1e-6) return;
    }
    if (i === prep.length) {
      explored += 1;
      if (explored > MAX_LEAVES) {
        truncated = true;
        return;
      }
      const shares = choice.map((o) => o?.poolShare ?? 0);
      const pool = poolAllocation(shares, unitPrice, costRate);
      if (pool.shares > EPS && pool.units < 1) return; // a pool needs at least one whole unit of shares
      const values: (number | null)[] = [];
      const snaps: (ContractSnapshot | null)[] = [];
      for (let j = 0; j < prep.length; j += 1) {
        const o = choice[j];
        if (!o) {
          values.push(null);
          snaps.push(null);
          continue;
        }
        const s = o.poolShare > 0 && pool.soldFraction < 1 - EPS ? pooled(j, o, pool.soldFraction) : o.snapshot;
        // The re-evaluated route must still be acceptable to its owner and not below their reservation.
        if (!s.owner.accepts) return;
        const res = prep[j].reservation;
        if (res && o !== res && s.owner.value < res.value - 1e-6) return;
        values.push(s.owner.value);
        snaps.push(s);
      }
      const plan: Plan = {
        choice: [...choice],
        values,
        snaps,
        outside,
        first,
        value: values.reduce<number>((s, v) => s + (v ?? 0), 0),
        pool,
      };
      if (better(plan, best)) best = plan;
      return;
    }
    const p = prep[i];
    const opts: (MemberOption | null)[] = [...p.options.filter((o) => !p.reservation || o.value >= p.reservation.value - 1e-6), null];
    for (const o of opts) {
      choice.push(o);
      walk(i + 1, slots + (o?.slots ?? 0), outside + (o ? 0 : 1), first + (o && o.rank === 0 ? 1 : 0), value + (o?.value ?? 0));
      choice.pop();
    }
  };
  walk(0, 0, 0, 0, 0);
  return { best: best as Plan | null, explored, truncated, unitPrice, costRate };
}

/** One lot P&L with all the group's routes: deltas against the same typical baseline summed, slots summed. */
function groupDeveloper(prep: Prepared[], snaps: (ContractSnapshot | null)[], k: ContractTerms, config: ProjectConfig) {
  const cfg = contractConfig(config, k);
  const terms: CommercialTerms = { combinationPct: k.combinationPct, developerMarkup: k.markup };
  const deltas: RouteDelta[] = [];
  let slots = 0;
  let ctx0: { info: ReturnType<typeof calculateRights>; profile: UserProfile; config: ProjectConfig } | null = null;
  snaps.forEach((s, i) => {
    if (!s) return;
    const info = calculateRights(prep[i].profile.landAreaSqm, cfg, prep[i].profile.lotId);
    const ctx = { info, profile: prep[i].profile, config: cfg };
    ctx0 ??= ctx;
    deltas.push(routeDelta(ctx, s.result.plan, terms, s.result.simulation.taxLoanSubsidy));
    slots += serviceApartments(s.route);
  });
  if (!ctx0 || !deltas.length) return null;
  const H = Math.max(...deltas.map((d) => d.flows.length));
  const flows = new Array<number>(H).fill(0);
  for (const d of deltas) d.flows.forEach((x, m) => (flows[m] += x));
  const delta: RouteDelta = {
    consideration: deltas[0].consideration,
    flows,
    revenue: deltas.reduce((s, d) => s + d.revenue, 0),
    costs: deltas.reduce((s, d) => s + d.costs, 0),
    userPhysicalUnits: deltas.reduce((s, d) => s + d.userPhysicalUnits, 0),
  };
  return lotDeveloperPnL(ctx0, k.arrangement, k.combinationPct, { markup: k.markup, delta, userServicesUnits: slots });
}

export function planGroup(g: GroupContext, titleOf: (r: StrategyResult) => string, config: ProjectConfig = PROJECT_CONFIG): GroupResult {
  const problems = validateGroup(g, config);
  if (problems.length) throw new Error(problems.join(' '));
  const hurdle = config.developer.targetMarginOnRevenue;
  // One funding facility for all (a common term): none, or the developer's tax loan offered to every member.
  const fundings: ContractFunding[] = g.members.some((m) => m.maxMonthlyRepayment !== 0) ? ['none', 'developer_loan'] : ['none'];

  type Run = { k: ContractTerms; prep: Prepared[]; s: ReturnType<typeof search>; dev: ReturnType<typeof groupDeveloper> };
  let chosenRun: Run | null = null;
  for (const funding of fundings) {
    const k: ContractTerms = { arrangement: g.arrangement, combinationPct: g.terms.combinationPct, markup: g.terms.developerMarkup, offer: g.offer, funding };
    const prep = g.members.map((m) => prepare(m, k, g.lotId, config, titleOf));
    const s = search(prep, k, config, g.slotsAvailable);
    const dev = s.best ? groupDeveloper(prep, s.best.snaps, k, config) : null;
    const run: Run = { k, prep, s, dev };
    const devOk = (r: Run) => !!r.dev && r.dev.margin >= hurdle - EPS;
    // Prefer a plan the developer side reconciles; then the lexicographic objective; ties keep the simpler funding.
    if (
      !chosenRun ||
      (devOk(run) && !devOk(chosenRun)) ||
      (devOk(run) === devOk(chosenRun) && run.s.best && (!chosenRun.s.best || better(run.s.best, chosenRun.s.best)))
    )
      chosenRun = run;
  }
  const { k, prep, s, dev } = chosenRun!;
  const best = s.best;
  const choice = best?.choice ?? prep.map(() => null);

  const members: MemberPlan[] = prep.map((p, i) => {
    const chosen = choice[i];
    const status: MemberStatus = !chosen ? 'outside_option' : p.reservation ? 'at_or_above_reservation' : 'no_reservation_option';
    return { member: p.member, options: p.options, reservation: p.reservation, chosen, chosenSnapshot: best?.snaps[i] ?? null, chosenValue: best?.values[i] ?? null, alone: p.options[0] ?? null, status };
  });
  const pool = best?.pool ?? poolAllocation([], s.unitPrice, s.costRate);

  const slotsDemanded = members.reduce((x, m) => x + (m.alone?.slots ?? 0), 0);
  const alonePool = members.reduce((x, m) => x + (m.alone?.poolShare ?? 0), 0);
  const uncoordinated: string[] = [];
  if (slotsDemanded > g.slotsAvailable) uncoordinated.push(`${slotsDemanded} מבקשים שירותי בנייה, ויש ${g.slotsAvailable} מקומות`);
  if (alonePool > EPS && alonePool < 1 - EPS) uncoordinated.push(`חלקי הדירות ליחידת סל מגיעים רק ל-${alonePool.toFixed(2)} דירה — לא מספיק ליחידה אחת`);
  if (alonePool >= 1 - EPS && alonePool - Math.floor(alonePool + EPS) > 0.01)
    uncoordinated.push(`מיחידת הסל נמכרות רק ${Math.floor(alonePool + EPS)} דירות שלמות; כל אחד לבד מניח שכל החלק שלו נמכר`);

  const outside = members.filter((m) => m.status === 'outside_option').length;
  const noReservation = members.filter((m) => m.status === 'no_reservation_option').length;
  const devOk = !!dev && dev.margin >= hurdle - EPS;
  const conditions = [
    'OUTSIDE_OPTION_UNKNOWN',
    'DEVELOPER_HURDLE_ASSUMED',
    'GROUP_AGREEMENT',
    ...(pool.shares > EPS ? ['POOL_INVENTORY'] : []),
    ...(pool.residualShares > EPS ? ['POOL_RESIDUAL_UNSOLD'] : []),
    ...(outside ? ['OWNERS_WITHOUT_OPTION'] : []),
    ...(k.funding === 'developer_loan' ? ['TAX_LOAN'] : []),
    ...(s.truncated ? ['SEARCH_TRUNCATED'] : []),
  ];
  return {
    lotId: g.lotId,
    contract: k,
    fundingsTried: fundings,
    members,
    slotsAvailable: g.slotsAvailable,
    slotsUsed: choice.reduce((x, o) => x + (o?.slots ?? 0), 0),
    pool,
    assigned: members.length - outside,
    firstChoices: choice.filter((o) => o && o.rank === 0).length,
    totalValue: best?.value ?? 0,
    developer: { margin: dev?.margin ?? null, profit: dev?.profit ?? null, hurdle, ok: devOk },
    status: best && devOk && outside === 0 ? 'modeled_conditional' : 'infeasible',
    conditions,
    fairness: {
      rule: 'כל מי שיש לו מסלול בלי משאב משותף מקבל לפחות את הערך שלו; מי שאין לו — בלי הבטחה כזו',
      holdsForAll: outside === 0 && noReservation === 0,
      noReservation,
      outside,
    },
    uncoordinated: { slotsDemanded, poolShares: alonePool, feasible: uncoordinated.length === 0, problems: uncoordinated },
    search: { explored: s.explored, maxMembers: MAX_MEMBERS, maxOptions: MAX_OPTIONS, truncated: s.truncated, complete: false },
  };
}
