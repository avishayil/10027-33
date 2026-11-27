/**
 * Per-tax contract terms (iteration 6). Gross / mixed / net are templates; an actual offer can cap the developer's
 * levy contribution (Rothstein Holon: new-plan levy up to ₪7.5M, the excess on the owners) or share a tax.
 * Every tax is still paid exactly once: owner part + developer part = the tax.
 */
import { describe, expect, it } from 'vitest';
import { PROJECT_CONFIG as C } from '../../src/data/config';
import { developerTaxPart, termsFor } from '../../src/domain/arrangements';
import { calculateRights } from '../../src/domain/rights';
import { buildTransactionPlan } from '../../src/domain/transactions';
import type { Candidate, ProjectConfig } from '../../src/domain/types';
import { withArrangement } from '../fixtures/configs';
import { MODERATE, TERMS } from '../fixtures/profiles';

const info = calculateRights(167, C);
const L = info.bettermentLevy;
const S02: Candidate = { id: 'S02', type: 'S02', targetApartments: 0, legs: [{ kind: 'combination', rights: info.apartmentEquivalents }] };
const plan = (cfg: ProjectConfig) => buildTransactionPlan(S02, { info, profile: MODERATE, terms: TERMS, config: cfg });
const sumBy = (p: ReturnType<typeof plan>, payer: string, cat: string) =>
  p.ledger.filter((e) => e.payer === payer && e.category === cat).reduce((s, e) => s + e.amount, 0);
const withOffer = (cfg: ProjectConfig, offer: Partial<ProjectConfig['commercial']['offer']>): ProjectConfig => ({
  ...cfg,
  commercial: { ...cfg.commercial, offer: { ...cfg.commercial.offer, ...offer } },
});

describe('contract terms', () => {
  it('templates: gross 0/0/0, mixed levy only, net all three; no caps', () => {
    const share = (arr: 'gross' | 'mixed' | 'net') => {
      const t = termsFor(arr);
      return [t.levy.developerShare, t.capitalGains.developerShare, t.servicesVat.developerShare, t.levy.developerCap];
    };
    expect(share('gross')).toEqual([0, 0, 0, null]);
    expect(share('mixed')).toEqual([1, 0, 0, null]);
    expect(share('net')).toEqual([1, 1, 1, null]);
  });

  it('a developer pays a share s of a tax that is itself consideration: x = s·t0 / (1 − s·r)', () => {
    expect(developerTaxPart(100, { developerShare: 1, developerCap: null }, 0.25)).toBeCloseTo(100 / 0.75, 9);
    expect(developerTaxPart(100, { developerShare: 0.5, developerCap: null }, 0.25)).toBeCloseTo(50 / 0.875, 9);
    expect(developerTaxPart(100, { developerShare: 1, developerCap: 60 }, 0.25)).toBe(60);
    expect(developerTaxPart(100, { developerShare: 0, developerCap: null }, 0.25)).toBe(0);
  });
});

describe('a capped levy contribution (mixed deal, actual offer)', () => {
  const cap = 200_000;
  const p = plan(withOffer(withArrangement(C, 'mixed'), { levyCap: cap }));
  it('the developer pays up to the cap, the owner the excess', () => {
    expect(sumBy(p, 'developer', 'betterment_levy')).toBeCloseTo(cap, 6);
    expect(sumBy(p, 'owner', 'betterment_levy')).toBeCloseTo(L - cap, 6);
  });
  it('the levy is still assigned exactly once per right', () => {
    const portions = p.ledger.filter((e) => e.category === 'betterment_levy').reduce((s, e) => s + (e.rightsPortion ?? 0), 0);
    expect(portions).toBeCloseTo(info.apartmentEquivalents, 9);
  });
  it('only the developer-paid part of the levy is consideration', () => {
    const full = sumBy(plan(withArrangement(C, 'mixed')), 'owner', 'capital_gains_tax');
    expect(full - sumBy(p, 'owner', 'capital_gains_tax')).toBeCloseTo(0.25 * (L - cap), 4);
  });
  it('the owner’s part is payable from cash or a tax loan', () => {
    expect(p.events.some((e) => e.category === 'betterment_levy' && e.taxLoanEligible)).toBe(true);
  });
});

describe('templates reproduce the previous payer table exactly', () => {
  for (const arr of ['gross', 'mixed', 'net'] as const) {
    it(arr, () => {
      const p = plan(withArrangement(C, arr));
      for (const cat of ['betterment_levy', 'capital_gains_tax', 'services_vat']) {
        const payers = new Set(p.ledger.filter((e) => e.category === cat && e.amount > 0).map((e) => e.payer));
        expect(payers.size, `${arr} ${cat}`).toBe(1);
      }
    });
  }
});
