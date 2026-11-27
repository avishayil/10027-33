/** Iteration 9 / phase F: collective allocation for an anonymous group (scenario inputs, nothing stored). */
import { describe, expect, it } from 'vitest';
import { PROJECT_CONFIG as C } from '../../src/data/config';
import { planGroup, type GroupMember } from '../../src/optimizer/group/collective';
import { TERMS } from '../fixtures/profiles';

const title = (r: { id: string }) => r.id;
// The review's illustrative group: four owners of 2.25 rights with different means and goals.
const group: GroupMember[] = [
  { label: 'א', landAreaSqm: 167, availableCapital: 0, maxMonthlyRepayment: 0, goal: 'minimize_risk' },
  { label: 'ב', landAreaSqm: 167, availableCapital: 300_000, maxMonthlyRepayment: 5000, goal: 'maximize_apartments' },
  { label: 'ג', landAreaSqm: 167, availableCapital: 800_000, maxMonthlyRepayment: 6000, goal: 'maximize_apartments' },
  { label: 'ד', landAreaSqm: 167, availableCapital: 2_000_000, maxMonthlyRepayment: 15000, goal: 'balanced' },
];

describe('group plan', () => {
  for (const slots of [0, 1, 4]) {
    const g = planGroup(group, TERMS, slots, title, C);
    it(`${slots} slot(s): never above the slots available; a pool forms only with ≥ one apartment of shares`, () => {
      expect(g.slotsUsed).toBeLessThanOrEqual(slots);
      if (g.pool.shares > 1e-9) expect(g.pool.shares).toBeGreaterThanOrEqual(1 - 1e-9);
      expect(g.pool.units + g.pool.leftover).toBeCloseTo(g.pool.shares, 9);
    });
    it(`${slots} slot(s): no owner below their own baseline`, () => {
      for (const m of g.members) {
        if (m.baseline === null || !m.chosen) continue;
        expect(m.chosen.rank).toBeLessThanOrEqual(m.options[m.baseline].rank);
      }
    });
    it(`${slots} slot(s): first-choice count and total value are the chosen plan's`, () => {
      expect(g.firstChoices).toBe(g.members.filter((m) => m.chosen?.rank === 0).length);
      expect(g.totalValue).toBeCloseTo(g.members.reduce((s, m) => s + (m.chosen?.value ?? 0), 0), 6);
    });
  }
  it('more slots never lower the number of first choices', () => {
    const a = planGroup(group, TERMS, 0, title, C).firstChoices;
    const b = planGroup(group, TERMS, 4, title, C).firstChoices;
    expect(b).toBeGreaterThanOrEqual(a);
  });
  it('the uncoordinated view counts the slots demanded by first choices', () => {
    const g = planGroup(group, TERMS, 0, title, C);
    expect(g.uncoordinated.slotsDemanded).toBe(g.members.reduce((s, m) => s + (m.alone?.slots ?? 0), 0));
    expect(g.uncoordinated.feasible).toBe(g.uncoordinated.problems.length === 0);
  });
  it('at most eight owners', () => {
    expect(() => planGroup(Array(9).fill(group[0]), TERMS, 1, title, C)).toThrow();
  });
});

describe('coordination', () => {
  it('a pool share below one apartment is completed by another owner joining, so both pool-dependent first choices hold', () => {
    const g = planGroup(group, TERMS, 2, title, C);
    const b = g.members[1];
    expect(b.options.every((o) => o.poolShare > 0)).toBe(true); // ב depends on a pool
    expect(b.chosen?.poolShare).toBeGreaterThan(0);
    expect(g.pool.shares).toBeGreaterThanOrEqual(1);
    expect(g.uncoordinated.feasible).toBe(false); // alone: the pool would not reach one apartment
  });
});
