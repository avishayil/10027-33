/**
 * Iteration 10 / I6 (review of c689d0b, §F2 and §F5): the concession efficiency frontier and feasibility explanations.
 * Each concession is the same route re-evaluated on both sides under the changed contract.
 */
import { describe, expect, it } from 'vitest';
import { PROJECT_CONFIG as C } from '../../src/data/config';
import { concessionFrontier, efficiency, explainFeasibility } from '../../src/optimizer/concessions';
import { snapshotsFor, type ContractTerms } from '../../src/optimizer/contract';
import { calculateRights } from '../../src/domain/rights';
import { profile, TERMS } from '../fixtures/profiles';

const OFFER = { levyCap: null, developerPaysTaxLoanInterest: false };
const K = (over: Partial<ContractTerms> = {}): ContractTerms => ({ arrangement: 'gross', combinationPct: 0.35, markup: TERMS.developerMarkup, offer: OFFER, funding: 'none', ...over });

describe('efficiency', () => {
  it('₪30K owner benefit for ₪20K developer PV cost → 1.5', () => expect(efficiency(30_000, 20_000)).toBeCloseTo(1.5, 12));
  it('no ratio when it costs the developer nothing (or it gains)', () => {
    expect(efficiency(30_000, 0)).toBeNull();
    expect(efficiency(30_000, -5)).toBeNull();
  });
});

describe('the concession frontier', () => {
  const p = profile({ availableCapital: 800_000, maxMonthlyRepayment: 8000 });
  const f = concessionFrontier(p, K(), C, 'S02');
  const base = snapshotsFor(p, K(), C).find((s) => s.routeId === 'S02')!;
  it('covers the levy, all taxes, the tax-loan interest, +1 point and payment timing', () => {
    expect(f.rows.map((r) => r.id).sort()).toEqual(['interest', 'levy', 'net_taxes', 'payment_timing', 'plus_1pp'].sort());
  });
  it('+1 point: re-evaluated on both sides (owner gains, developer PV falls)', () => {
    const r = f.rows.find((x) => x.id === 'plus_1pp')!;
    const k1 = snapshotsFor(p, K({ combinationPct: 0.36 }), C).find((s) => s.routeId === 'S02')!;
    expect(r.ownerGain!).toBeCloseTo(k1.owner.value - base.owner.value, 6);
    // A uniform term: the lot-wide cost, and this owner's share of it (the holding's share of the lot).
    const lotCost = base.result.developerLot!.equityNpv - k1.result.developerLot!.equityNpv;
    expect(r.scope).toBe('lot');
    expect(r.developerCostLot!).toBeCloseTo(lotCost, 6);
    expect(r.developerCost!).toBeCloseTo(lotCost * calculateRights(167, C, '149').table.lotShare, 6);
    expect(r.ownerGain!).toBeGreaterThan(0);
    expect(r.developerCost!).toBeGreaterThan(0);
    expect(r.efficiency).toBeCloseTo(r.ownerGain! / r.developerCost!, 12);
  });
  it('owner-only concessions (interest, payment timing) are costed on this owner alone', () => {
    for (const id of ['interest', 'payment_timing'] as const) {
      const r = f.rows.find((x) => x.id === id)!;
      expect(r.scope).toBe('owner');
      expect(r.developerCostLot).toBeNull();
    }
  });
  it('the levy concession moves gross → mixed and is valued on the same route', () => {
    const r = f.rows.find((x) => x.id === 'levy')!;
    expect(r.applicable).toBe(true);
    expect(r.contract.arrangement).toBe('mixed');
    expect(r.ownerGain!).toBeGreaterThan(0);
  });
  it('the frontier holds only executable, non-dominated concessions', () => {
    for (const x of f.frontier) {
      expect(x.executable).toBe(true);
      for (const o of f.rows.filter((y) => y.executable && y.ownerGain !== null && y.developerCost !== null))
        expect(o.ownerGain! > x.ownerGain! && o.developerCost! < x.developerCost!).toBe(false);
    }
  });
  it('under a net deal the tax concessions do not apply', () => {
    const n = concessionFrontier(p, K({ arrangement: 'net' }), C, 'S02');
    expect(n.rows.find((x) => x.id === 'levy')!.applicable).toBe(false);
    expect(n.rows.find((x) => x.id === 'net_taxes')!.applicable).toBe(false);
  });
});

describe('feasibility explanations', () => {
  it('a household that cannot fund the taxes: a financing gap, with the concessions that close it jointly tested', () => {
    const p = profile({ availableCapital: 0, maxMonthlyRepayment: 0 });
    const e = explainFeasibility(p, K(), C, 'S02');
    expect(e.owner.ok).toBe(false);
    expect(e.binding.map((b) => b.kind)).toContain('financing_gap');
    for (const c of e.closingConcessions) {
      expect(c.executable).toBe(true);
      expect(c.developerOk).toBe(true);
    }
    expect(e.complete).toBe(false);
  });
  it('the developer below its hurdle is a contractual constraint, separate from financing', () => {
    const p = profile({ availableCapital: 2_000_000, maxMonthlyRepayment: 15_000 });
    const e = explainFeasibility(p, K({ arrangement: 'net' }), C, 'S02');
    expect(e.developer.ok).toBe(false);
    expect(e.binding.map((b) => b.kind)).toContain('developer_hurdle');
    expect(e.binding.map((b) => b.kind)).not.toContain('financing_gap');
  });
});
