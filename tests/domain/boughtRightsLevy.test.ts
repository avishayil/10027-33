/** Iteration 9 / F05: levy on complementary rights bought before the plan is approved. */
import { describe, expect, it } from 'vitest';
// Pinned to the simulation basis (2.25 rights per 167 m²): numbers reconciled on it (iteration 10).
import { C_SIM as C } from '../fixtures/configs';
import { calculateRights } from '../../src/domain/rights';
import { levyPerRight } from '../../src/domain/taxation';
import { analyzeProfile } from '../../src/optimizer/analyze';
import { profile, TERMS } from '../fixtures/profiles';

describe('bought rights carry their betterment levy', () => {
  const d = analyzeProfile(profile({ landAreaSqm: 125.25, availableCapital: 2_000_000, maxMonthlyRepayment: 15000 }), TERMS, C);
  const bought = d.results.filter((r) => r.plan.rightsPurchased > 0);
  it('there is at least one route that buys complementary rights', () => {
    expect(bought.length).toBeGreaterThan(0);
  });
  it('levy on the bought rights is on the buyer (owner), at the levy rate per right, once', () => {
    const unit = levyPerRight(calculateRights(125.25, C), C);
    for (const r of bought) {
      const owner = r.ledger.filter((e) => e.category === 'betterment_levy' && e.payer === 'owner' && e.label.includes('שנרכשו'));
      const seller = r.ledger.filter((e) => e.category === 'betterment_levy' && e.payer === 'seller');
      expect(owner).toHaveLength(1);
      expect(seller).toHaveLength(0);
      expect(owner[0].amount).toBeCloseTo(r.plan.rightsPurchased * unit, 4);
      expect(owner[0].range).toEqual({ low: 0, high: owner[0].amount });
    }
  });
  it('lot 149 proxy: 0.75 right ≈ ₪85.6K (₪114,195 per right)', () => {
    const unit = levyPerRight(calculateRights(167, C, '149'), C);
    expect(unit).toBeCloseTo(114_195, -2);
    expect(0.75 * unit).toBeCloseTo(85_646, -2);
  });
});

describe('iteration 9 / F07: a hypothetical offer price cannot move the evidence-based ranking', () => {
  it('doubling the unverified developer price leaves the ranking unchanged', () => {
    const p = profile({ availableCapital: 800_000, maxMonthlyRepayment: 8000 });
    const hi = { ...C, market: { ...C.market, developerRightsSaleScenario: { ...C.market.developerRightsSaleScenario, pricePerOriginalSqm: C.market.developerRightsSaleScenario.pricePerOriginalSqm * 2 } } };
    const a = analyzeProfile(p, TERMS, C);
    const b = analyzeProfile(p, TERMS, hi);
    expect(b.ranked.map((r) => r.id)).toEqual(a.ranked.map((r) => r.id));
    expect(b.recommendation?.id).toBe(a.recommendation?.id);
  });
});
