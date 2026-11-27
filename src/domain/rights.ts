import { computeTableRights } from '../utils/simulationMath';
import type { ProjectConfig, RightsInfo } from './types';

/** R = A / 167 × 2.25 — the simulation apartment-equivalents. */
export function apartmentEquivalents(landAreaSqm: number, config: ProjectConfig): number {
  const area = Math.max(0, Number(landAreaSqm) || 0);
  return (area / config.rights.originalAreaSqm) * config.rights.apartmentEquivalents;
}

export function calculateRights(landAreaSqm: number, config: ProjectConfig, lotId?: string): RightsInfo {
  const area = Math.max(0, Number(landAreaSqm) || 0);
  // Unknown lot → the default lot is assumed and flagged; an invalid lot id is an error, never silently replaced.
  if (lotId && !config.rights.lotIds.includes(lotId)) throw new Error(`מגרש לא מוכר: ${lotId}`);
  const lot = lotId || config.rights.defaultLotId;
  const table = computeTableRights(area, config.rights.tableVersion, lot, config.taxation.bettermentLevyRate * 100);
  return {
    landAreaSqm: area,
    lotAssumed: !lotId,
    apartmentEquivalents: apartmentEquivalents(area, config),
    sqmPerRight: config.rights.originalAreaSqm / config.rights.apartmentEquivalents,
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
