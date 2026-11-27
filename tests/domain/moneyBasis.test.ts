/** Iteration 9 / F04: one money basis — today's-price amounts become nominal shekels on their date, once. */
import { describe, expect, it } from 'vitest';
import { PROJECT_CONFIG as C } from '../../src/data/config';
import { simulateCashflow, type SimulationInput } from '../../src/domain/cashflow';
import type { CashEvent, TransactionPlan } from '../../src/domain/types';
import { transactionValueOf } from '../../src/optimizer/evaluate';

const base = (events: CashEvent[], over: Partial<SimulationInput> = {}) =>
  simulateCashflow({
    events,
    startingCash: 0,
    annualRate: 0,
    mortgageYears: 25,
    alternativeReturn: 0,
    permitMonth: 24,
    completionMonth: 60,
    horizonMonth: 120,
    liquidityMonth: 24,
    monthlyNetRent: 0,
    rentCountsForRepayment: false,
    inflation: 0.02,
    ...over,
  });

describe('cash flow on one nominal basis', () => {
  it('₪1M of tax in today’s prices due at year 5 needs ₪1,104,081 of cash on that date', () => {
    const s = base([{ month: 60, amount: -1_000_000, label: 'מס', category: 'capital_gains_tax', priceBasis: 'real' }]);
    expect(s.unfunded).toBeCloseTo(1_000_000 * 1.02 ** 5, 0);
  });
  it('a nominal (indexed) amount is used as is', () => {
    const s = base([{ month: 60, amount: -1_000_000, label: 'מס', category: 'capital_gains_tax', priceBasis: 'nominal' }]);
    expect(s.unfunded).toBeCloseTo(1_000_000, 6);
  });
  it('zero inflation leaves every amount unchanged', () => {
    const s = base([{ month: 60, amount: -1_000_000, label: 'מס', category: 'capital_gains_tax', priceBasis: 'real' }], { inflation: 0 });
    expect(s.unfunded).toBeCloseTo(1_000_000, 6);
  });
  it('borrow ₪100K at 0% and repay it in full: financing value 0 at zero rates; nothing left', () => {
    const s = base(
      [
        { month: 30, amount: -100_000, label: 'בנייה', category: 'construction', priceBasis: 'nominal' },
        { month: 40, amount: 100_000, label: 'תקבול', category: 'fraction_settlement', priceBasis: 'nominal' },
      ],
      { inflation: 0, discountRate: 0 },
    );
    expect(s.totalDrawn).toBeCloseTo(100_000, 6);
    expect(s.debtAtHorizon).toBeCloseTo(0, 6);
    expect(s.pvFinancing).toBeCloseTo(0, 6);
  });
});

describe('valuation deflates once', () => {
  const plan = (priceBasis: 'real' | 'nominal') =>
    ({
      ledger: [{ category: 'capital_gains_tax', label: 'מס', amount: 1_000_000, direction: 'out', month: 60, payer: 'owner', priceBasis }],
      wholeApartmentValueEq: 0,
      fractionalShare: 0,
      completionMonth: 60,
      heldLandValueAtHorizon: 0,
      deferredLiabilities: 0,
    }) as unknown as TransactionPlan;
  const cfg = { ...C, analysis: { ...C.analysis, discountRate: 0.03, inflation: 0.02 } };
  it('real ₪1M at year 5 → ₪1M / 1.03⁵; nominal ₪1M → ₪1M / (1.03 × 1.02)⁵', () => {
    expect(-transactionValueOf(plan('real'), cfg)).toBeCloseTo(1_000_000 / 1.03 ** 5, 0);
    expect(-transactionValueOf(plan('nominal'), cfg)).toBeCloseTo(1_000_000 / (1.03 * 1.02) ** 5, 0);
  });
});
