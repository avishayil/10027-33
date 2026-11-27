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

export function withArrangement(config: ProjectConfig, taxArrangement: TaxArrangement): ProjectConfig {
  return { ...config, commercial: { ...config.commercial, taxArrangement } };
}
