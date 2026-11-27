/**
 * Who pays which tax in a combination, per arrangement — and that each tax is charged exactly once.
 * VAT on the construction services the owner receives: the owner pays it in gross and mixed deals (as in the
 * reported Rothstein deals), the developer in a net deal.
 */
import { describe, expect, it } from 'vitest';
import { PROJECT_CONFIG as C } from '../../src/data/config';
import { ARRANGEMENT_PAYERS } from '../../src/domain/arrangements';
import { constructionServiceTaxValuePerApartment, permitMonth } from '../../src/domain/construction';
import { candidatePnL } from '../../src/domain/developer';
import { calculateRights } from '../../src/domain/rights';
import { buildTransactionPlan } from '../../src/domain/transactions';
import type { Candidate, ProjectConfig } from '../../src/domain/types';
import { withArrangement } from '../fixtures/configs';
import { MODERATE, TERMS } from '../fixtures/profiles';

const info = calculateRights(167, C);
const S02: Candidate = { id: 'S02', type: 'S02', targetApartments: 0, legs: [{ kind: 'combination', rights: info.apartmentEquivalents }] };
const plan = (cfg: ProjectConfig) => buildTransactionPlan(S02, { info: calculateRights(167, cfg), profile: MODERATE, terms: TERMS, config: cfg });
const sumBy = (p: ReturnType<typeof plan>, payer: string, cat: string) =>
  p.ledger.filter((e) => e.payer === payer && e.category === cat).reduce((s, e) => s + e.amount, 0);

const received = info.apartmentEquivalents * TERMS.combinationPct;
const servicesInclVat = received * constructionServiceTaxValuePerApartment(C);
const vat = (servicesInclVat * C.taxation.vatRate) / (1 + C.taxation.vatRate);

describe('arrangement payer table', () => {
  it('gross: owner pays all; mixed: developer pays the levy only; net: developer pays all', () => {
    expect(ARRANGEMENT_PAYERS.gross).toEqual({ levy: 'owner', capitalGainsTax: 'owner', servicesVat: 'owner' });
    expect(ARRANGEMENT_PAYERS.mixed).toEqual({ levy: 'developer', capitalGainsTax: 'owner', servicesVat: 'owner' });
    expect(ARRANGEMENT_PAYERS.net).toEqual({ levy: 'developer', capitalGainsTax: 'developer', servicesVat: 'developer' });
  });
});

describe('VAT on the construction services received in a combination', () => {
  it('the owner pays it at the permit in gross and mixed deals', () => {
    for (const arr of ['gross', 'mixed'] as const) {
      const p = plan(withArrangement(C, arr));
      expect(sumBy(p, 'owner', 'services_vat')).toBeCloseTo(vat, 4);
      expect(sumBy(p, 'developer', 'services_vat')).toBe(0);
      const e = p.ledger.find((x) => x.category === 'services_vat')!;
      expect(e.month).toBe(permitMonth(C));
      expect(p.events.some((x) => x.category === 'services_vat' && x.amount < 0)).toBe(true);
    }
  });

  it('the developer bears it in a net deal — no owner cash event', () => {
    const p = plan(withArrangement(C, 'net'));
    expect(sumBy(p, 'owner', 'services_vat')).toBe(0);
    expect(sumBy(p, 'developer', 'services_vat')).toBeCloseTo(vat, 4);
    expect(p.events.some((x) => x.category === 'services_vat')).toBe(false);
  });

  it('VAT the owner pays is not also taxed as consideration (capital gains on services ex VAT)', () => {
    const L = info.bettermentLevy;
    const c = TERMS.combinationPct;
    const mixed = sumBy(plan(withArrangement(C, 'mixed')), 'owner', 'capital_gains_tax');
    expect(mixed).toBeCloseTo(0.25 * (servicesInclVat - vat + L - L * (1 - c)), 4);
  });

  it('with servicesVatOnOwner off, nobody is charged VAT on the owner side (legacy behaviour)', () => {
    const legacy: ProjectConfig = { ...C, taxation: { ...C.taxation, servicesVatOnOwner: false } };
    const p = plan(withArrangement(legacy, 'mixed'));
    expect(sumBy(p, 'owner', 'services_vat')).toBe(0);
    const L = info.bettermentLevy;
    expect(sumBy(p, 'owner', 'capital_gains_tax')).toBeCloseTo(0.25 * (servicesInclVat + L - L * 0.65), 4);
  });

  it('the developer P&L counts barter VAT only when the developer bears it', () => {
    const vatLine = (cfg: ProjectConfig) =>
      candidatePnL(S02, plan(cfg), info, cfg, TERMS)!.lines.find((l) => l.label.startsWith('מע״מ על שירותי בנייה'))?.amount ?? 0;
    expect(vatLine(withArrangement(C, 'mixed'))).toBe(0);
    expect(vatLine(withArrangement(C, 'gross'))).toBe(0);
    expect(vatLine(withArrangement(C, 'net'))).toBeLessThan(0);
  });

  it('every combination tax (levy, capital gains, services VAT) has exactly one payer', () => {
    for (const arr of ['gross', 'mixed', 'net'] as const) {
      const p = plan(withArrangement(C, arr));
      for (const cat of ['betterment_levy', 'capital_gains_tax', 'services_vat']) {
        const payers = new Set(p.ledger.filter((e) => e.category === cat && e.amount > 0).map((e) => e.payer));
        expect(payers.size, `${arr} ${cat}`).toBe(1);
        expect([...payers][0]).toBe(ARRANGEMENT_PAYERS[arr][cat === 'betterment_levy' ? 'levy' : cat === 'capital_gains_tax' ? 'capitalGainsTax' : 'servicesVat']);
      }
    }
  });
});
