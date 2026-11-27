/**
 * Expected developer policy for construction services (שירותי בנייה) inside a lot.
 *
 * A lot has about 100 units. A developer earns most from full combination, so it is expected to release
 * only 20–30% of the units for construction services, and to ration them so that every owner can reach
 * one apartment:
 *  - an owner whose full combination already yields a whole apartment (R × c ≥ 1 — about 3 rights)
 *    is expected to take full combination, not construction services;
 *  - everyone else may build at most one apartment through construction services.
 * So with 4 rights you will not be offered 4 apartments in construction services; with 1–3 rights one
 * apartment in construction services is realistic, depending on finances and goals.
 */
import { BASE_SHARE_AREA, getLot } from '../data/parcel33';
import type { Candidate, LotPolicy, ProjectConfig, ReasonCode, RightsInfo } from './types';

const EPS = 1e-6;

/** Construction-services apartment slots a candidate uses (a partial S11 apartment still takes a slot). */
export function serviceApartments(candidate: Candidate): number {
  return candidate.legs.reduce((n, l) => (l.kind === 'build' ? n + Math.ceil(l.apartments - EPS) : n), 0);
}

export function combinationYieldsWhole(R: number, combinationPct: number): boolean {
  return R * combinationPct >= 1 - EPS;
}

/**
 * Why the candidate falls outside the EXPECTED policy, or null if it is within it. The eligibility test uses the
 * project-wide reference combination rate, not the individual slider (lowering a hypothetical slider must not
 * unlock a real slot). Outside the expected policy ≠ refused: it is "negotiable" unless the policy is confirmed.
 */
export function policyBlock(candidate: Candidate, R: number, config: ProjectConfig): ReasonCode | null {
  const slots = serviceApartments(candidate);
  if (slots === 0) return null;
  const p = config.developerPolicy;
  if (p.noServicesWhenCombinationYieldsWhole && combinationYieldsWhole(R, p.referenceCombinationPct)) {
    return 'DEVELOPER_POLICY_WHOLE_FROM_COMBINATION';
  }
  if (slots > p.maxServiceApartmentsPerOwner) return 'DEVELOPER_POLICY_PER_OWNER_CAP';
  return null;
}

export function lotPolicy(info: RightsInfo, config: ProjectConfig): LotPolicy {
  const combinationPct = config.developerPolicy.referenceCombinationPct;
  const lot = getLot(config.rights.tableVersion, info.lotId);
  const p = config.developerPolicy;
  // Parcel area that maps into this lot, divided into typical 167 m² holdings.
  const lotParcelArea = BASE_SHARE_AREA / lot.sharePer167;
  const typicalR = config.rights.apartmentEquivalents;
  const typicalWants = !(p.noServicesWhenCombinationYieldsWhole && combinationYieldsWhole(typicalR, combinationPct)) && typicalR >= 1;
  return {
    lotId: lot.id,
    lotUnits: lot.units,
    capShare: p.servicesCapShareOfLot,
    // Integer slots (rounded down): a quota of 25% of 102 units is 25 apartments, not 25.5.
    capUnits: Math.floor(lot.units * p.servicesCapShareOfLot),
    capUnitsRange: {
      restrictive: Math.floor(lot.units * p.capShareRange.restrictive),
      flexible: Math.floor(lot.units * p.capShareRange.flexible),
    },
    confirmed: p.confirmed,
    estimatedDemand: typicalWants ? lotParcelArea / config.rights.originalAreaSqm : 0,
    wholeFromCombinationThreshold: combinationPct > 0 ? 1 / combinationPct : Infinity,
    maxServiceApartmentsPerOwner: p.maxServiceApartmentsPerOwner,
    servicesOffered: !(p.noServicesWhenCombinationYieldsWhole && combinationYieldsWhole(info.apartmentEquivalents, combinationPct)),
  };
}
