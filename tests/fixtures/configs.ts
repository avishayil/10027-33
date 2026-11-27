/**
 * Named configurations for fixtures.
 * LEGACY reproduces the iteration-2 tax assumptions exactly (no contractor profit in the services value, levy
 * simplified to zero, capital-gains tax at signing, 6% completion purchase tax) — kept only so the previously
 * reconciled numbers stay traceable. It is not a current assumption.
 */
import { PROJECT_CONFIG as C } from '../../src/data/config';
import type { ProjectConfig, TaxArrangement } from '../../src/domain/types';

export const withArrangement = (cfg: ProjectConfig, taxArrangement: TaxArrangement): ProjectConfig => ({
  ...cfg,
  commercial: { ...cfg.commercial, taxArrangement },
});

export const LEGACY_BASE: ProjectConfig = {
  ...C,
  commercial: { ...C.commercial, contractorProfitRate: 0, combinationSaleDate: 'signing' },
  taxation: { ...C.taxation, bettermentLevyFactor: 0, completionPurchaseTax: { soleHome: 0.06, additionalHome: 0.06 } },
};
export const LEGACY_OWNER_PAYS = withArrangement(LEGACY_BASE, 'mixed');
export const LEGACY_NET = withArrangement(LEGACY_BASE, 'net');

/** Reviewer's golden fixture: contractor profit 17.5%, levy simplified to zero, flat 25%, zero basis. */
export const GOLDEN_TAX: ProjectConfig = {
  ...C,
  taxation: { ...C.taxation, bettermentLevyFactor: 0 },
};

export const NET = withArrangement(C, 'net');
export const GROSS = withArrangement(C, 'gross');
