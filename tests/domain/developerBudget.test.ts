/**
 * Iteration 8 (review of cffb86d): an evidence-based developer construction budget — the plan's built areas per lot
 * (Table 5 of the plan provisions, appraisal pp.30–32) priced at the June 2026 construction-cost survey of the
 * Israeli Real Estate Appraisers Association (Sharon: tower ₪6,600 / underground ₪3,400 per licensed m²; balconies
 * 30–50% of the main rate). The owners' ₪11,000/m² construction-services price is unchanged.
 */
import { describe, expect, it } from 'vitest';
import { PROJECT_CONFIG as C } from '../../src/data/config';
import { getLot } from '../../src/data/parcel33';
import { developerBudget, lotDeveloperPnL } from '../../src/domain/lotDeveloper';
import { calculateRights } from '../../src/domain/rights';
import { analyzeProfile } from '../../src/optimizer/analyze';
import { MODERATE, profile, TERMS } from '../fixtures/profiles';

const info = calculateRights(167, C);
const ctx = { info, profile: MODERATE, config: C };

describe('plan areas per lot (Table 5)', () => {
  it('lot 149: 14,269 m² above, 4,770 m² below, 1,530 m² balconies, 11,209 m² saleable, 102 units, 20 floors', () => {
    const l = getLot(C.rights.tableVersion, '149');
    expect([l.aboveGroundArea, l.undergroundArea, l.balconyArea, l.residentialArea, l.units, l.floors]).toEqual([14269, 4770, 1530, 11209, 102, 20]);
    const l150 = getLot(C.rights.tableVersion, '150');
    expect([l150.aboveGroundArea, l150.undergroundArea, l150.balconyArea]).toEqual([13421, 4500, 1440]);
    const l153 = getLot(C.rights.tableVersion, '153');
    expect([l153.aboveGroundArea, l153.undergroundArea, l153.balconyArea]).toEqual([14045, 4680, 1500]);
  });
});

describe('developer budget', () => {
  it('direct cost = above × tower rate + below × underground rate + balconies × 40% of the main rate', () => {
    const b = developerBudget(C, '149');
    expect(b.direct).toBeCloseTo(14269 * 6600 + 4770 * 3400 + 1530 * 6600 * 0.4, 6);
    expect(b.perSaleableSqm).toBeCloseTo(b.direct / 11209, 9);
    expect(b.buildingClass).toBe('tower'); // 72 m, above 29 m
  });
  it('the lot model uses the budget and sells saleable area (not 100 m² × units)', () => {
    const p = lotDeveloperPnL(ctx, 'mixed', 0.35);
    const b = developerBudget(C, '149');
    expect(p.lines.find((l) => l.label.startsWith('בנייה ישירה'))!.amount).toBeCloseTo(-b.direct, 0);
    expect(p.saleableArea).toBe(11209);
  });
  it('an override per saleable m² replaces the budget (matrix / break-even rows)', () => {
    const cfg = { ...C, developer: { ...C.developer, directCostPerSqm: 9000 } };
    const p = lotDeveloperPnL({ ...ctx, config: cfg }, 'mixed', 0.35);
    expect(p.lines.find((l) => l.label.startsWith('בנייה ישירה'))!.amount).toBeCloseTo(-9000 * 11209, 0);
  });
  it('the owners’ services price stays ₪11,000/m² × (1 + markup)', () => {
    expect(C.construction.costPerSqm).toBe(11000);
  });
});

describe('physical inventory and the services quota (review §4)', () => {
  it('two smaller apartments remove exactly two physical apartments; the lot’s units are unchanged', () => {
    const d = analyzeProfile(profile({ landAreaSqm: 334, availableCapital: 1_500_000, maxMonthlyRepayment: 15000 }), TERMS, C);
    const r = d.results.find((x) => x.id === 'S13-3r+3r')!;
    expect(r.developerLot!.userPhysicalUnits).toBe(2);
    expect(r.developerLot!.units).toBe(102);
  });
  it('a user on construction services takes a quota slot instead of adding one beyond the quota', () => {
    const d = analyzeProfile(profile({ availableCapital: 1_500_000, maxMonthlyRepayment: 15000 }), TERMS, C);
    const s11 = d.results.find((x) => x.strategyType === 'S11')!;
    const quota = C.developerPolicy.servicesCapShareOfLot * 102;
    expect(s11.developerLot!.servicesUnits + s11.plan.apartmentsBuilt).toBeLessThanOrEqual(quota + 1e-9);
  });
  it('replacing a participant with an identical one leaves the lot unchanged', () => {
    const typical = profile({ availableCapital: 1_500_000, maxMonthlyRepayment: 15000 });
    const s02 = analyzeProfile(typical, TERMS, C).results.find((r) => r.id === 'S02')!;
    expect(s02.developerLot!.profit).toBeCloseTo(lotDeveloperPnL({ info, profile: typical, config: C }, 'mixed', 0.35).profit, 0);
  });
});
