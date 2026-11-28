/**
 * Named configurations for fixtures.
 * LEGACY reproduces the iteration-2 tax assumptions exactly (no contractor profit in the services value, levy
 * simplified to zero, capital-gains tax at signing, 6% completion purchase tax) — kept only so the previously
 * reconciled numbers stay traceable. It is not a current assumption. Legacy and golden fixtures keep the services VAT
 * on the developer (servicesVatOnOwner: false), as before the payer table.
 */
import { PROJECT_CONFIG } from '../../src/data/config';
import type { ProjectConfig as PC } from '../../src/domain/types';

/**
 * The simulation entitlement basis (2.25 rights per 167 m², iterations 1–9). Golden and numeric fixtures that were
 * reconciled on it stay pinned to it; the product default is the official allocation-table share (iteration 10).
 */
export const C_SIM: PC = { ...PROJECT_CONFIG, rights: { ...PROJECT_CONFIG.rights, entitlementBasis: 'simulation' } };
const C = C_SIM;
import type { ProjectConfig, TaxArrangement } from '../../src/domain/types';

export const withArrangement = (cfg: ProjectConfig, taxArrangement: TaxArrangement): ProjectConfig => ({
  ...cfg,
  commercial: { ...cfg.commercial, taxArrangement },
});

export const LEGACY_BASE: ProjectConfig = {
  ...C,
  // Iteration-2 economics: 2% apartment growth, 4% return on cash.
  market: { ...C.market, apartmentValueAnnualGrowth: 0.02 },
  financing: { ...C.financing, alternativeNetAnnualReturn: 0.04 },
  commercial: { ...C.commercial, contractorProfitRate: 0, combinationSaleDate: 'signing' },
  taxation: { ...C.taxation, bettermentLevyFactor: 0, completionPurchaseTax: { soleHome: 0.06, additionalHome: 0.06 }, servicesVatOnOwner: false },
  // Iteration 2 had a single money basis with no inflation (iteration 9 converts today's prices to nominal shekels).
  analysis: { ...C.analysis, inflation: 0 },
};
export const LEGACY_OWNER_PAYS = withArrangement(LEGACY_BASE, 'mixed');
export const LEGACY_NET = withArrangement(LEGACY_BASE, 'net');

/** Reviewer's golden fixture: contractor profit 17.5%, levy simplified to zero, flat 25%, zero basis. */
export const GOLDEN_TAX: ProjectConfig = {
  ...C,
  taxation: { ...C.taxation, bettermentLevyFactor: 0, servicesVatOnOwner: false },
};

/** Iteration-4 tax terms: services VAT always absorbed by the developer (before the payer table). */
export const VAT_ON_DEVELOPER: ProjectConfig = { ...C, taxation: { ...C.taxation, servicesVatOnOwner: false } };

/** No developer/bank tax loan at all, not even as a conditional route (iteration-4 rule). */
export const NO_TAX_LOAN: ProjectConfig = {
  ...C,
  financing: { ...C.financing, taxLoan: { ...C.financing.taxLoan, available: false, considerAsAlternative: false } },
};

/** Iteration-4 tax terms in full: services VAT on the developer and no tax loan. */
export const ITERATION4_TAX_TERMS: ProjectConfig = { ...NO_TAX_LOAN, taxation: VAT_ON_DEVELOPER.taxation };

export const NET = withArrangement(C, 'net');
export const GROSS = withArrangement(C, 'gross');

/** The tax loan switched on at the original iteration-5 terms (6.75%, no VAT on interest, no cap). */
export const WITH_TAX_LOAN: ProjectConfig = {
  ...C,
  financing: { ...C.financing, taxLoan: { ...C.financing.taxLoan, available: true, annualRate: 0.0675, vatOnInterest: false, maxShareOfEntitlement: null } },
};
