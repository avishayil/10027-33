import type { CommercialTerms, UserProfile } from '../../src/domain/types';

export const TERMS: CommercialTerms = { combinationPct: 0.35, developerMarkup: 0.175 };

export const profile = (over: Partial<UserProfile> = {}): UserProfile => ({
  landAreaSqm: 167,
  availableCapital: 300000,
  maxMonthlyRepayment: 5000,
  goal: 'balanced',
  ...over,
});

export const NO_MEANS = profile({ availableCapital: 0, maxMonthlyRepayment: 0 });
export const MODERATE = profile({ availableCapital: 300000, maxMonthlyRepayment: 5000 });
export const WEALTHY = profile({ availableCapital: 1500000, maxMonthlyRepayment: 15000 });
