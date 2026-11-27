/**
 * Iteration 9 / phase F — collective allocation for an anonymous group of owners in one lot (first version).
 *
 * Individually, owners compete for two finite things the engine already models: construction-services slots in the lot
 * (whole slots) and balancing pools (fractions of apartments that must add up to at least one whole apartment to be
 * sold together). Each owner's options come from their own analysis, best first. The planner chooses one option per
 * owner so that: slots used ≤ slots available to the group; a pool forms only if its shares reach one apartment; and no
 * owner gets an option worse than their own baseline (the best option that needs no shared resource). Among such plans
 * it maximises the number of owners on their first choice, then the total value. Compared with everyone choosing
 * alone, it shows which choices clash. Inputs are anonymous scenarios typed by the user — never inferred from the
 * allocation table, never stored. Rights transfers between owners (price unknown) are not proposed here.
 */
import { PROJECT_CONFIG } from '../../data/config';
import { policyBlock, serviceApartments } from '../../domain/policy';
import type { CommercialTerms, Goal, ProjectConfig, StrategyResult } from '../../domain/types';
import { analyzeProfile } from '../analyze';

export interface GroupMember {
  label: string;
  landAreaSqm: number;
  availableCapital: number | null;
  maxMonthlyRepayment: number | null;
  goal: Goal;
}

export interface MemberOption {
  routeId: string;
  title: string;
  /** Preference order in the owner's own analysis (0 = first choice). */
  rank: number;
  value: number;
  wholeApartments: number;
  slots: number;
  poolShare: number;
  /** Fits only on a condition (a developer tax loan, a loan on another property, other tax terms). */
  condition: string | null;
}

export interface MemberPlan {
  member: GroupMember;
  options: MemberOption[];
  /** Index of the baseline option (needs no shared resource); null if the owner has none. */
  baseline: number | null;
  chosen: MemberOption | null;
  /** What this owner would pick alone (first choice), ignoring the others. */
  alone: MemberOption | null;
}

export interface GroupResult {
  members: MemberPlan[];
  slotsAvailable: number;
  slotsUsed: number;
  pool: { shares: number; units: number; leftover: number };
  firstChoices: number;
  totalValue: number;
  /** Everyone choosing alone: slots demanded, pool shares, and whether that is feasible. */
  uncoordinated: { slotsDemanded: number; poolShares: number; feasible: boolean; problems: string[] };
  /** Plans explored (bounded search). */
  explored: number;
}

const MAX_MEMBERS = 8;
const MAX_OPTIONS = 5;

/** The owner's options: their eligible routes in rank order (first MAX_OPTIONS), plus their best no-resource route. */
function optionsFor(member: GroupMember, terms: CommercialTerms, config: ProjectConfig, titleOf: (r: StrategyResult) => string) {
  const d = analyzeProfile(
    { landAreaSqm: member.landAreaSqm, availableCapital: member.availableCapital, maxMonthlyRepayment: member.maxMonthlyRepayment, goal: member.goal },
    terms,
    config,
  );
  const R = d.rights.apartmentEquivalents;
  const conditional = d.conditionalRecommendation;
  const conditionOf = (): string | null => {
    if (!conditional) return null;
    if (conditional.kind === 'funding') return conditional.method === 'other_property' ? 'בהלוואה על נכס אחר' : 'בהלוואת מסים מהיזם';
    return conditional.arrangement === 'net' ? 'בעסקת נטו' : conditional.arrangement === 'mixed' ? 'כשהיזם משלם את ההיטל' : 'בתנאי מסים אחרים';
  };
  const toOption = (r: StrategyResult, rank: number, condition: string | null = null): MemberOption => ({
    routeId: r.id,
    title: titleOf(r),
    rank,
    value: r.metrics.valueCreated,
    wholeApartments: r.metrics.wholeApartments,
    slots: policyBlock(r.candidate, R, config) ? 0 : serviceApartments(r.candidate),
    poolShare: r.plan.fractionSettled?.mode === 'pool' ? r.plan.fractionSettled.share : 0,
    condition,
  });
  // No assumed apartment sizes (S13) and no duplicate rental variants (S14): the group decides on deals, not sizes.
  const usable = d.ranked.filter((r) => r.strategyType !== 'S13' && r.strategyType !== 'S14');
  const options = usable.slice(0, MAX_OPTIONS).map((r, i) => toOption(r, i));
  // Nothing fits on the base terms: the owner's conditional direction is their option (marked with its condition).
  if (!options.length && conditional && conditional.result.strategyType !== 'S13') options.push(toOption(conditional.result, 0, conditionOf()));
  let baseline = options.findIndex((o) => o.slots === 0 && o.poolShare === 0);
  if (baseline < 0) {
    const i = usable.findIndex((r) => serviceApartments(r.candidate) === 0 && r.plan.fractionSettled?.mode !== 'pool');
    if (i >= 0) {
      options.push(toOption(usable[i], i));
      baseline = options.length - 1;
    }
  }
  return { options, baseline: baseline >= 0 ? baseline : null };
}

export function planGroup(
  members: GroupMember[],
  terms: CommercialTerms,
  slotsAvailable: number,
  titleOf: (r: StrategyResult) => string,
  config: ProjectConfig = PROJECT_CONFIG,
): GroupResult {
  if (members.length > MAX_MEMBERS) throw new Error(`עד ${MAX_MEMBERS} בעלים בתכנון קבוצתי.`);
  const plans: MemberPlan[] = members.map((m) => {
    const { options, baseline } = optionsFor(m, terms, config, titleOf);
    return { member: m, options, baseline, chosen: null, alone: options[0] ?? null };
  });

  // Bounded depth-first search over one option (or none, for owners with no fitting route) per owner.
  let best: { choice: (MemberOption | null)[]; first: number; value: number } | null = null;
  let explored = 0;
  const choice: (MemberOption | null)[] = [];
  const allowed = (p: MemberPlan): (MemberOption | null)[] => {
    if (!p.options.length) return [null];
    // Never worse than the owner's own baseline (rank order). Without a baseline (every option needs a shared
    // resource), "no route in this plan" is the last resort, so the group plan always exists.
    if (p.baseline === null) return [...p.options, null];
    const limit = p.options[p.baseline].rank;
    return p.options.filter((o) => o.rank <= limit);
  };
  const walk = (i: number, slots: number) => {
    if (slots > slotsAvailable) return;
    if (i === plans.length) {
      explored += 1;
      const pool = choice.reduce((s, o) => s + (o?.poolShare ?? 0), 0);
      if (pool > 1e-9 && pool < 1 - 1e-9) return; // a pool needs at least one whole apartment of shares
      const first = choice.filter((o) => o && o.rank === 0).length;
      const value = choice.reduce((s, o) => s + (o?.value ?? 0), 0);
      if (!best || first > best.first || (first === best.first && value > best.value)) best = { choice: [...choice], first, value };
      return;
    }
    for (const o of allowed(plans[i])) {
      choice.push(o);
      walk(i + 1, slots + (o?.slots ?? 0));
      choice.pop();
    }
  };
  walk(0, 0);

  const chosen: (MemberOption | null)[] = best ? (best as { choice: (MemberOption | null)[] }).choice : plans.map(() => null);
  plans.forEach((p, i) => (p.chosen = chosen[i]));
  const poolShares = chosen.reduce((s, o) => s + (o?.poolShare ?? 0), 0);

  const slotsDemanded = plans.reduce((s, p) => s + (p.alone?.slots ?? 0), 0);
  const alonePool = plans.reduce((s, p) => s + (p.alone?.poolShare ?? 0), 0);
  const problems: string[] = [];
  if (slotsDemanded > slotsAvailable) problems.push(`${slotsDemanded} מבקשים שירותי בנייה, ויש ${slotsAvailable} מקומות`);
  if (alonePool > 1e-9 && alonePool < 1 - 1e-9) problems.push(`חלקי הדירות ליחידת סל מגיעים רק ל-${alonePool.toFixed(2)} דירה — לא מספיק ליחידה אחת`);

  return {
    members: plans,
    slotsAvailable,
    slotsUsed: chosen.reduce((s, o) => s + (o?.slots ?? 0), 0),
    pool: { shares: poolShares, units: Math.floor(poolShares + 1e-9), leftover: poolShares - Math.floor(poolShares + 1e-9) },
    firstChoices: chosen.filter((o) => o && o.rank === 0).length,
    totalValue: chosen.reduce((s, o) => s + (o?.value ?? 0), 0),
    uncoordinated: { slotsDemanded, poolShares: alonePool, feasible: problems.length === 0, problems },
    explored,
  };
}
