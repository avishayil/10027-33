/** Iteration 9 / C: developer returns, stresses and unbudgeted-cost headroom — internal consistency, not market facts. */
import { describe, expect, it } from 'vitest';
import { PROJECT_CONFIG as C } from '../../src/data/config';
import { annualIrr, developerStress, financeFlows, lotDeveloperPnL } from '../../src/domain/lotDeveloper';
import { calculateRights } from '../../src/domain/rights';
import { MODERATE } from '../fixtures/profiles';

const ctx = { info: calculateRights(167, C, '149'), profile: MODERATE, config: C };

describe('equity IRR', () => {
  it('−100 now and +112.68 in 12 months ≈ 12.68% a year (1% a month)', () => {
    const f = new Array(13).fill(0);
    f[0] = -100;
    f[12] = 100 * 1.01 ** 12;
    expect(annualIrr(f)!).toBeCloseTo(1.01 ** 12 - 1, 6);
  });
  it('no sign change → null', () => {
    expect(annualIrr([1, 2, 3])).toBeNull();
    expect(annualIrr([-1, -2])).toBeNull();
  });
  it('equity flows conserve: Σ equity flows = Σ project flows − financing cost', () => {
    const flows = [-100, -50, -50, 0, 150, 200];
    const r = financeFlows(flows, { equityShareOfCosts: 0.5, totalCosts: 200, monthlyRate: 0.01 });
    const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
    expect(sum(r.equityFlows)).toBeCloseTo(sum(flows) - r.financingCost, 9);
  });
});

describe('developer stresses (lot 149, 35% mixed)', () => {
  const s = developerStress(ctx, 'mixed', 0.35, { markup: 0.175 });
  const m = (label: string) => s.rows.find((r) => r.label.startsWith(label))!.margin;
  it('base row equals the lot P&L', () => {
    expect(m('בסיס')).toBeCloseTo(lotDeveloperPnL(ctx, 'mixed', 0.35, { markup: 0.175 }).margin, 12);
  });
  it('each adverse stress lowers the margin; public buildings inside the plan areas raise it', () => {
    for (const l of ['עלות בנייה', 'מחיר דירה', 'שטח למכירה', 'עיכוב', 'ריבית ליווי']) expect(m(l)).toBeLessThan(m('בסיס'));
    expect(m('מבני הציבור')).toBeGreaterThan(m('בסיס'));
  });
  it('the combined stress is worse than any single one', () => {
    const singles = ['עלות בנייה', 'מחיר דירה', 'עיכוב', 'ריבית ליווי'].map(m);
    expect(m('משולב')).toBeLessThan(Math.min(...singles));
  });
  it('headroom: absorbing exactly toZeroPerSqm of extra cost leaves ≈ zero profit before financing effects', () => {
    const p = lotDeveloperPnL(ctx, 'mixed', 0.35, { markup: 0.175 });
    expect(s.headroom.toZeroPerSqm * p.saleableArea).toBeCloseTo(p.profit, 4);
    expect(s.headroom.toTargetPerSqm * p.saleableArea).toBeCloseTo(p.profit - C.developer.targetMarginOnRevenue * p.revenue, 4);
  });
  it('a 10% cost rise is ≈ ₪11.44M of direct cost before soft costs and financing (lot 149)', () => {
    const base = s.rows.find((r) => r.label === 'בסיס')!;
    const hi = s.rows.find((r) => r.label.startsWith('עלות בנייה'))!;
    // Profit falls by the direct increase plus 12% soft costs on it, plus extra financing.
    expect(base.profit - hi.profit).toBeGreaterThan(11_443_260 * 1.12);
  });
});
