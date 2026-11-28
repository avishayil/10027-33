/**
 * V1 Milestone C1 (MH-10): checking an actual developer offer. Every field is optional; a missing term stays unknown
 * (the model scenario is used and the term is listed with a question). The offer is compared with the owner's
 * alternatives on the same valuation basis and date, as changes against the base terms.
 */
import { describe, expect, it } from 'vitest';
import { PROJECT_CONFIG as C } from '../../src/data/config';
import { getLot } from '../../src/data/parcel33';
import { checkOffer, EMPTY_OFFER, offerContract, type ActualOffer } from '../../src/optimizer/offer';
import { profile, TERMS } from '../fixtures/profiles';

const P = profile({ availableCapital: 800_000, maxMonthlyRepayment: 8000 });
const offer = (over: Partial<ActualOffer>): ActualOffer => ({ ...EMPTY_OFFER, ...over });

describe('offer → contract terms', () => {
  it('an empty offer: base terms, every material term listed as missing with a question', () => {
    const t = offerContract(C, TERMS, EMPTY_OFFER, P);
    expect(t.k.combinationPct).toBe(TERMS.combinationPct);
    expect(t.k.arrangement).toBe(C.commercial.taxArrangement);
    expect(t.entered).toEqual([]);
    expect(t.missing.length).toBeGreaterThanOrEqual(10);
    for (const m of t.missing) expect(m.question.length).toBeGreaterThan(5);
  });
  it('who pays which tax → the arrangement (levy on the owner + capital gains on the developer = net with a ₪0 levy cap)', () => {
    expect(offerContract(C, TERMS, offer({ taxes: { ...EMPTY_OFFER.taxes, levy: 'developer', capitalGains: 'developer' } }), P).k.arrangement).toBe('net');
    expect(offerContract(C, TERMS, offer({ taxes: { ...EMPTY_OFFER.taxes, levy: 'developer', capitalGains: 'owner' } }), P).k.arrangement).toBe('mixed');
    expect(offerContract(C, TERMS, offer({ taxes: { ...EMPTY_OFFER.taxes, levy: 'owner', capitalGains: 'owner' } }), P).k.arrangement).toBe('gross');
    const odd = offerContract(C, TERMS, offer({ taxes: { ...EMPTY_OFFER.taxes, levy: 'owner', capitalGains: 'developer' } }), P);
    expect(odd.k.arrangement).toBe('net');
    expect(odd.k.offer.levyCap).toBe(0);
  });
  it('a VAT payer that the arrangement does not match is flagged, not silently modelled', () => {
    const t = offerContract(C, TERMS, offer({ taxes: { ...EMPTY_OFFER.taxes, levy: 'developer', capitalGains: 'owner', vat: 'developer' } }), P);
    expect(t.warnings.join(' ')).toContain('מע״מ');
  });
  it('construction price on the licensed area is converted to the saleable (door-to-door) area of the lot', () => {
    const lot = getLot(C.rights.tableVersion, '149');
    const t = offerContract(C, TERMS, offer({ construction: { pricePerSqm: 10_000, areaBasis: 'licensed' } }), P);
    expect(t.config.construction.costPerSqm).toBeCloseTo((10_000 * lot.aboveGroundArea) / lot.residentialArea, 6);
    const d = offerContract(C, TERMS, offer({ construction: { pricePerSqm: 10_000, areaBasis: 'door_to_door' } }), P);
    expect(d.config.construction.costPerSqm).toBe(10_000);
  });
  it('a completion price becomes the completion factor on the apartment value', () => {
    const t = offerContract(C, TERMS, offer({ completion: { pricePerSqm: 20_000 } }), P);
    expect(t.config.commercial.completionPriceFactor).toBeCloseTo(20_000 / C.market.apartmentValuePerSqm, 9);
  });
  it('a payment schedule must be complete and add up to 100%', () => {
    expect(offerContract(C, TERMS, offer({ schedule: { signing: 0.1, permit: null, construction: null, delivery: null } }), P).errors.length).toBeGreaterThan(0);
    expect(offerContract(C, TERMS, offer({ schedule: { signing: 0.1, permit: 0.1, construction: 0.5, delivery: 0.2 } }), P).errors.length).toBeGreaterThan(0);
    const ok = offerContract(C, TERMS, offer({ schedule: { signing: 0, permit: 0.2, construction: 0.6, delivery: 0.2 } }), P);
    expect(ok.errors).toEqual([]);
    expect(ok.config.construction.schedule.reduce((s, m) => s + m.share, 0)).toBeCloseTo(1, 9);
    expect(ok.config.construction.schedule.find((m) => m.phase === 'signing')?.share ?? 0).toBe(0);
  });
  it('a tax loan in the offer is the contract’s funding, with its rate and cap', () => {
    const t = offerContract(C, TERMS, offer({ taxLoan: { offered: true, amountCap: 150_000, annualRate: 0.06, interestPaidBy: 'developer' } }), P);
    expect(t.k.funding).toBe('developer_loan');
    expect(t.config.financing.taxLoan.annualRate).toBe(0.06);
    expect(t.config.financing.taxLoan.amountCap).toBe(150_000);
    expect(t.k.offer.developerPaysTaxLoanInterest).toBe(true);
  });
  it('validity: an expired offer and a different lot are flagged', () => {
    expect(offerContract(C, TERMS, offer({ validUntil: '2026-01-01' }), P).status).toBe('expired');
    expect(offerContract(C, TERMS, offer({ validUntil: '2027-01-01' }), P).status).toBe('valid');
    expect(offerContract(C, TERMS, offer({ lotId: '150' }), { ...P, lotId: '149' }).warnings.join(' ')).toContain('מגרש');
  });
  it('invalid numbers are rejected', () => {
    expect(offerContract(C, TERMS, offer({ combinationPct: 1.5 }), P).errors.length).toBeGreaterThan(0);
    expect(offerContract(C, TERMS, offer({ construction: { pricePerSqm: -1, areaBasis: 'door_to_door' } }), P).errors.length).toBeGreaterThan(0);
  });
});

describe('offer check', () => {
  it('compares on the common date, as changes against the base terms; a better % raises the owner’s value', () => {
    const c = checkOffer(P, C, TERMS, offer({ combinationPct: 0.4 }));
    expect(c.comparisonDate).toBe(C.analysis.valuationDate);
    const value = c.diff.find((d) => d.id === 'value')!;
    expect(value.offer!).toBeGreaterThan(value.base!);
    expect(value.delta).toBeCloseTo(value.offer! - value.base!, 6);
    for (const d of c.diff) if (d.base !== null && d.offer !== null) expect(d.delta).toBeCloseTo(d.offer - d.base, 6);
  });
  it('the same route is compared on both sides (the offer’s best route, re-evaluated on the base terms)', () => {
    const c = checkOffer(P, C, TERMS, offer({ combinationPct: 0.4 }));
    expect(c.offerRoute).not.toBeNull();
    expect(c.baseRoute?.routeId).toBe(c.offerRoute!.routeId);
  });
  it('the tax-loan cap is respected', () => {
    const p = profile({ availableCapital: 0, maxMonthlyRepayment: 5000 });
    const c = checkOffer(p, C, TERMS, offer({ taxLoan: { offered: true, amountCap: 50_000, annualRate: 0.07, interestPaidBy: 'owner' } }));
    for (const s of c.offerSnapshots) expect(s.result.simulation.taxLoanDrawn).toBeLessThanOrEqual(50_000 + 1e-6);
  });
  it('a Sale Law guarantee changes the developer-failure exposure to the protected loss', () => {
    const p = profile({ availableCapital: 2_000_000, maxMonthlyRepayment: 15_000 });
    const without = checkOffer(p, C, TERMS, offer({ guarantee: 'none' })).diff.find((d) => d.id === 'failure')!;
    const withG = checkOffer(p, C, TERMS, offer({ guarantee: 'sale_law' })).diff.find((d) => d.id === 'failure')!;
    expect(withG.offer!).toBeLessThanOrEqual(without.offer! + 1e-6);
  });
  it('questions cover the missing terms and the conditions', () => {
    const c = checkOffer(P, C, TERMS, EMPTY_OFFER);
    expect(c.questions.length).toBeGreaterThanOrEqual(c.terms.missing.length);
  });
  it('option terms entered (a fee) make options rankable', () => {
    expect(checkOffer(P, C, TERMS, EMPTY_OFFER).optionTermsKnown).toBe(false);
    expect(checkOffer(P, C, TERMS, offer({ option: { exerciseAtApproval: true, fee: 20_000 } })).optionTermsKnown).toBe(true);
  });
  it('when no route is acceptable, the offer’s route is never one that hinges on an unknown price', () => {
    for (const p of [profile({ availableCapital: 0, maxMonthlyRepayment: 0 }), profile({ availableCapital: 800_000, maxMonthlyRepayment: 8000 })]) {
      // Gross terms at 40%: nothing is fundable for these households, so the fallback choice is exercised.
      const c = checkOffer(p, { ...C, commercial: { ...C.commercial, taxArrangement: 'gross' } }, TERMS, offer({ combinationPct: 0.4 }));
      if (!c.offerRoute) continue;
      if (!c.offerRoute.owner.accepts && c.offerSnapshots.some((s) => !s.result.priceDependency)) expect(c.offerRoute.result.priceDependency).toBeNull();
    }
  });
});
