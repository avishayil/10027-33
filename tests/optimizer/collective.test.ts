/**
 * Iteration 10 / I4 (review of c689d0b, §B and acceptance G1–G6): the group planner on one common contract, with the
 * pool conserved, aggregate limits validated, the selected lot used, one developer P&L for the group, and honest
 * outside-option statuses. Expected values are stated independently.
 */
import { describe, expect, it } from 'vitest';
import { PROJECT_CONFIG as C } from '../../src/data/config';
import { getLot } from '../../src/data/parcel33';
import { quotaSlots } from '../../src/domain/lotDeveloper';
import { policyBlock, serviceApartments } from '../../src/domain/policy';
import { calculateRights } from '../../src/domain/rights';
import { apartmentValueAt } from '../../src/domain/valuation';
import { completionMonth } from '../../src/domain/construction';
import { planGroup, poolAllocation, validateGroup, type GroupContext, type GroupMember } from '../../src/optimizer/group/collective';
import { C_SIM } from '../fixtures/configs';
import { TERMS } from '../fixtures/profiles';

const OFFER = { levyCap: null, developerPaysTaxLoanInterest: false };
const title = (r: { id: string }) => r.id;
const m = (label: string, availableCapital: number | null, maxMonthlyRepayment: number | null, goal: GroupMember['goal'] = 'balanced', landAreaSqm = 167): GroupMember => ({
  label,
  landAreaSqm,
  availableCapital,
  maxMonthlyRepayment,
  goal,
});
const G = (members: GroupMember[], over: Partial<GroupContext> = {}): GroupContext => ({ lotId: '149', members, slotsAvailable: 0, terms: TERMS, offer: OFFER, arrangement: 'mixed', ...over });

describe('G1: the pool conserves assets', () => {
  it('pure: two 0.7875 shares at ₪2.5M and 2% cost → one unit, ₪2.45M in all, 0.575 residual with no cash', () => {
    const p = poolAllocation([0.7875, 0.7875], 2_500_000, 0.02);
    expect(p.units).toBe(1);
    expect(p.proceeds).toBeCloseTo(2_450_000, 6);
    expect(p.perMember.reduce((s, x) => s + x.cash, 0)).toBeCloseTo(2_450_000, 6);
    for (const x of p.perMember) expect(x.cash).toBeCloseTo(1_225_000, 6);
    expect(p.residualShares).toBeCloseTo(0.575, 9);
    expect(p.residualValueGross).toBeCloseTo(1_437_500, 6); // an illiquid asset, not cash
    // Not the old full-share credit (2 × 0.7875 × 2.45M = 3,858,750).
    expect(p.proceeds).toBeLessThan(3_858_750 - 1);
  });
  it('integration: each pooled owner is re-evaluated with only their sold part; the rest stays a fractional share', () => {
    const g = planGroup(G([m('א', 0, 0), m('ב', 0, 0)], { arrangement: 'net' }), title, C_SIM);
    expect(g.members.every((x) => x.chosen?.routeId === 'S02P')).toBe(true);
    expect(g.pool.shares).toBeCloseTo(1.575, 9);
    expect(g.pool.units).toBe(1);
    const unit = apartmentValueAt(C_SIM, completionMonth(C_SIM)) * (1 - C_SIM.taxation.saleTransactionCostRate);
    let cash = 0;
    for (const x of g.members) {
      // The snapshot behind the chosen value is the re-evaluated one (re-run with the group's sale).
      const plan = planOf(g, x.member.label);
      const inflow = plan.ledger.filter((e) => e.category === 'fraction_settlement' && e.direction === 'in').reduce((s, e) => s + e.amount, 0);
      expect(inflow).toBeCloseTo((0.7875 / 1.575) * unit, 0);
      expect(plan.fractionalShare).toBeCloseTo(0.7875 - 0.7875 / 1.575, 6);
      cash += inflow;
      expect(x.chosenValue!).toBeLessThan(x.chosen!.value); // less than the full-share credit
    }
    expect(cash).toBeCloseTo(unit, 0); // exactly one unit's net proceeds in all
  });
});

/** The re-evaluated plan of a member: re-run the chosen route with the group's sold fraction. */
function planOf(g: ReturnType<typeof planGroup>, label: string) {
  const x = g.members.find((y) => y.member.label === label)!;
  const f = g.pool.soldFraction;
  return x.chosen!.poolShare > 0 && f < 1 ? reEvaluated(g, label, f) : x.chosen!.snapshot.result.plan;
}
function reEvaluated(g: ReturnType<typeof planGroup>, label: string, f: number) {
  const x = g.members.find((y) => y.member.label === label)!;
  expect(x.chosenSnapshot).not.toBeNull();
  const leg = x.chosenSnapshot!.route.legs.find((l) => l.kind === 'balancing_pool');
  expect(leg && 'soldFraction' in leg ? leg.soldFraction : null).toBeCloseTo(f, 9);
  return x.chosenSnapshot!.result.plan;
}

describe('G2: aggregate limits', () => {
  it('eight 1,000 m² holdings in lot 149 exceed the lot and are rejected', () => {
    const big = Array.from({ length: 8 }, (_, i) => m(`${i}`, 0, 0, 'balanced', 1000));
    expect(validateGroup(G(big), C).join(' ')).toContain('גדול מכל המגרש');
    expect(() => planGroup(G(big), title, C)).toThrow();
  });
  it('more than eight owners are rejected', () => {
    expect(() => planGroup(G(Array.from({ length: 9 }, (_, i) => m(`${i}`, 0, 0))), title, C)).toThrow();
  });
  it('non-finite or negative member inputs are rejected', () => {
    expect(() => planGroup(G([m('א', Number.NaN, 0)]), title, C)).toThrow();
    expect(() => planGroup(G([m('א', 0, -1)]), title, C)).toThrow();
  });
});

describe('G3: the selected lot is used, never a silent lot 149', () => {
  for (const lotId of ['150', '153']) {
    it(`lot ${lotId}`, () => {
      const g = planGroup(G([m('א', 2_000_000, 15000)], { lotId, arrangement: 'gross' }), title, C);
      expect(g.lotId).toBe(lotId);
      const R = calculateRights(167, C, lotId).apartmentEquivalents;
      for (const o of g.members[0].options) {
        expect(o.snapshot.lotId).toBe(lotId);
        expect(o.snapshot.result.plan.rightsInCombination + o.snapshot.result.plan.rightsBuilt + o.snapshot.result.plan.rightsSold + o.snapshot.result.plan.rightsHeld).toBeCloseTo(R, 6);
      }
    });
  }
});

describe('G4: one common contract and one developer P&L', () => {
  const g = planGroup(G([m('א', 800_000, 6000), m('ב', 2_000_000, 15000), m('ג', 0, 0)], { arrangement: 'net', slotsAvailable: 1 }), title, C);
  it('every option is a snapshot of the same contract terms (no other arrangement or individual loan mixed in)', () => {
    for (const x of g.members)
      for (const o of x.options) {
        expect(o.snapshot.contract).toEqual(g.contract);
        expect(o.contractId).toBe(o.snapshot.id);
      }
  });
  it('the developer side is one lot P&L for the whole group; below the hurdle the group plan is infeasible', () => {
    expect(g.assigned).toBeGreaterThan(0);
    expect(g.developer.margin).not.toBeNull();
    expect(g.developer.ok).toBe(g.developer.margin! >= C.developer.targetMarginOnRevenue - 1e-9);
    if (!g.developer.ok) expect(g.status).toBe('infeasible');
  });
  it('a one-owner group’s developer P&L equals that route’s own lot P&L', () => {
    const one = planGroup(G([m('א', 2_000_000, 15000)], { arrangement: 'gross' }), title, C);
    expect(one.developer.margin!).toBeCloseTo(one.members[0].chosen!.snapshot.developer.margin!, 9);
  });
});

describe('G5: slots', () => {
  const quota = quotaSlots(C, getLot(C.rights.tableVersion, '149').units);
  it('more than the lot quota, a fraction or a negative number is rejected', () => {
    for (const s of [quota + 1, 1.5, -1, Number.NaN]) expect(() => planGroup(G([m('א', 0, 0)], { slotsAvailable: s }), title, C)).toThrow();
    expect(() => planGroup(G([m('א', 0, 0)], { slotsAvailable: quota }), title, C)).not.toThrow();
  });
  it('a policy-blocked route is never an option (never a free slot); slots = whole service apartments', () => {
    const g = planGroup(G([m('א', 2_000_000, 15000), m('ב', 800_000, 6000)], { arrangement: 'gross', slotsAvailable: 2 }), title, C);
    for (const x of g.members)
      for (const o of x.options) {
        expect(policyBlock(o.snapshot.route, calculateRights(167, C, '149').apartmentEquivalents, C)).toBeNull();
        expect(o.slots).toBe(serviceApartments(o.snapshot.route));
      }
    expect(g.slotsUsed).toBeLessThanOrEqual(2);
  });
});

describe('G6: outside options and the fairness claim', () => {
  it('an owner with nothing acceptable is on their outside option (no agreement), and no fairness claim is made for them', () => {
    const g = planGroup(G([m('א', 0, 0, 'minimize_risk'), m('ב', 2_000_000, 15000)], { arrangement: 'gross' }), title, C);
    const a = g.members[0];
    expect(a.options).toHaveLength(0);
    expect(a.status).toBe('outside_option');
    expect(a.chosen).toBeNull();
    expect(g.fairness.outside).toBe(1);
    expect(g.fairness.holdsForAll).toBe(false);
    expect(g.status).toBe('infeasible');
    expect(g.conditions).toContain('OWNERS_WITHOUT_OPTION');
  });
  it('an owner whose only options need a shared resource has no reservation option — status says so', () => {
    const g = planGroup(G([m('א', 300_000, 5000), m('ב', 300_000, 5000)], { arrangement: 'gross' }), title, C);
    for (const x of g.members) {
      expect(x.reservation).toBeNull();
      expect(x.status).toBe(x.chosen ? 'no_reservation_option' : 'outside_option');
    }
    expect(g.fairness.holdsForAll).toBe(false);
  });
  it('alone, a pool share below one unit cannot be pooled: the owner is left on the outside option', () => {
    const g = planGroup(G([m('א', 300_000, 5000)], { arrangement: 'gross' }), title, C);
    expect(g.members[0].options.every((o) => o.poolShare > 0)).toBe(true);
    expect(g.members[0].status).toBe('outside_option');
  });
  it('every assigned owner with a reservation gets at least its value', () => {
    const g = planGroup(G([m('א', 800_000, 6000), m('ב', 2_000_000, 15000), m('ג', 0, 5000)], { arrangement: 'net', slotsAvailable: 1 }), title, C);
    for (const x of g.members) if (x.reservation && x.chosen) expect(x.chosenValue!).toBeGreaterThanOrEqual(x.reservation.value - 1e-6);
  });
  it('the search reports its bounds and never claims completeness', () => {
    const g = planGroup(G([m('א', 800_000, 6000)]), title, C);
    expect(g.search.complete).toBe(false);
    expect(g.search.maxOptions).toBe(5);
    expect(g.search.maxMembers).toBe(8);
  });
});
