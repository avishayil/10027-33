/**
 * V1 Milestone B1 (MH-01, MH-05): bilateral events and facilities of a contract snapshot. Every cash transfer has a
 * source and a destination; every facility reconciles to its terminal balance; receipts only after their settlement.
 */
import { describe, expect, it } from 'vitest';
import { PROJECT_CONFIG as C } from '../../src/data/config';
import { simulateCashflow } from '../../src/domain/cashflow';
import type { CashEvent, FacilityAccount } from '../../src/domain/types';
import { approvalMonthOf } from '../../src/domain/transactions';
import { snapshotsFor, type ContractTerms } from '../../src/optimizer/contract';
import { KERNEL_VERSION, PACK_ID, SCHEMA_VERSION } from '../../src/kernel/version';
import { profile, TERMS } from '../fixtures/profiles';

const OFFER = { levyCap: null, developerPaysTaxLoanInterest: false };
const K = (over: Partial<ContractTerms> = {}): ContractTerms => ({ arrangement: 'mixed', combinationPct: 0.35, markup: TERMS.developerMarkup, offer: OFFER, funding: 'none', ...over });
const reconciles = (a: FacilityAccount) => a.drawn + a.transferIn + (a.interestCapitalised ? a.interest : 0) - a.repayment - a.transferOut - a.terminal;

const PROFILES = [
  profile({ availableCapital: 300_000, maxMonthlyRepayment: 5000 }),
  profile({ availableCapital: 800_000, maxMonthlyRepayment: 8000 }),
  profile({ availableCapital: 0, maxMonthlyRepayment: 5000 }),
  profile({ availableCapital: 2_000_000, maxMonthlyRepayment: 15_000, soleHome: false, otherPropertyBorrowingLimit: 400_000 }),
];
const CONTRACTS = [K(), K({ arrangement: 'gross', funding: 'developer_loan' }), K({ arrangement: 'net' })];
const all = PROFILES.flatMap((p) => CONTRACTS.flatMap((k) => snapshotsFor(p, k, C).map((s) => ({ p, k, s }))));

describe('snapshot v1 fields', () => {
  it('carries schema, kernel and pack versions, the scenario and a full input hash', () => {
    const { s } = all[0];
    expect(s.schemaVersion).toBe(SCHEMA_VERSION);
    expect(s.kernelVersion).toBe(KERNEL_VERSION);
    expect(s.packId).toBe(PACK_ID);
    expect(s.packVersion).toBe(C.version);
    expect(s.scenarioId).toBe('base');
  });
  it('the input hash changes with the contract terms and with any configuration value', () => {
    const p = PROFILES[0];
    const a = snapshotsFor(p, K(), C)[0].inputHash;
    expect(snapshotsFor(p, K({ markup: 0.2 }), C)[0].inputHash).not.toBe(a);
    const cfg = { ...C, market: { ...C.market, monthlyRentPerApartment: C.market.monthlyRentPerApartment + 1 } };
    expect(snapshotsFor(p, K(), cfg)[0].inputHash).not.toBe(a);
    expect(snapshotsFor(p, K(), C)[0].inputHash).toBe(a);
  });
});

describe('bilateral events', () => {
  it('every event has a known source and a different destination, a positive amount and a month', () => {
    for (const { s } of all)
      for (const e of s.events) {
        expect(s.participants).toContain(e.source);
        expect(s.participants).toContain(e.destination);
        expect(e.source).not.toBe(e.destination);
        expect(e.amount).toBeGreaterThan(0);
        expect(Number.isFinite(e.month)).toBe(true);
      }
  });
  it('the ledger is fully represented: each non-zero ledger transfer is one event (reserves are internal and excluded)', () => {
    for (const { s } of all) {
      const ledger = s.result.ledger.filter((e) => e.category !== 'contingency_reserve' && e.category !== 'contingency_release' && e.amount > 1e-9);
      const events = s.events.filter((e) => e.kind === 'transfer');
      expect(events).toHaveLength(ledger.length);
      expect(events.reduce((x, e) => x + e.amount, 0)).toBeCloseTo(ledger.reduce((x, e) => x + e.amount, 0), 6);
    }
  });
  it('taxes: liable party vs contractual payer — a levy the developer pays is still the owner’s liability', () => {
    const net = all.filter(({ k }) => k.arrangement === 'net').flatMap(({ s }) => s.events);
    const levy = net.filter((e) => e.category === 'betterment_levy');
    // Under a net deal the developer pays the levy on the combination rights (the owner still pays on rights it builds).
    expect(levy.some((e) => e.payer === 'developer')).toBe(true);
    for (const e of all.flatMap(({ s }) => s.events).filter((x) => x.category === 'betterment_levy' || x.category === 'capital_gains_tax')) {
      expect(e.liable).toBe('owner');
      expect(e.source).toBe(e.payer);
    }
    for (const e of levy) expect(e.destination).toBe('municipality');
  });
  it('receipts only after settlement: apartment sales and fraction settlements from delivery; developer payments from approval', () => {
    for (const { s } of all) {
      const completion = s.result.plan.completionMonth;
      for (const e of s.events) {
        if (e.destination !== 'owner' || e.kind !== 'transfer') continue;
        if (e.category === 'apartment_sale' || e.category === 'fraction_settlement') expect(e.month).toBeGreaterThanOrEqual(completion);
        if (e.category === 'sale_proceeds' && e.source === 'developer') expect(e.month).toBeGreaterThanOrEqual(approvalMonthOf(C));
      }
    }
  });
});

describe('facilities reconcile', () => {
  it('drawn + transfers in (+ capitalised interest) − repayments − transfers out = terminal, for every facility of every snapshot', () => {
    let used = 0;
    for (const { s } of all)
      for (const f of Object.values(s.result.simulation.facilityAccounts)) {
        expect(Math.abs(reconciles(f))).toBeLessThan(1e-4);
        if (f.drawn > 0) used += 1;
      }
    expect(used).toBeGreaterThan(5);
  });
  it('the dated flows (re-run on demand) add up to the always-kept totals, facility by facility', () => {
    for (const { s } of all.slice(0, 24)) {
      const acc = s.result.simulation.facilityAccounts;
      for (const id of ['mortgage', 'secured', 'tax_loan'] as const) {
        const ev = s.events.filter((e) => e.facilityId === id);
        const sum = (k: string) => ev.filter((e) => e.kind === k).reduce((x, e) => x + e.amount, 0);
        expect(sum('loan_draw')).toBeCloseTo(acc[id].drawn, 4);
        expect(sum('loan_interest')).toBeCloseTo(acc[id].interest, 4);
        expect(sum('loan_repayment')).toBeCloseTo(acc[id].repayment, 4);
        expect(sum('loan_transfer')).toBeCloseTo(acc[id].transferOut, 4);
      }
    }
  });
  it('the facility records in the snapshot match the simulation and name a lender and a status', () => {
    for (const { s } of all)
      for (const f of s.facilities) {
        const a = s.result.simulation.facilityAccounts[f.id];
        expect(f.drawn).toBeCloseTo(a.drawn, 6);
        expect(f.terminal).toBeCloseTo(a.terminal, 6);
        expect(['bank', 'developer', 'other_property_lender']).toContain(f.lender);
        expect(['assumed', 'conditional']).toContain(f.approval);
      }
  });
  it('a refinance is a transfer between facilities, not new consideration or a draw', () => {
    const s = simulateCashflow({
      events: [{ month: 24, amount: -200_000, label: 'מס', category: 'capital_gains_tax', taxLoanEligible: true } as CashEvent],
      startingCash: 0,
      annualRate: 0.05,
      mortgageYears: 25,
      alternativeReturn: 0,
      permitMonth: 24,
      completionMonth: 60,
      horizonMonth: 120,
      liquidityMonth: 24,
      monthlyNetRent: 0,
      rentCountsForRepayment: false,
      postCompletionCollateral: 2_500_000,
      taxLoan: { annualRate: 0 },
      taxLoanRefinanceLimit: 1_000_000,
      recordFlows: true,
    });
    expect(s.facilityAccounts.tax_loan.transferOut).toBeCloseTo(200_000, 6);
    expect(s.facilityAccounts.mortgage.transferIn).toBeCloseTo(200_000, 6);
    expect(s.facilityAccounts.mortgage.drawn).toBe(0);
    for (const f of Object.values(s.facilityAccounts)) expect(Math.abs(reconciles(f))).toBeLessThan(1e-6);
  });
});
