/**
 * Candidate generation. Enumerates conventional and hybrid strategies for the user's rights,
 * including every whole-apartment target. It does not prefer more apartments — ranking decides.
 */
import type { Candidate, CommercialTerms, Leg, ProjectConfig, RightsInfo } from '../domain/types';

const EPS = 1e-6;
const MAX_APARTMENTS = 20;

/** Rights to keep for construction services so that combination + construction yields N apartments. */
/**
 * Iteration 9 / D1: which apartment mixes of one count to evaluate. Not only the closest to the entitlement — those can
 * all require a payment. Always kept: the cheapest mix (most balancing money back), the most valuable one, and the most
 * valuable mix that needs no payment; then the closest ones, up to seven in all.
 */
export function keepMixes(mixes: number[][], value: (m: number[]) => number, finished: number, cap = 7): number[][] {
  if (mixes.length <= cap) return [...mixes].sort((a, b) => Math.abs(value(a) - finished) - Math.abs(value(b) - finished));
  const byValue = [...mixes].sort((a, b) => value(a) - value(b));
  const noPayment = byValue.filter((m) => value(m) <= finished + EPS);
  const picks: number[][] = [byValue[0], byValue[byValue.length - 1]];
  if (noPayment.length) picks.push(noPayment[noPayment.length - 1]);
  const key = (m: number[]) => m.join(',');
  const seen = new Set(picks.map(key));
  for (const m of [...mixes].sort((a, b) => Math.abs(value(a) - finished) - Math.abs(value(b) - finished))) {
    if (picks.length >= cap) break;
    if (seen.has(key(m))) continue;
    seen.add(key(m));
    picks.push(m);
  }
  return picks.sort((a, b) => Math.abs(value(a) - finished) - Math.abs(value(b) - finished));
}

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

  // Apartment mixes (iterations 7–8): the whole entitlement as apartments of the available types — from one apartment
  // fewer to one more than the entitlement, within one standard apartment of its value (the gap paid or received).
  // Exact duplicates of S02 / S06 and of the single-tier S13 routes are skipped; the closest six per count are kept.
  if (finished >= 1 - EPS) {
    const types = config.market.apartmentTypes.map((t) => t.rooms).sort((a, b) => a - b);
    const value = (rooms: number[]) => rooms.reduce((s, r) => s + (config.market.apartmentTypes.find((t) => t.rooms === r)?.relativeValue ?? 0), 0);
    const hasFraction = fraction > 0.01;
    const used = new Set(out.map((c) => c.id));
    for (let n = Math.max(1, whole - 1); n <= Math.min(MAX_APARTMENTS, whole + 2); n += 1) {
      const mixes: number[][] = [];
      const build = (start: number, acc: number[]) => {
        if (acc.length === n) {
          mixes.push([...acc]);
          return;
        }
        for (let i = start; i < types.length; i += 1) build(i, [...acc, types[i]]);
      };
      build(0, []);
      const candidates = mixes.filter((mix) => {
          const standard = mix.filter((r) => r === 4).length;
          const allStandard = standard === n;
          if (allStandard && (n === whole || (hasFraction && n === whole + 1))) return false; // S02 / S06
          if (hasFraction && n === whole + 1 && standard === whole) return false; // single-tier S13
          return Math.abs(value(mix) - finished) <= 1 + EPS;
        });
      const kept = keepMixes(candidates, value, finished);
      for (const mix of kept) {
        let id = `S13-${mix.map((r) => `${r}r`).join('+')}`;
        if (used.has(id)) id = `${id}-mix`;
        used.add(id);
        add(id, 'S13', [{ kind: 'combination', rights: R }, { kind: 'apartment_mix', rooms: mix }], n);
      }
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

  // Renting out the apartments received in a combination (S14): the same route with rent counting toward repayment.
  for (const c of [...out]) {
    const combinationRoute = c.legs.some((l) => l.kind === 'combination') && !c.legs.some((l) => l.kind === 'build' || l.kind === 'sell_rights');
    const keepsWhole = c.targetApartments >= 1 && (c.type === 'S06' || c.type === 'S13' || (c.type === 'S02' && whole >= 1));
    if (combinationRoute && keepsWhole) add(`${c.id}-rent`, 'S14', [...c.legs, { kind: 'rent_for_repayment' }], c.targetApartments);
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
