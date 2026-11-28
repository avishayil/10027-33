import { computeTableRights } from '../utils/simulationMath';
import type { ProjectConfig, RightsInfo } from './types';

/**
 * The owner's entitlement in standard-apartment equivalents (one = a 100 m² apartment).
 *  - 'official' (default, iteration 10): the allocation-table share of the lot's saleable (door-to-door) area ÷ 100 m²
 *    — for 167 m² in lot 149: 2.353% × 11,209 m² ÷ 100 ≈ 2.64;
 *  - 'simulation': A / 167 × 2.25 (iterations 1–9).
 */
export function apartmentEquivalents(landAreaSqm: number, config: ProjectConfig, lotId?: string): number {
  const area = Math.max(0, Number(landAreaSqm) || 0);
  if (config.rights.entitlementBasis === 'official') {
    const t = computeTableRights(area, config.rights.tableVersion, lotId || config.rights.defaultLotId, config.taxation.bettermentLevyRate * 100);
    return t.residentialArea / config.construction.apartmentSizeSqm;
  }
  return (area / config.rights.originalAreaSqm) * config.rights.apartmentEquivalents;
}

export function calculateRights(landAreaSqm: number, config: ProjectConfig, lotId?: string): RightsInfo {
  const area = Math.max(0, Number(landAreaSqm) || 0);
  // Unknown lot → the default lot is assumed and flagged; an invalid lot id is an error, never silently replaced.
  if (lotId && !config.rights.lotIds.includes(lotId)) throw new Error(`מגרש לא מוכר: ${lotId}`);
  const lot = lotId || config.rights.defaultLotId;
  const table = computeTableRights(area, config.rights.tableVersion, lot, config.taxation.bettermentLevyRate * 100);
  const R = apartmentEquivalents(area, config, lot);
  return {
    landAreaSqm: area,
    lotAssumed: !lotId,
    apartmentEquivalents: R,
    // Original parcel m² per right (on the official basis it depends on the lot).
    sqmPerRight: R > 0 ? area / R : config.rights.originalAreaSqm / config.rights.apartmentEquivalents,
    lotId: lot,
    table: {
      lotShare: table.lotShare,
      units: table.units,
      allocationValue: table.allocationValue,
      incomingValue: table.incomingValue,
      increase: table.increase,
    },
    bettermentLevy: table.bettermentLevy,
  };
}
