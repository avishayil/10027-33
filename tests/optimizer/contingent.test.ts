/**
 * Iteration 10 / I5 (review of c689d0b, §C and acceptance C1–C4): contracts with an option — no implicit fallback, the
 * switch happens at the exercise date with a common prefix, facilities per contract, all-state minimax regret and a
 * premium interval. Expected values are stated independently.
 */
import { describe, expect, it } from 'vitest';
import { PROJECT_CONFIG as C } from '../../src/data/config';
import type { CashEvent, LedgerEntry, TransactionPlan } from '../../src/domain/types';
import { analyzeProfile } from '../../src/optimizer/analyze';
import { contingentPlan, minimaxRegret, shiftBeforeExercise } from '../../src/optimizer/contingent';
import { profile, TERMS } from '../fixtures/profiles';

const ev = (month: number, amount: number, category: CashEvent['category'] = 'construction'): CashEvent => ({ month, amount, label: category, category });
const le = (month: number, amount: number, category: LedgerEntry['category'] = 'construction'): LedgerEntry =>
  ({ month, amount: Math.abs(amount), label: category, category, payer: 'owner', direction: amount < 0 ? 'out' : 'in', priceBasis: 'nominal' }) as LedgerEntry;
const plan = (events: CashEvent[]): TransactionPlan => ({ events, ledger: events.map((e) => le(e.month, e.amount, e.category)) }) as unknown as TransactionPlan;

describe('C4: minimax regret over all three states', () => {
  it('A = (100, 100, −100), B = (95, 95, 0) → A 100, B 5 (approved-only would have preferred A)', () => {
    const r = minimaxRegret([
      [100, 100, -100],
      [95, 95, 0],
    ]);
    expect(r.maxRegret).toEqual([100, 5]);
    // Approved-only (first two states) would rank A first — the all-state rule does not.
    const approvedOnly = minimaxRegret([
      [100, 100],
      [95, 95],
    ]);
    expect(approvedOnly.maxRegret).toEqual([0, 5]);
  });
  it('a contract that cannot be carried out where another can has infinite regret; a state where nothing works costs all the same', () => {
    const r = minimaxRegret([
      [100, null, null],
      [90, 10, null],
    ]);
    expect(r.maxRegret[0]).toBe(Infinity);
    expect(r.maxRegret[1]).toBe(10);
    expect(r.regrets[0][2]).toBe(0);
  });
});

describe('C2: the switch happens at the exercise date (common prefix, nothing paid retroactively)', () => {
  it('X’s ₪100K at signing moves to month 24 → PV ≈ ₪94,259 at 3% real', () => {
    const x = plan([ev(0, -100_000), ev(60, -50_000)]);
    const f = plan([]);
    const t = shiftBeforeExercise(x, f, 24);
    expect(t.events.map((e) => e.month)).toEqual([24, 60]);
    expect(t.ledger.map((e) => e.month)).toEqual([24, 60]);
    const pv = t.events.filter((e) => e.month === 24).reduce((s, e) => s - e.amount * Math.pow(1.03, -e.month / 12), 0);
    expect(Math.floor(pv)).toBe(94_259);
  });
  it('the fallback’s pre-exercise events are kept (sunk); identical events in both are paid once at their date', () => {
    const f = plan([ev(0, -5_000, 'transaction_costs'), ev(6, -20_000, 'capital_gains_tax')]);
    const x = plan([ev(0, -5_000, 'transaction_costs'), ev(0, -100_000)]);
    const t = shiftBeforeExercise(x, f, 24);
    const at = (m: number) => t.events.filter((e) => e.month === m).map((e) => `${e.category}:${e.amount}`).sort();
    expect(at(0)).toEqual(['transaction_costs:-5000']);
    expect(at(6)).toEqual(['capital_gains_tax:-20000']);
    expect(at(24)).toEqual(['construction:-100000']);
  });
});

describe('C1/C3: contracts, facilities and states', () => {
  const p = profile({ availableCapital: 800_000, maxMonthlyRepayment: 8000 });
  const d = analyzeProfile(p, TERMS, C);
  const c = contingentPlan(d, p, TERMS, C);
  it('no implicit fallback: a fixed contract that cannot be carried out in a state is not executable there', () => {
    for (const r of c.rows.filter((x) => x.kind === 'fixed'))
      for (const s of ['financed', 'no_financing'] as const) if (!r.states[s].executable) expect(r.states[s].value).toBeNull();
  });
  it('option rows name an explicit plain-combination fallback, the exercise date and the financing condition', () => {
    const opts = c.rows.filter((x) => x.kind === 'option');
    for (const o of opts) {
      expect(o.option!.fallbackRouteId).toBe('S02');
      expect(o.option!.exerciseMonth).toBe(24);
      expect(o.option!.condition).toBe('financing_confirmed');
      expect(o.option!.fee).toBeNull(); // unknown — not invented
      // Not financed / not approved: the fallback's own outcome.
      const fb = c.rows.find((x) => x.kind === 'fixed' && x.routeId === 'S02')!;
      expect(o.states.no_financing.value).toBe(fb.states.no_financing.value);
      expect(o.states.no_approval.value).toBe(fb.states.no_approval.value);
    }
  });
  it('the no-financing branch disables every facility; the financed branch enables only the contract’s own', () => {
    for (const r of c.rows) {
      expect(r.states.no_financing.facilities).toEqual([]);
      if (r.contract.funding === 'none') expect(r.states.financed.facilities).not.toContain('tax_loan');
    }
  });
  it('rows are unique by contract id and ordered by all-state max regret', () => {
    expect(new Set(c.rows.map((r) => r.id)).size).toBe(c.rows.length);
    for (let i = 1; i < c.rows.length; i += 1) expect(c.rows[i].maxRegret).toBeGreaterThanOrEqual(c.rows[i - 1].maxRegret);
    for (const r of c.rows) expect(r.regret.no_approval).not.toBeUndefined();
  });
  it('the premium interval: what the owner gains if financed vs what the option costs the developer', () => {
    for (const o of c.rows.filter((x) => x.kind === 'option')) {
      const pr = o.option!.premium;
      if (pr.ownerMax !== null) expect(pr.ownerMax).toBeGreaterThanOrEqual(0);
      if (pr.developerMin !== null) expect(pr.developerMin).toBeGreaterThanOrEqual(0);
      if (pr.ownerMax !== null && pr.developerMin !== null) expect(pr.agreeable).toBe(pr.developerMin <= pr.ownerMax);
    }
  });
  it('unknown capital is never treated as executable: only contracts that need no capital at all are', () => {
    const q = profile({ availableCapital: null, maxMonthlyRepayment: 8000 });
    const dq = analyzeProfile(q, TERMS, C);
    const cq = contingentPlan(dq, q, TERMS, C);
    const zero = contingentPlan(dq, { ...q, availableCapital: 0 }, TERMS, C);
    expect(cq.rows.length).toBeGreaterThan(0);
    for (const r of cq.rows)
      for (const s of ['financed', 'no_financing'] as const) {
        if (!r.states[s].executable) continue;
        expect(zero.rows.find((z) => z.id === r.id)!.states[s].executable).toBe(true);
      }
    expect(cq.rows.some((r) => !r.states.financed.executable)).toBe(true);
  });
  it('an option never switches the tax arrangement or the %', () => {
    for (const o of c.rows.filter((x) => x.kind === 'option')) {
      expect(o.option!.targetContract.arrangement).toBe(o.contract.arrangement);
      expect(o.option!.targetContract.combinationPct).toBe(o.contract.combinationPct);
    }
  });
});

describe('C3: a conditional deal keeps its own contract terms', () => {
  // Nothing fits on the base terms → the conditional direction may be another arrangement or a tax loan.
  const p = profile({ availableCapital: 0, maxMonthlyRepayment: 5000 });
  const d = analyzeProfile(p, TERMS, C);
  const c = contingentPlan(d, p, TERMS, C);
  it('its row is evaluated under the conditional contract (arrangement / % / funding), not the current one', () => {
    const cond = d.conditionalRecommendation;
    if (!cond) return;
    const row = c.rows.find((r) => r.kind === 'fixed' && r.routeId === cond.result.id && r.conditional);
    expect(row).toBeDefined();
    expect(row!.contract.arrangement).toBe(cond.arrangement);
    expect(row!.contract.combinationPct).toBeCloseTo(cond.combinationPct, 9);
    if (cond.kind === 'funding') {
      expect(row!.contract.funding).toBe(cond.method);
      expect(row!.states.financed.facilities.length).toBeGreaterThan(0);
    }
  });
});
