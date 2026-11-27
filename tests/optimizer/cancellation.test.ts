/** Iteration 9 / D3: contract states — approval delayed, developer failure during construction. */
import { describe, expect, it } from 'vitest';
import { PROJECT_CONFIG as C } from '../../src/data/config';
import { analyzeProfile } from '../../src/optimizer/analyze';
import { failureMonthOf } from '../../src/optimizer/evaluate';
import { profile, TERMS } from '../fixtures/profiles';

const d = analyzeProfile(profile({ availableCapital: 800_000, maxMonthlyRepayment: 8000 }), TERMS, C);

describe('developer failure half-way through construction', () => {
  it('pays-in counted up to the failure month; protected = interest; unprotected = payments + interest', () => {
    for (const r of d.results) {
      const f = r.developerFailure;
      expect(f.month).toBe(failureMonthOf(C, r.plan.completionMonth));
      const paid = r.ledger
        .filter((e) => e.payer === 'owner' && e.direction === 'out' && !e.deferred && e.month <= f.month && (e.category === 'construction' || e.category === 'completion_payment'))
        .reduce((s, e) => s + e.amount, 0);
      expect(f.paidToDeveloper).toBeCloseTo(paid, 4);
      expect(f.protected).toBeCloseTo(f.interest, 9);
      expect(f.unprotected).toBeCloseTo(f.paidToDeveloper + f.interest, 9);
      expect(f.debtOutstanding).toBeGreaterThanOrEqual(0);
    }
  });
  it('full combination: nothing paid to the developer for building', () => {
    expect(d.results.find((r) => r.id === 'S02')!.developerFailure.paidToDeveloper).toBe(0);
  });
});

describe('approval delayed two years', () => {
  it('computed for the routes shown, not for every route', () => {
    const shown = [d.recommendation, ...d.alternatives].filter(Boolean);
    for (const r of shown) expect(r!.delayedApproval).not.toBeNull();
    expect(d.results.some((r) => r.delayedApproval === null)).toBe(true);
  });
  it('a later delivery is worth less in today’s value (no price growth assumed)', () => {
    const r = d.recommendation!;
    expect(r.delayedApproval!.months).toBe(24);
    expect(r.delayedApproval!.valueChange).toBeLessThan(0);
  });
});
