/**
 * V1 Milestone B2 (spec §C, MH-09): the bundled, versioned, validated Project Pack and canonical evidence.
 */
import { describe, expect, it } from 'vitest';
import { ASSUMPTION_GROUPS, PROJECT_CONFIG as C } from '../../src/data/config';
import type { ProjectConfig } from '../../src/domain/types';
import { analyzeProfile, priceDependencyOf } from '../../src/optimizer/analyze';
import { PACK_ID } from '../../src/kernel/version';
import { CANONICAL_STATUSES, HADERA_PACK, PACK_SCHEMA, loadPack, validatePack } from '../../src/pack';
import { validIsraeliId } from '../fixtures/privacy';
import { profile, TERMS } from '../fixtures/profiles';

describe('the bundled pack', () => {
  it('is valid, versioned with the data and carries the kernel pack id', () => {
    expect(validatePack(HADERA_PACK)).toEqual([]);
    expect(HADERA_PACK.schemaVersion).toBe(PACK_SCHEMA);
    expect(HADERA_PACK.id).toBe(PACK_ID);
    expect(HADERA_PACK.version).toBe(C.version);
    expect(HADERA_PACK.model).toBe(C);
  });
  it('lots, rights model and inventory: official facts, the simulation convention, inventory explicitly unknown', () => {
    expect(HADERA_PACK.lots.map((l) => [l.id, l.units])).toEqual([
      ['149', 102],
      ['150', 96],
      ['153', 100],
    ]);
    expect(HADERA_PACK.parcel.areaSqm).toBe(21_258);
    expect(HADERA_PACK.rightsModel.simulationRightsPer167).toBe(2.25);
    expect(HADERA_PACK.rightsModel.entitlementBasis).toBe('official');
    expect(HADERA_PACK.inventory.status).toBe('unknown');
    expect(HADERA_PACK.inventory.units).toBeNull();
  });
  it('every evidence entry has a stable unique id, a canonical status and a retrieval date', () => {
    const ids = HADERA_PACK.evidence.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of HADERA_PACK.evidence) {
      expect(CANONICAL_STATUSES).toContain(e.status);
      expect(e.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    // Historical land transactions are dated evidence, never a current valuation.
    const tx = HADERA_PACK.evidence.filter((e) => e.id.startsWith('land_tx.'));
    expect(tx.length).toBeGreaterThan(10);
    for (const e of tx) expect(e.status).toBe('reported');
    // Model assumptions keyed by data object and field; the count matches the assumptions panel.
    expect(HADERA_PACK.evidence.find((e) => e.id === 'market.apartmentValuePerSqm')).toBeDefined();
    expect(HADERA_PACK.evidence.filter((e) => /^(project|commercial|market|financing|regulation)\./.test(e.id)).length).toBe(
      ASSUMPTION_GROUPS.reduce((n, g) => n + g.items.length, 0),
    );
    // Unknown prices stay unknown or a scenario.
    expect(HADERA_PACK.evidence.find((e) => e.id === 'price.immediate_price')!.status).toBe('unknown');
    expect(HADERA_PACK.evidence.find((e) => e.id === 'price.developer_price')!.status).toBe('scenario');
  });
  it('contains no personal identifiers', () => {
    const text = JSON.stringify(HADERA_PACK);
    const ids = [...text.matchAll(/(?<!\d)\d{9}(?!\d)/g)].map((m) => m[0]).filter(validIsraeliId);
    expect(ids).toEqual([]);
    expect(text).not.toMatch(/ת\.ז|תעודת זהות|"name"|"owner(Name|Id)"/);
  });
});

describe('loading', () => {
  it('refuses an unsupported schema version', () => {
    expect(() => loadPack({ ...HADERA_PACK, schemaVersion: 'blro-pack/9' })).toThrow(/גרסת/);
  });
  it('refuses invalid data: non-finite model values, lot mismatch, version mismatch, duplicate evidence', () => {
    const bad = (over: object) => validatePack({ ...HADERA_PACK, ...over }).length;
    expect(bad({ model: { ...C, analysis: { ...C.analysis, discountRate: Number.NaN } } })).toBeGreaterThan(0);
    expect(bad({ lots: HADERA_PACK.lots.slice(1) })).toBeGreaterThan(0);
    expect(bad({ version: 'other' })).toBeGreaterThan(0);
    expect(bad({ evidence: [...HADERA_PACK.evidence, HADERA_PACK.evidence[0]] })).toBeGreaterThan(0);
    expect(bad({ evidence: [{ ...HADERA_PACK.evidence[0], status: 'hypothetical' }] })).toBeGreaterThan(0);
  });
  it('loads the bundled pack unchanged', () => expect(loadPack(HADERA_PACK)).toBe(HADERA_PACK));
});

describe('B4: evidence-aware eligibility within scope', () => {
  const sale = { id: 'S01', type: 'S01' as const, targetApartments: 0, legs: [{ kind: 'sell_rights' as const, rights: 2, market: 'developer' as const }] };
  const confirmed = (scope: object): ProjectConfig => ({ ...C, evidence: { ...C.evidence, developer_price: { status: 'confirmed_offer', source: 'הצעה', scope } } });
  it('a confirmed offer counts only for its lot', () => {
    expect(priceDependencyOf(sale, { fractionSettled: null }, confirmed({ lotIds: ['149'] }), '149')).toBeNull();
    expect(priceDependencyOf(sale, { fractionSettled: null }, confirmed({ lotIds: ['149'] }), '150')).toBe('developer_price');
  });
  it('and only while valid on the comparison date', () => {
    expect(priceDependencyOf(sale, { fractionSettled: null }, confirmed({ validUntil: '2026-12-31' }), '149')).toBeNull();
    expect(priceDependencyOf(sale, { fractionSettled: null }, confirmed({ validUntil: '2026-01-31' }), '149')).toBe('developer_price');
    expect(priceDependencyOf(sale, { fractionSettled: null }, confirmed({ validFrom: '2027-01-01' }), '149')).toBe('developer_price');
  });
  it('a scenario price never becomes a fact, and never changes the ranking', () => {
    const p = profile({ availableCapital: 300_000, maxMonthlyRepayment: 5000 });
    const a = analyzeProfile(p, TERMS, C).ranked.map((r) => r.id);
    const doubled: ProjectConfig = { ...C, market: { ...C.market, developerRightsSaleScenario: { ...C.market.developerRightsSaleScenario, pricePerOriginalSqm: C.market.developerRightsSaleScenario.pricePerOriginalSqm * 2 } } };
    expect(analyzeProfile(p, TERMS, doubled).ranked.map((r) => r.id)).toEqual(a);
  });
});
