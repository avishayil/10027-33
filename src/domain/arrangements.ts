/**
 * Who pays each owner-side tax in a combination, per contractual arrangement. The legal liability for all three stays
 * with the owner; the arrangement decides who pays under the contract. The economic burden ends up in the combination %
 * (see optimizer/arrangementEquivalence.ts) — a developer who takes on taxes offers a lower %.
 */
import type { Payer, ProjectConfig, TaxArrangement } from './types';

export interface ArrangementPayers {
  levy: Payer;
  capitalGainsTax: Payer;
  /** VAT on the construction services the owner receives (a private owner cannot reclaim it). */
  servicesVat: Payer;
}

export const ARRANGEMENT_PAYERS: Record<TaxArrangement, ArrangementPayers> = {
  gross: { levy: 'owner', capitalGainsTax: 'owner', servicesVat: 'owner' },
  mixed: { levy: 'developer', capitalGainsTax: 'owner', servicesVat: 'owner' },
  net: { levy: 'developer', capitalGainsTax: 'developer', servicesVat: 'developer' },
};

export const TAX_ARRANGEMENTS: TaxArrangement[] = ['gross', 'mixed', 'net'];

/**
 * One tax under the contract: the share of it the developer pays and an optional cap on that payment (₪, for the
 * holding). The owner pays the rest. Gross / mixed / net are templates; an actual offer can cap or share.
 */
export interface TaxTerm {
  developerShare: number;
  developerCap: number | null;
}

export interface ContractTerms {
  levy: TaxTerm;
  capitalGains: TaxTerm;
  servicesVat: TaxTerm;
}

/** Terms of an actual developer offer that override the template (advanced input; all optional). */
export interface OfferTerms {
  /** The developer pays the levy only up to this amount (₪, for the holding); the excess is on the owner. */
  levyCap: number | null;
  /** The developer bears the interest on the owner's tax loan (the owner repays principal only). */
  developerPaysTaxLoanInterest: boolean;
}

const term = (share: number, cap: number | null = null): TaxTerm => ({ developerShare: share, developerCap: cap });

/** Contract terms for an arrangement template, with an actual offer's overrides. */
export function termsFor(arrangement: TaxArrangement, offer?: Partial<OfferTerms>, servicesVatOnOwner = true): ContractTerms {
  const p = ARRANGEMENT_PAYERS[arrangement];
  const share = (x: Payer) => (x === 'developer' ? 1 : 0);
  return {
    levy: term(share(p.levy), share(p.levy) > 0 ? (offer?.levyCap ?? null) : null),
    capitalGains: term(share(p.capitalGainsTax)),
    servicesVat: term(servicesVatOnOwner ? share(p.servicesVat) : 1),
  };
}

/** The developer's part of a tax that is not itself consideration (levy, VAT): min(share × amount, cap). */
export function developerPart(amount: number, t: TaxTerm, capLeft: number | null = t.developerCap): number {
  const x = t.developerShare * amount;
  return capLeft === null ? x : Math.max(0, Math.min(x, capLeft));
}

/**
 * The developer's part of the owner's capital-gains tax. Paying it is itself consideration (§17(d)), so the tax grows:
 * t = t0 + r·x and x = s·t ⇒ x = s·t0 / (1 − s·r) (full gross-up at s = 1), capped.
 */
export function developerTaxPart(t0: number, t: TaxTerm, rate: number): number {
  if (t.developerShare <= 0 || t0 <= 0) return 0;
  const x = (t.developerShare * t0) / (1 - t.developerShare * rate);
  return t.developerCap === null ? x : Math.min(x, t.developerCap);
}

export function withArrangement(config: ProjectConfig, taxArrangement: TaxArrangement): ProjectConfig {
  return { ...config, commercial: { ...config.commercial, taxArrangement } };
}
