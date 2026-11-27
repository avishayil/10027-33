/**
 * Iteration 7 (review of c32bb73): accounting invariants for the lot-level developer model — independent of its
 * formulas. Cash is conserved month to month; the lot does not depend on one user's personal tax position or offer;
 * physical units, ownership shares and simulation rights are kept apart; a user's route enters as a delta with its
 * financing recomputed; the selected markup and developer-paid interest reach the developer's P&L.
 */
import { describe, expect, it } from 'vitest';
import { PROJECT_CONFIG as C } from '../../src/data/config';
import { getLot } from '../../src/data/parcel33';
import { withArrangement } from '../../src/domain/arrangements';
import {
  developerBreakEvens,
  financeFlows,
  lotDeveloperPnL,
  profitabilityMatrix,
  projectDeveloperPnL,
  typicalHoldingsInCombination,
} from '../../src/domain/lotDeveloper';
import { calculateRights } from '../../src/domain/rights';
import type { ProjectConfig } from '../../src/domain/types';
import { analyzeProfile } from '../../src/optimizer/analyze';
import { MODERATE, profile, TERMS } from '../fixtures/profiles';

const info = calculateRights(167, C);
const ctx = { info, profile: MODERATE, config: C };

describe('developer cash is conserved month to month', () => {
  it('a receipt in month 0 funds a cost in month 1 — no equity, no loan, no interest (review §2)', () => {
    const f = financeFlows([1_000_000, -1_000_000], { equityShareOfCosts: 0.2, totalCosts: 1_000_000, monthlyRate: 0.005 });
    expect(f.financingCost).toBe(0);
    expect(f.peakLoan).toBe(0);
    expect(f.peakEquity).toBe(0);
  });
  it('profit identity: Σ flows − financing = what is left after repaying equity and loans', () => {
    const flows = [-500_000, -500_000, 0, 300_000, 900_000];
    const f = financeFlows(flows, { equityShareOfCosts: 0.2, totalCosts: 1_000_000, monthlyRate: 0.01 });
    expect(f.endingCash - f.peakEquity).toBeCloseTo(flows.reduce((s, x) => s + x, 0) - f.financingCost, 6);
    expect(f.endingLoan).toBe(0);
  });
});

describe('the lot is independent of the user’s personal position', () => {
  it('a personal levy cap or acquisition basis does not change the lot', () => {
    const capped: ProjectConfig = { ...C, commercial: { ...C.commercial, offer: { ...C.commercial.offer, levyCap: 100_000 } } };
    const base = lotDeveloperPnL(ctx, 'mixed', 0.35);
    expect(lotDeveloperPnL({ ...ctx, config: capped }, 'mixed', 0.35).profit).toBeCloseTo(base.profit, 4);
    expect(lotDeveloperPnL({ ...ctx, profile: { ...MODERATE, acquisitionBasis: 300_000 } }, 'mixed', 0.35).profit).toBeCloseTo(base.profit, 4);
  });
  it('taxes scale by ownership share (typical holdings), not by simulation rights × physical units', () => {
    const lot = getLot(C.rights.tableVersion, '149');
    const p = lotDeveloperPnL(ctx, 'mixed', 0.35);
    const holdings = typicalHoldingsInCombination(ctx, p.servicesUnits);
    expect(holdings).toBeCloseTo(((lot.units - p.servicesUnits) / lot.units) / lot.sharePer167, 9);
  });
});

describe('the selected markup and developer-paid interest reach the developer', () => {
  it('a higher construction-services markup raises the lot margin (review §6)', () => {
    expect(lotDeveloperPnL(ctx, 'mixed', 0.35, { markup: 0.2 }).profit).toBeGreaterThan(lotDeveloperPnL(ctx, 'mixed', 0.35, { markup: 0.15 }).profit);
  });
  it('services participation below the quota changes the lot (review §6)', () => {
    const full = lotDeveloperPnL(ctx, 'mixed', 0.35, { participation: 1 });
    const none = lotDeveloperPnL(ctx, 'mixed', 0.35, { participation: 0 });
    expect(none.servicesUnits).toBe(0);
    expect(full.servicesUnits).toBeGreaterThan(0);
  });
  it('when the developer bears the owner’s tax-loan interest, the route margin carries that cost (review §5)', () => {
    const loanOn: ProjectConfig = { ...C, financing: { ...C.financing, taxLoan: { ...C.financing.taxLoan, available: true } } };
    const pays: ProjectConfig = { ...loanOn, commercial: { ...loanOn.commercial, offer: { ...loanOn.commercial.offer, developerPaysTaxLoanInterest: true } } };
    const a = analyzeProfile(MODERATE, TERMS, loanOn).results.find((r) => r.id === 'S02P')!;
    const b = analyzeProfile(MODERATE, TERMS, pays).results.find((r) => r.id === 'S02P')!;
    expect(b.simulation.taxLoanInterest).toBe(0);
    // The developer pays the interest as it accrues (simple interest on the principal); the owner avoids the
    // capitalised (compounded) interest it would otherwise have owed at delivery.
    const months = 36;
    expect(b.simulation.taxLoanSubsidy).toBeCloseTo(b.simulation.taxLoanDrawn * (C.financing.taxLoan.annualRate * 1.18 / 12) * months, 0);
    expect(b.simulation.taxLoanSubsidy).toBeLessThan(a.simulation.taxLoanInterest);
    expect(b.developerMargin!).toBeLessThan(a.developerMargin!);
  });
});

describe('a user’s route enters the lot as a delta', () => {
  it('a typical owner (167 m², unknown basis, template terms) on full combination leaves the lot unchanged', () => {
    const typical = profile({ availableCapital: 1_500_000, maxMonthlyRepayment: 15000 });
    const d = analyzeProfile(typical, TERMS, withArrangement(C, 'mixed'));
    const s02 = d.results.find((r) => r.id === 'S02')!;
    expect(s02.developerMargin!).toBeCloseTo(lotDeveloperPnL({ info, profile: typical, config: C }, 'mixed', 0.35).margin, 6);
  });
  it('buying complementary rights does not add apartments to the lot (review §12)', () => {
    const d = analyzeProfile(profile({ landAreaSqm: 60, availableCapital: 1_500_000, maxMonthlyRepayment: 10000 }), TERMS, C);
    const s10 = d.results.find((r) => r.strategyType === 'S10')!;
    expect(s10.developerLot!.units).toBe(getLot(C.rights.tableVersion, '149').units);
  });
});

describe('profitability thresholds (review §3)', () => {
  it('2-D matrix: a higher developer cost lowers, a higher apartment price raises the viable %', () => {
    const m = profitabilityMatrix(ctx, 'mixed', [9000, 11000], [25000, 30000]);
    const v = (i: number, j: number) => m.cells[i][j] ?? -1;
    expect(v(0, 0)).toBeGreaterThan(v(1, 0));
    expect(v(1, 1)).toBeGreaterThan(v(1, 0));
  });
  it('break-evens leave the target margin at the offer’s %', () => {
    const b = developerBreakEvens(ctx, 'mixed', 0.35);
    const target = C.developer.targetMarginOnRevenue;
    const atCost = { ...C, developer: { ...C.developer, directCostPerSqm: b.maxDirectCostPerSqm! } };
    expect(lotDeveloperPnL({ ...ctx, config: atCost }, 'mixed', 0.35).margin).toBeCloseTo(target, 3);
    const atPrice = { ...C, market: { ...C.market, apartmentValuePerSqm: b.minApartmentPricePerSqm! } };
    expect(lotDeveloperPnL({ ...ctx, config: atPrice }, 'mixed', 0.35).margin).toBeCloseTo(target, 3);
    expect(b.profitOnCostAtTarget).toBeCloseTo(target / (1 - target), 9);
  });
  it('the project P&L is the sum of the three lots', () => {
    const p = projectDeveloperPnL(ctx, 'mixed', 0.35);
    const sum = C.rights.lotIds.reduce((s, id) => s + lotDeveloperPnL({ ...ctx, info: calculateRights(167, C, id) }, 'mixed', 0.35).profit, 0);
    expect(p.profit).toBeCloseTo(sum, 2);
    expect(p.lots).toHaveLength(3);
  });
});
