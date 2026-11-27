/**
 * Candidate generation. Enumerates conventional and hybrid strategies for the user's rights,
 * including every whole-apartment target. It does not prefer more apartments — ranking decides.
 */
import type { Candidate, CommercialTerms, Leg, ProjectConfig, RightsInfo } from '../domain/types';

const EPS = 1e-6;
const MAX_APARTMENTS = 20;

/** Rights to keep for construction services so that combination + construction yields N apartments. */
export function mixedSplit(N: number, R: number, c: number): number {
  return (N - c * R) / (1 - c);
}

export function generateStrategies(info: RightsInfo, terms: CommercialTerms, config: ProjectConfig): Candidate[] {
  const R = info.apartmentEquivalents;
  if (!(R > EPS)) return [];
  const c = terms.combinationPct;
  const out: Candidate[] = [];
  const add = (id: string, type: Candidate['type'], legs: Leg[], targetApartments: number) =>
    out.push({ id, type, legs, targetApartments });

  add('S01', 'S01', [{ kind: 'sell_rights', rights: R, market: 'developer' }], 0);
  add('S01M', 'S01M', [{ kind: 'sell_rights', rights: R, market: 'open_market' }], 0);
  add('S09', 'S09', [{ kind: 'sell_rights', rights: R, market: 'post_approval' }], 0);

  const finished = R * c;
  const whole = Math.floor(finished + EPS);
  const fraction = finished - whole;
  add('S02', 'S02', [{ kind: 'combination', rights: R }], whole);
  if (fraction > 0.01) {
    add('S02C', 'S02C', [{ kind: 'combination', rights: R }, { kind: 'settle_fraction_cash' }], whole);
    add('S02P', 'S02P', [{ kind: 'combination', rights: R }, { kind: 'balancing_pool' }], whole);
    const target = whole + 1;
    add(`S06-${target}`, 'S06', [
      { kind: 'combination', rights: R },
      { kind: 'completion', apartmentEquivalents: target - finished },
    ], target);
  }

  // Value-based allocation: a whole apartment of a different (illustrative) size instead of a fraction.
  if (fraction > 0.01) {
    for (const t of config.market.apartmentTypes) {
      if (t.rooms === 4) continue; // the standard 4-room apartment is S06
      add(`S13-${t.rooms}r`, 'S13', [{ kind: 'combination', rights: R }, { kind: 'tier_apartment', rooms: t.rooms }], whole + 1);
    }
  }

  add('S04', 'S04', [{ kind: 'revenue_share', rights: R }], 0);

  // S11: combination on part of the rights, construction services on the rest, for each whole target N.
  for (let N = whole + 1; N <= Math.min(MAX_APARTMENTS, Math.floor(R + EPS)); N += 1) {
    const build = mixedSplit(N, R, c);
    if (build <= EPS || build > R + EPS) continue;
    const comb = R - build;
    const legs: Leg[] = [{ kind: 'build', apartments: build, ownRightsUsed: build, purchasedRightsUsed: 0 }];
    if (comb > EPS) legs.unshift({ kind: 'combination', rights: comb });
    add(`S11-${N}`, 'S11', legs, N);
  }

  const maxWhole = Math.min(MAX_APARTMENTS, Math.floor(R + EPS));
  for (let k = 1; k <= maxWhole; k += 1) {
    const surplus = Math.max(0, R - k);
    const build: Leg = { kind: 'build', apartments: k, ownRightsUsed: k, purchasedRightsUsed: 0 };
    const sell: Leg[] = surplus > EPS ? [{ kind: 'sell_rights', rights: surplus, market: 'developer' }] : [];
    add(k === maxWhole ? `S03-${k}` : `S05-${k}`, k === maxWhole ? 'S03' : 'S05', [...sell, build], k);
    add(`S08-${k}`, 'S08', [...sell, build, { kind: 'rent_for_repayment' }], k);
    if (k >= 2) {
      add(`S07-${k}`, 'S07', [...sell, build, { kind: 'sell_apartments', apartments: 1 }], k - 1);
    }
  }

  const next = Math.ceil(R - EPS);
  const missing = next - R;
  if (missing > 0.01 && next <= MAX_APARTMENTS) {
    add(`S10-${next}`, 'S10', [
      { kind: 'buy_rights', rights: missing },
      { kind: 'build', apartments: next, ownRightsUsed: R, purchasedRightsUsed: missing },
    ], next);
  }

  return out;
}

/** Rights conservation for a candidate: owned + purchased = disposed + built + held. */
export function rightsBalance(c: Candidate, R: number): number {
  let purchased = 0;
  let used = 0;
  for (const leg of c.legs) {
    if (leg.kind === 'buy_rights') purchased += leg.rights;
    if (leg.kind === 'sell_rights' || leg.kind === 'combination' || leg.kind === 'revenue_share' || leg.kind === 'hold_land') used += leg.rights;
    if (leg.kind === 'build') used += leg.ownRightsUsed + leg.purchasedRightsUsed;
  }
  return R + purchased - used;
}
