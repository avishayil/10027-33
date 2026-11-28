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
        // Today's prices (iteration 10): nominal (indexed) payments deflated on their dates.
        .reduce((s, e) => s + (e.priceBasis === 'nominal' ? e.amount * Math.pow(1 + C.analysis.inflation, -e.month / 12) : e.amount), 0);
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

describe('V1 / MH-13: the no-approval outcome separates reserves, refunds, assets kept, taxes and real expenses', () => {
  const profiles = [
    profile({ availableCapital: 800_000, maxMonthlyRepayment: 8000 }),
    profile({ availableCapital: 2_000_000, maxMonthlyRepayment: 15_000 }),
    profile({ landAreaSqm: 125.25, availableCapital: 1_500_000, maxMonthlyRepayment: 12_000 }),
  ];
  const results = profiles.flatMap((p) => analyzeProfile(p, TERMS, C).results);
  it('payments before approval = refundable advances + taxes + non-refundable costs + rights bought', () => {
    for (const r of results) {
      const n = r.noApproval;
      expect(n.refundableAdvances + n.taxesPaid + n.nonRefundableCosts + n.assetsKept).toBeCloseTo(n.advances, 4);
      expect(n.realExpenses).toBeCloseTo(n.nonRefundableCosts + n.interest, 6);
    }
  });
  it('rights bought before approval are reported as an asset kept — but never credited: maximum exposure values them at zero', () => {
    const buying = results.filter((r) => r.noApproval.assetsKept > 1);
    expect(buying.length).toBeGreaterThan(0);
    for (const r of buying) {
      const n = r.noApproval;
      expect(n.unprotected).toBeCloseTo(n.advances + n.interest, 4);
      expect(n.assetsKept).toBeCloseTo(n.purchasedRights, 9);
      // Without them, the loss is what is gone or refundable only by contract.
      expect(n.unprotected - n.assetsKept).toBeCloseTo(n.realExpenses + n.refundableAdvances + n.taxesPaid, 4);
    }
  });
  it('the reserve is the owner’s liquidity, reported apart and never a loss', () => {
    for (const r of results) {
      expect(r.noApproval.reserves).toBeGreaterThanOrEqual(0);
      expect(r.noApproval.unprotected).toBeLessThanOrEqual(r.noApproval.advances + r.noApproval.interest + 1e-6);
    }
  });
  it('developer failure: paid-in, interest, debt and the land kept are reported apart', () => {
    for (const r of results) {
      const f = r.developerFailure;
      expect(f.realExpenses).toBeCloseTo(f.interest, 9);
      expect(f.refundableIfGuaranteed).toBeCloseTo(f.paidToDeveloper, 9);
    }
  });
});
