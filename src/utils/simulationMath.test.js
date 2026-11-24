import { describe, expect, it } from 'vitest';
import { computeSimulationTracks, computeTableRights, parseParcelFraction } from './simulationMath';
import { DEFAULT_CONFIG } from '../hooks/useSimulation';

describe('computeTableRights — anchors from the published tables', () => {
  it('v2, lot 149, 167 m² matches the printed rights value', () => {
    const r = computeTableRights(167, 'v2', '149');
    expect(Math.abs(r.allocationValue - 714371)).toBeLessThan(2);
    expect(r.units).toBeCloseTo(2.4, 2);
    expect(Math.abs(r.incomingValue - 200492)).toBeLessThan(1);
    expect(r.lotShare).toBeCloseTo(0.02353, 6);
  });

  it('v2, lot 153, 167 m²', () => {
    const r = computeTableRights(167, 'v2', '153');
    expect(Math.abs(r.allocationValue - 714467)).toBeLessThan(2);
    expect(r.units).toBeCloseTo(2.365, 3);
  });

  it('v1, lot 44, 167 m² (deposited version)', () => {
    const r = computeTableRights(167, 'v1', '44');
    expect(r.allocationValue).toBeCloseTo(727290, 0);
    expect(r.units).toBeCloseTo(1.44, 6);
    expect(Math.abs(r.incomingValue - 199458)).toBeLessThan(1);
  });

  it('betterment levy is the given rate of the value increase', () => {
    const r = computeTableRights(167, 'v2', '149', 50);
    expect(r.bettermentLevy).toBeCloseTo((r.allocationValue - r.incomingValue) / 2, 6);
    expect(computeTableRights(167, 'v2', '149', 0).bettermentLevy).toBe(0);
  });

  it('scales linearly with area and handles 0', () => {
    const a = computeTableRights(167, 'v2', '150');
    const b = computeTableRights(334, 'v2', '150');
    expect(b.units).toBeCloseTo(a.units * 2, 9);
    expect(computeTableRights(0, 'v2', '150').sqmPerUnit).toBe(0);
  });
});

describe('parseParcelFraction', () => {
  it('converts a parcel fraction to m²', () => {
    expect(parseParcelFraction('167/21258')).toBeCloseTo(167, 9);
    expect(parseParcelFraction(' 167 / 42516 ')).toBeCloseTo(83.5, 9);
  });

  it.each(['', '167', '1/0', 'a/b', '1/2/3', '30000/21258', '/5'])('rejects %s', (input) => {
    expect(() => parseParcelFraction(input)).toThrow();
  });
});

describe('computeSimulationTracks', () => {
  const tracks = (version, lot, area = 167, config = DEFAULT_CONFIG) =>
    computeSimulationTracks(area, computeTableRights(area, version, lot, config.bettermentLevyPct), config);

  it('cash exit gross value depends on land area, not the unit count', () => {
    const v1 = tracks('v1', '44');
    const v2 = tracks('v2', '149');
    expect(v1.cashExit.grossLandValue).toBe(v2.cashExit.grossLandValue);
    expect(v2.cashExit.grossLandValue).toBe(167 * DEFAULT_CONFIG.landValuePerSqm);
  });

  it('cash exit deducts the per-owner levy, developer profit and tax', () => {
    const t = tracks('v2', '149');
    const r = computeTableRights(167, 'v2', '149');
    const before = t.cashExit.grossLandValue * (1 - DEFAULT_CONFIG.entrepreneurProfitMargin / 100) - r.bettermentLevy;
    expect(t.cashExit.amountBeforeTax).toBeCloseTo(before, 6);
    expect(t.cashExit.netCashAmount).toBeCloseTo(before * (1 - DEFAULT_CONFIG.capitalGainsTax / 100), 6);
  });

  it('combination gives combinationPct of the table units', () => {
    const t = tracks('v2', '149');
    expect(t.combination.finishedUnits).toBeCloseTo(t.units * 0.35, 9);
    expect(t.combination.soldValue).toBeCloseTo(167 * 0.65 * DEFAULT_CONFIG.landValuePerSqm, 6);
  });

  it('cost-plus adds the levy once, not per unit', () => {
    const t = tracks('v2', '149');
    const r = computeTableRights(167, 'v2', '149');
    expect(t.costPlus.totalEquityRequired).toBeCloseTo(t.costPlus.buildCostPerUnit * t.units + r.bettermentLevy, 6);
    expect(t.costPlus.costPerUnit * t.units).toBeCloseTo(t.costPlus.totalEquityRequired, 6);
  });

  it('m²/unit override replaces the table unit count', () => {
    const t = tracks('v2', '149', 220, { ...DEFAULT_CONFIG, sqmPerUnitOverride: 110 });
    expect(t.units).toBe(2);
    expect(t.isOverridden).toBe(true);
    expect(tracks('v2', '149').isOverridden).toBe(false);
  });
});
