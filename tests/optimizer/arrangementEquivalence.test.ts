/**
 * A developer who takes on taxes offers a lower combination %. Two different questions:
 *  - developer-equivalent %: the % under another arrangement that leaves the developer the same profit
 *    (what to expect it to offer);
 *  - owner break-even %: the % under another arrangement that leaves the owner as well off — apartments received
 *    minus the taxes the owner pays, each carried to delivery at the tax-loan rate (what is still worth accepting).
 */
import { describe, expect, it } from 'vitest';
import { PROJECT_CONFIG as C } from '../../src/data/config';
import { calculateRights } from '../../src/domain/rights';
import { developerEquivalentPct, ownerBreakEvenPct, ownerCombinationValue } from '../../src/optimizer/arrangementEquivalence';
import { withArrangement } from '../../src/domain/arrangements';
import { analyzeProfile } from '../../src/optimizer/analyze';
import { NO_TAX_LOAN } from '../fixtures/configs';
import { MODERATE, TERMS } from '../fixtures/profiles';

const ctx = { info: calculateRights(167, C), profile: MODERATE, config: C };

describe('developer-equivalent combination %', () => {
  it('is the identity for the same arrangement', () => {
    expect(developerEquivalentPct(ctx, 'mixed', 0.35, 'mixed')!).toBeCloseTo(0.35, 6);
  });

  it('net < mixed < gross: taking on taxes is paid for with a lower %', () => {
    const net = developerEquivalentPct(ctx, 'mixed', 0.35, 'net')!;
    const gross = developerEquivalentPct(ctx, 'mixed', 0.35, 'gross')!;
    expect(net).toBeLessThan(0.35);
    expect(gross).toBeGreaterThan(0.35);
  });

  it('round-trips', () => {
    const net = developerEquivalentPct(ctx, 'mixed', 0.35, 'net')!;
    expect(developerEquivalentPct(ctx, 'net', net, 'mixed')!).toBeCloseTo(0.35, 5);
  });
});

describe('owner break-even combination %', () => {
  it('is the identity for the same arrangement', () => {
    expect(ownerBreakEvenPct(ctx, 'mixed', 0.35, 'mixed')!).toBeCloseTo(0.35, 6);
  });

  it('net < mixed < gross', () => {
    expect(ownerBreakEvenPct(ctx, 'mixed', 0.35, 'net')!).toBeLessThan(0.35);
    expect(ownerBreakEvenPct(ctx, 'mixed', 0.35, 'gross')!).toBeGreaterThan(0.35);
  });

  it('owner value = apartments received − owner taxes carried to delivery at the tax-loan rate', () => {
    const R = ctx.info.apartmentEquivalents;
    // Net: the owner pays nothing → value is the apartments alone.
    expect(ownerCombinationValue(ctx, 'net', 0.3)).toBeCloseTo(0.3 * R * 2_500_000, 4);
    expect(ownerCombinationValue(ctx, 'mixed', 0.3)).toBeLessThan(0.3 * R * 2_500_000);
  });

  it('equal owner value at the break-even', () => {
    const be = ownerBreakEvenPct(ctx, 'mixed', 0.35, 'net')!;
    expect(ownerCombinationValue(ctx, 'net', be)).toBeCloseTo(ownerCombinationValue(ctx, 'mixed', 0.35), 0);
  });
});

describe('the decision engine compares arrangements at their equivalent %', () => {
  it('each arrangement outcome carries the % it was evaluated at and the owner break-even', () => {
    const d = analyzeProfile(MODERATE, TERMS, C);
    const by = (a: string) => d.arrangements.find((x) => x.arrangement === a)!;
    expect(by('mixed').combinationPct).toBe(0.35);
    expect(by('mixed').ownerBreakEvenPct).toBe(0.35);
    expect(by('net').combinationPct).toBeCloseTo(developerEquivalentPct(ctx, 'mixed', 0.35, 'net')!, 9);
    expect(by('net').ownerBreakEvenPct).toBeCloseTo(ownerBreakEvenPct(ctx, 'mixed', 0.35, 'net')!, 9);
    expect(by('gross').combinationPct).toBeGreaterThan(0.35);
  });

  it('an offer entered as net is the headline; mixed and gross are derived from it', () => {
    const d = analyzeProfile(MODERATE, { ...TERMS, combinationPct: 0.3 }, withArrangement(C, 'net'));
    const by = (a: string) => d.arrangements.find((x) => x.arrangement === a)!;
    expect(by('net').combinationPct).toBe(0.3);
    expect(by('mixed').combinationPct).toBeGreaterThan(0.3);
  });

  it('a direction conditional on other tax terms states the (lower) % it assumes', () => {
    const base = { landAreaSqm: 167, availableCapital: 0, maxMonthlyRepayment: 5000, goal: 'balanced' as const, lotId: '150', soleHome: true };
    const d = analyzeProfile(base, { combinationPct: 0.325, developerMarkup: 0.175 }, NO_TAX_LOAN);
    const c = d.conditionalRecommendation!;
    expect(c).not.toBeNull();
    expect(c.combinationPct).toBeLessThan(0.325);
  });
});
