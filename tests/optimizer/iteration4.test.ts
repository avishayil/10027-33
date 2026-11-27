/**
 * Iteration-4 fixtures (review of de1e4d7). Expected values computed independently in the test.
 * Levy = allocation-table proxy, not an assessment.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { PROJECT_CONFIG as C } from '../../src/data/config';
import { LAND_TRANSACTIONS } from '../../src/data/evidence';
import { calculateRights } from '../../src/domain/rights';
import type { Goal } from '../../src/domain/types';
import { analyzeProfile } from '../../src/optimizer/analyze';
import { GROSS, NET } from '../fixtures/configs';
import { MODERATE, TERMS, profile } from '../fixtures/profiles';

const incoming = (A: number) => (25_521_300 * A) / 21_258;
const outgoing = { '149': 30_360_000 * 0.02353, '150': 30_360_000 * 0.02353, '153': 30_210_000 * 0.02365 };

describe('betterment levy proxy — exact per lot and holding', () => {
  it('167 m²: incoming 200,491.91, outgoing 714,370.80 / 714,466.50, levy 256,939.44 / 256,987.29', () => {
    expect(incoming(167)).toBeCloseTo(200_491.9136, 3);
    for (const lot of ['149', '150', '153'] as const) {
      const r = calculateRights(167, C, lot);
      expect(r.table.incomingValue).toBeCloseTo(incoming(167), 3);
      expect(r.table.allocationValue).toBeCloseTo(outgoing[lot], 3);
      expect(r.bettermentLevy).toBeCloseTo((outgoing[lot] - incoming(167)) / 2, 3);
    }
    expect(calculateRights(167, C, '149').bettermentLevy).toBeCloseTo(256_939.4432, 3);
    expect(calculateRights(167, C, '153').bettermentLevy).toBeCloseTo(256_987.2932, 3);
    expect(calculateRights(167, C, '149').table.units).toBeCloseTo(2.40006, 5);
    expect(calculateRights(167, C, '150').table.units).toBeCloseTo(2.25888, 5);
  });

  it('scales linearly: 83.5 m² is half, 334 m² double', () => {
    const base = calculateRights(167, C, '149').bettermentLevy;
    expect(calculateRights(83.5, C, '149').bettermentLevy).toBeCloseTo(base / 2, 6);
    expect(calculateRights(334, C, '149').bettermentLevy).toBeCloseTo(base * 2, 6);
  });

  it('unknown lot → lot 149 assumed and flagged, levy shown as a range; an invalid lot is an error', () => {
    const d = analyzeProfile(MODERATE, TERMS, C);
    expect(d.lotAssumed).toBe(true);
    expect(d.levyRangeAcrossLots.min).toBeCloseTo(256_939.4432, 3);
    expect(d.levyRangeAcrossLots.max).toBeCloseTo(256_987.2932, 3);
    expect(analyzeProfile(profile({ lotId: '153' }), TERMS, C).lotAssumed).toBe(false);
    expect(() => calculateRights(167, C, '44')).toThrow();
  });
});

describe('who pays the levy — allocations reconcile to the proxy', () => {
  const L = 256_939.4432;
  const rich = profile({ availableCapital: 3_000_000, maxMonthlyRepayment: 30000 });
  const byId = (cfg: typeof C, id: string) => analyzeProfile(rich, TERMS, cfg).results.find((r) => r.id === id)!;

  it('combination: gross → owner pays all; mixed / net → the developer (contractually)', () => {
    const g = byId(GROSS, 'S02').levy;
    expect(g.total).toBeCloseTo(L, 3);
    expect(g.owner).toBeCloseTo(L, 3);
    expect(g.developer).toBe(0);
    for (const cfg of [C, NET]) {
      const m = byId(cfg, 'S02').levy;
      expect(m.owner).toBe(0);
      expect(m.developer).toBeCloseTo(L, 3);
    }
  });

  it('S11 (35%, one apartment): owner ≈ ₪37,333 on the built share, developer ≈ ₪219,606', () => {
    const s = byId(C, 'S11-1').levy;
    const built = (1 - 2.25 * 0.35) / 0.65;
    expect(s.owner).toBeCloseTo((L * built) / 2.25, 3);
    expect(Math.round(s.owner)).toBe(37_333);
    expect(Math.round(s.developer)).toBe(219_606);
    expect(s.owner + s.developer).toBeCloseTo(L, 3);
  });

  it('partial sale + build one: the owner pays it all — ≈ ₪142,744 on the sold rights, ≈ ₪114,195 on the built one', () => {
    const r = byId(C, 'S05-1');
    const levyEntries = r.ledger.filter((e) => e.category === 'betterment_levy' && e.payer === 'owner');
    const sold = levyEntries.find((e) => e.saleRelated)!.amount;
    const built = levyEntries.find((e) => !e.saleRelated)!.amount;
    expect(Math.round(sold)).toBe(142_744);
    expect(Math.round(built)).toBe(114_195);
    expect(r.levy.owner).toBeCloseTo(L, 3);
  });

  it('a pre-approval sale transfers the future exposure to the buyer — not "zero levy"', () => {
    const s = byId(C, 'S01M').levy;
    expect(s.owner).toBe(0);
    expect(s.buyer).toBeCloseTo(L, 3);
  });
});

describe('evidence first', () => {
  it('the transaction registry keeps the parcel-33 sample and dates; the latest is 16.04.2026, before the update', () => {
    const p33 = LAND_TRANSACTIONS.filter((t) => t.parcel === 33);
    expect(p33).toHaveLength(11);
    expect([...p33].sort((a, b) => b.date.localeCompare(a.date))[0]).toMatchObject({ date: '2026-04-16', price: 300000 });
  });

  it('land references: dated history and appraisal anchors; current market price and developer offer unknown', () => {
    const d = analyzeProfile(MODERATE, TERMS, C);
    const ref = (s: string) => d.landReferences.find((l) => l.label.includes(s))!;
    expect(ref('האחרונה').amount).toBeCloseTo(300_000, 6);
    expect(ref('שווי הזכויות בטבלת').amount).toBeCloseTo(714_370.8, 3);
    expect(ref('פחות אומדן היטל').amount).toBeCloseTo(457_431.3568, 3);
    expect(ref('בשוק החופשי היום').amount).toBeNull();
    expect(ref('שיזם מציע').amount).toBeNull();
  });

  it('no route that depends on an unverified price is ever ranked or recommended (property)', () => {
    const goals: Goal[] = ['balanced', 'maximize_apartments', 'passive_income', 'immediate_cash', 'minimize_risk'];
    fc.assert(
      fc.property(
        fc.double({ min: 30, max: 700, noNaN: true }),
        fc.integer({ min: 0, max: 3_000_000 }),
        fc.constantFrom(0, 5000, 15000, null),
        fc.constantFrom(...goals),
        (area, cap, P, goal) => {
          const d = analyzeProfile({ landAreaSqm: area, availableCapital: cap, maxMonthlyRepayment: P, goal }, TERMS, C);
          for (const r of d.ranked) expect(r.priceDependency).toBeNull();
          for (const p of d.priceConditional) expect(p.result.priceDependency).not.toBeNull();
        },
      ),
      { numRuns: 15 },
    );
  });

  it('when no evidence-based route fits, the closest routes come with the extra capital they need', () => {
    const d = analyzeProfile(MODERATE, TERMS, C); // ₪300K: owner tax at approval exceeds the cash under a mixed deal
    expect(d.recommendation).toBeNull();
    expect(d.nearMiss.length).toBeGreaterThan(0);
    // With 0% return on cash, the extra capital needed equals the unfunded obligation exactly.
    for (const n of d.nearMiss) {
      expect(n.additionalCapital).not.toBeNull();
      expect(n.additionalCapital!).toBeCloseTo(n.result.simulation.unfunded, -1);
    }
    expect(d.nearMiss[0].result.id).toBe('S11-1');
    expect(d.nearMiss[0].additionalCapital!).toBeLessThan(20_000);
  });

  it('developer P&L includes the lot’s public-building obligation (325 m² × ₪8,000 × lot share)', () => {
    const r = analyzeProfile(profile({ availableCapital: 1_500_000, maxMonthlyRepayment: 15000 }), TERMS, C).results.find((x) => x.id === 'S02')!;
    const line = r.developerPnL!.lines.find((l) => l.label.includes('מבני הציבור'))!;
    expect(line.amount).toBeCloseTo(-0.02353 * 325 * 8000, 6);
  });
});
