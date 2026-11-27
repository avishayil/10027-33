/**
 * Equivalent combination % between tax arrangements. A developer that takes on the owner's taxes prices them into a
 * lower %, so arrangements must never be compared at the same % (that would treat the taxes as free).
 *
 * - developer-equivalent %: the % under `toArr` that leaves the developer the same profit as `fromPct` under
 *   `fromArr` — what to expect a developer to offer. The model's absolute developer margin is uncertain (#18), but
 *   the difference between arrangements is only taxes, gross-up and purchase tax, so the equivalence is robust.
 * - owner break-even %: the % under `toArr` at which the owner ends up as well off — apartments received (today's
 *   value) minus the taxes the owner pays, each carried to delivery at the tax-loan rate. What is still worth accepting.
 *
 * Both use the household's full combination (S02) at its own rights, lot and tax basis.
 */
import { withArrangement } from '../domain/arrangements';
import { completionMonth } from '../domain/construction';
import { candidatePnL } from '../domain/developer';
import { lotDeveloperPnL } from '../domain/lotDeveloper';
import { buildTransactionPlan } from '../domain/transactions';
import type { Candidate, CommercialTerms, ProjectConfig, RightsInfo, TaxArrangement, UserProfile } from '../domain/types';
import { apartmentValueToday } from '../domain/valuation';

export interface EquivalenceContext {
  info: RightsInfo;
  profile: UserProfile;
  config: ProjectConfig;
}

const LOW = 0;
const HIGH = 0.8;
const OWNER_TAXES = new Set(['betterment_levy', 'capital_gains_tax', 'services_vat']);

function fullCombination(info: RightsInfo): Candidate {
  return { id: 'S02', type: 'S02', targetApartments: 0, legs: [{ kind: 'combination', rights: info.apartmentEquivalents }] };
}

function planFor(ctx: EquivalenceContext, arr: TaxArrangement, c: number) {
  const config = withArrangement(ctx.config, arr);
  const terms: CommercialTerms = { combinationPct: c, developerMarkup: config.commercial.developerMarkup.default };
  const candidate = fullCombination(ctx.info);
  return { config, terms, candidate, plan: buildTransactionPlan(candidate, { info: ctx.info, profile: ctx.profile, terms, config }) };
}

/** Developer profit on the household's full combination at `c` under `arr`. */
export function developerCombinationProfit(ctx: EquivalenceContext, arr: TaxArrangement, c: number): number {
  const { config, terms, candidate, plan } = planFor(ctx, arr, c);
  return candidatePnL(candidate, plan, ctx.info, config, terms)?.profit ?? 0;
}

/** Owner value of the full combination: apartments received minus owner-paid taxes carried to delivery. */
export function ownerCombinationValue(ctx: EquivalenceContext, arr: TaxArrangement, c: number): number {
  const { config, plan } = planFor(ctx, arr, c);
  const delivery = completionMonth(config);
  const monthly = config.financing.taxLoan.annualRate / 12;
  const taxes = plan.ledger
    .filter((e) => e.payer === 'owner' && e.direction === 'out' && OWNER_TAXES.has(e.category))
    .reduce((s, e) => s + e.amount * Math.pow(1 + monthly, Math.max(0, delivery - e.month)), 0);
  return c * ctx.info.apartmentEquivalents * apartmentValueToday(config) - taxes;
}

/** Solves f(c) = target on [0, 0.8] for a monotone f; null when the target is out of range. */
function solve(f: (c: number) => number, target: number): number | null {
  let lo = LOW;
  let hi = HIGH;
  const flo = f(lo) - target;
  const fhi = f(hi) - target;
  if (flo === 0) return lo;
  if (fhi === 0) return hi;
  if (flo * fhi > 0) return null;
  for (let i = 0; i < 50; i += 1) {
    const mid = (lo + hi) / 2;
    const fm = f(mid) - target;
    if (fm * flo > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Which developer model the equivalence holds the profit of: the lot-level P&L (default — includes the timing of
 * the taxes the developer pays and their financing) or the per-owner standalone P&L.
 */
export type DeveloperModel = 'lot' | 'standalone';

export function developerEquivalentPct(
  ctx: EquivalenceContext,
  fromArr: TaxArrangement,
  fromPct: number,
  toArr: TaxArrangement,
  model: DeveloperModel = 'lot',
): number | null {
  if (fromArr === toArr) return fromPct;
  const profit = (arr: TaxArrangement, c: number) =>
    model === 'lot' ? lotDeveloperPnL(ctx, arr, c).profit : developerCombinationProfit(ctx, arr, c);
  const target = profit(fromArr, fromPct);
  return solve((c) => profit(toArr, c), target);
}

export function ownerBreakEvenPct(ctx: EquivalenceContext, fromArr: TaxArrangement, fromPct: number, toArr: TaxArrangement): number | null {
  if (fromArr === toArr) return fromPct;
  const target = ownerCombinationValue(ctx, fromArr, fromPct);
  return solve((c) => ownerCombinationValue(ctx, toArr, c), target);
}
