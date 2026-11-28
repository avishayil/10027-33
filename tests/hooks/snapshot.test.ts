/**
 * V1 Milestone B5 (MH-08): one immutable calculation snapshot per input key — the printout and the advanced cards read
 * it, never newer inputs; "forget" clears everything the app stored.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { PROJECT_CONFIG as C } from '../../src/data/config';
import { withArrangement } from '../../src/domain/arrangements';
import { APP_PREFIX, clearInputs } from '../../src/hooks/storage';
import { analysisOf } from '../../src/hooks/useDecisionEngine';
import { analyzeProfile } from '../../src/optimizer/analyze';
import { profile, TERMS } from '../fixtures/profiles';

const key = (over: object = {}) =>
  JSON.stringify({ profile: profile({ availableCapital: 800_000, maxMonthlyRepayment: 8000 }), terms: TERMS, taxArrangement: 'mixed', levyCap: null, developerPaysInterest: false, ...over });

describe('analysis snapshot', () => {
  it('is the analysis of exactly the inputs in its key', () => {
    const a = analysisOf(key(), '2026-11-28T10:00:00.000Z')!;
    const cfg = withArrangement(C, 'mixed');
    const direct = analyzeProfile(a.profile, a.terms, { ...cfg, commercial: { ...cfg.commercial, offer: { levyCap: null, developerPaysTaxLoanInterest: false } } });
    expect(a.result.recommendation?.id).toBe(direct.recommendation?.id);
    expect(a.result.ranked.map((r) => r.id)).toEqual(direct.ranked.map((r) => r.id));
    expect(a.config.commercial.taxArrangement).toBe('mixed');
    expect(a.key).toBe(key());
  });
  it('the id is stable for the same inputs and changes with any input or offer term', () => {
    const id = analysisOf(key(), 't1')!.id;
    expect(analysisOf(key(), 't2')!.id).toBe(id);
    expect(analysisOf(key({ terms: { ...TERMS, developerMarkup: 0.2 } }), 't')!.id).not.toBe(id);
    expect(analysisOf(key({ levyCap: 100_000 }), 't')!.id).not.toBe(id);
    expect(analysisOf(key({ taxArrangement: 'net' }), 't')!.id).not.toBe(id);
  });
  it('incomplete or invalid inputs give no snapshot (nothing to print)', () => {
    expect(analysisOf(key({ profile: null }), 't')).toBeNull();
    expect(analysisOf(key({ profile: profile({ availableCapital: -5 }) }), 't')).toBeNull();
  });
});

describe('forget', () => {
  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });
  it('removes every key the app stored (answers and the display preference), and nothing else', () => {
    const store = new Map<string, string>([
      [`${APP_PREFIX}answers:v1`, '{}'],
      [`${APP_PREFIX}advanced-view`, '1'],
      ['other-site', 'keep'],
    ]);
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: {
        get length() {
          return store.size;
        },
        key: (i: number) => [...store.keys()][i] ?? null,
        getItem: (k: string) => store.get(k) ?? null,
        removeItem: (k: string) => store.delete(k),
      },
    };
    clearInputs();
    expect([...store.keys()]).toEqual(['other-site']);
  });
});
