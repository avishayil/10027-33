/** Saved answers: the offer's tax arrangement is stored; older saves without it load as 'mixed'. */
import { afterEach, describe, expect, it } from 'vitest';
import { loadInputs, STORAGE_KEY, type SavedInputs } from '../../src/hooks/storage';

const saved: Omit<SavedInputs, 'taxArrangement'> = {
  version: 1,
  areaMode: 'sqm',
  areaText: '167',
  fractionText: '167/21258',
  lotId: '',
  capitalText: '0',
  repaymentMode: 'amount',
  repaymentText: '4000',
  goal: 'balanced',
  combinationPct: 0.35,
  developerMarkup: 0.175,
  basisText: '',
  deadlineYears: 2,
  soleHome: 'unknown',
};

function withStorage(value: unknown) {
  const store = new Map([[STORAGE_KEY, JSON.stringify(value)]]);
  (globalThis as unknown as { window: unknown }).window = { localStorage: { getItem: (k: string) => store.get(k) ?? null } };
}
afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window;
});

describe('saved answers and the offer’s tax arrangement', () => {
  it('older saves without it load as mixed', () => {
    withStorage(saved);
    expect(loadInputs()!.taxArrangement).toBe('mixed');
  });
  it('a saved arrangement is kept', () => {
    withStorage({ ...saved, taxArrangement: 'net' });
    expect(loadInputs()!.taxArrangement).toBe('net');
  });
  it('an invalid arrangement rejects the save', () => {
    withStorage({ ...saved, taxArrangement: 'sometimes' });
    expect(loadInputs()).toBeNull();
  });
  it('older saves get empty offer terms and no other-property limit', () => {
    withStorage(saved);
    const l = loadInputs()!;
    expect(l.levyCapText).toBe('');
    expect(l.developerPaysInterest).toBe(false);
    expect(l.otherPropertyLimitText).toBe('');
  });
});

describe('iteration 9 / D4: migration and invalid saved values', () => {
  it('a retired goal is migrated and the original preference is reported (not saved)', () => {
    withStorage({ ...saved, goal: 'passive_income' });
    const s = loadInputs()!;
    expect(s.goal).toBe('maximize_apartments');
    expect(s.migratedGoalFrom).toBe('passive_income');
  });
  it('a current goal is not flagged', () => {
    withStorage(saved);
    expect(loadInputs()!.migratedGoalFrom).toBeUndefined();
  });
  it('a saved lot the tables do not have is dropped (no crash)', () => {
    withStorage({ ...saved, lotId: '999' });
    expect(loadInputs()!.lotId).toBe('');
  });
});
