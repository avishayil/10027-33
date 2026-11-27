/**
 * Lot-level developer P&L (iteration 6): the whole lot on the offer's terms, month by month — construction, public
 * buildings, the owners' taxes the developer bears on their dates, presales and delivery revenue, developer equity
 * and an escort loan. Replaces the per-owner standalone P&L for the developer panel, the equivalent % and the
 * viable %. Indicative: a model warning signal, not a statement about a real developer.
 */
import { describe, expect, it } from 'vitest';
import { PROJECT_CONFIG as C } from '../../src/data/config';
import { withArrangement } from '../../src/domain/arrangements';
import { lotDeveloperPnL, lotViablePct } from '../../src/domain/lotDeveloper';
import { lotPolicy } from '../../src/domain/policy';
import { calculateRights } from '../../src/domain/rights';
import { analyzeProfile } from '../../src/optimizer/analyze';
import { developerEquivalentPct } from '../../src/optimizer/arrangementEquivalence';
import { MODERATE, TERMS } from '../fixtures/profiles';

const info = calculateRights(167, C);
const ctx = { info, profile: MODERATE, config: C };

describe('lot-level developer P&L', () => {
  const p = lotDeveloperPnL(ctx, 'mixed', 0.35);
  it('covers the lot’s units: services quota, owners’ combination units and the developer’s units for sale', () => {
    expect(p.units).toBe(lotPolicy(info, C).lotUnits);
    expect(p.servicesUnits).toBeCloseTo(C.developerPolicy.servicesCapShareOfLot * p.units, 9);
    expect(p.ownerCombinationUnits + p.developerUnits).toBeCloseTo(p.units - p.servicesUnits, 9);
    expect(p.ownerCombinationUnits).toBeCloseTo(0.35 * (p.units - p.servicesUnits), 9);
  });
  it('profit = revenue − costs − financing; financing is positive', () => {
    expect(p.financingCost).toBeGreaterThan(0);
    expect(p.profit).toBeCloseTo(p.revenue - p.costs - p.financingCost, 4);
    expect(p.margin).toBeCloseTo(p.profit / p.revenue, 12);
    expect(p.peakEquity).toBeGreaterThan(0);
  });
  it('the margin falls as the owners’ share rises', () => {
    expect(lotDeveloperPnL(ctx, 'mixed', 0.3).margin).toBeGreaterThan(p.margin);
    expect(lotDeveloperPnL(ctx, 'mixed', 0.4).margin).toBeLessThan(p.margin);
  });
  it('taxes the developer bears make the same % less profitable', () => {
    expect(lotDeveloperPnL(ctx, 'net', 0.35).profit).toBeLessThan(lotDeveloperPnL(ctx, 'mixed', 0.35).profit);
    expect(lotDeveloperPnL(ctx, 'gross', 0.35).profit).toBeGreaterThan(lotDeveloperPnL(ctx, 'mixed', 0.35).profit);
  });
});

describe('viable % and equivalent % on the lot model', () => {
  it('the viable % leaves the developer its target margin', () => {
    const v = lotViablePct(ctx, 'mixed');
    if (v !== null) expect(lotDeveloperPnL(ctx, 'mixed', v).margin).toBeCloseTo(C.developer.targetMarginOnRevenue, 4);
  });
  it('the equivalent % holds the lot profit; net below, gross above', () => {
    const net = developerEquivalentPct(ctx, 'mixed', 0.35, 'net')!;
    const gross = developerEquivalentPct(ctx, 'mixed', 0.35, 'gross')!;
    expect(net).toBeLessThan(0.35);
    expect(gross).toBeGreaterThan(0.35);
    expect(lotDeveloperPnL(ctx, 'net', net).profit).toBeCloseTo(lotDeveloperPnL(ctx, 'mixed', 0.35).profit, -2);
  });
  it('each arrangement outcome reports its viable %', () => {
    const d = analyzeProfile(MODERATE, TERMS, C);
    for (const a of d.arrangements) expect(a).toHaveProperty('viablePct');
  });
  it('combination routes take their commercial certainty from the lot P&L', () => {
    const d = analyzeProfile(MODERATE, TERMS, withArrangement(C, 'mixed'));
    const s02 = d.results.find((r) => r.id === 'S02')!;
    expect(s02.developerMargin).toBeCloseTo(lotDeveloperPnL(ctx, 'mixed', 0.35).margin, 9);
  });
});
