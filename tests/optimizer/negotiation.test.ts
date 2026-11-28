/**
 * V1 Milestone C4 (spec §3.5): the terms to request, each with what makes it plausible to the developer — a modelled
 * hurdle, never an offer.
 */
import { describe, expect, it } from 'vitest';
import { PROJECT_CONFIG as C } from '../../src/data/config';
import { analyzeProfile } from '../../src/optimizer/analyze';
import { termsToRequest } from '../../src/optimizer/negotiation';
import { profile, TERMS } from '../fixtures/profiles';

const run = (p: ReturnType<typeof profile>) => {
  const d = analyzeProfile(p, TERMS, C);
  return { d, t: termsToRequest(d, p, TERMS, C) };
};

describe('terms to request', () => {
  it('covers the minimum %, tax contributions, interest, timing and conditional financing where they apply', () => {
    const { t } = run(profile({ availableCapital: 300_000, maxMonthlyRepayment: 5000 }));
    const ids = t.items.map((x) => x.id);
    for (const id of ['taxes', 'financing']) expect(ids).toContain(id);
    expect(t.items.length).toBeGreaterThanOrEqual(3);
  });
  it('every item says what it is worth to the owner and what it costs the developer, labelled as modelled', () => {
    const { t } = run(profile({ availableCapital: 800_000, maxMonthlyRepayment: 8000 }));
    for (const x of t.items) {
      expect(x.ask.length).toBeGreaterThan(5);
      expect(['plausible', 'unlikely', 'unknown']).toContain(x.plausibility);
      expect(x.basis).toBe('modelled');
    }
    expect(t.note).toContain('לא הצעה');
  });
  it('the minimum % is judged on the same route’s own lot margin at that % (not a baseline)', () => {
    for (const p of [profile({ availableCapital: 300_000, maxMonthlyRepayment: 5000 }), profile({ availableCapital: 800_000, maxMonthlyRepayment: 8000 })]) {
      const { t } = run(p);
      const min = t.items.find((x) => x.id === 'min_pct');
      if (!min || min.value === null) continue;
      expect(min.developerMargin).not.toBeNull();
      expect(min.plausibility).toBe(min.developerMargin! >= C.developer.targetMarginOnRevenue - 1e-9 ? 'plausible' : 'unlikely');
    }
  });
  it('a tax contribution’s developer cost comes from re-evaluating the same route on both sides', () => {
    const { t } = run(profile({ availableCapital: 800_000, maxMonthlyRepayment: 8000 }));
    const tax = t.items.find((x) => x.id === 'taxes');
    if (tax) {
      expect(tax.ownerGain).not.toBeNull();
      expect(tax.developerCost).not.toBeNull();
    }
  });
});
