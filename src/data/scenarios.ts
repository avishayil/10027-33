/**
 * Predefined stress scenarios. Proposed stress assumptions — not statistical confidence intervals.
 * The commercial sliders (combination %, developer markup) keep the user's values in every scenario.
 */
import type { ProjectConfig, ScenarioId } from '../domain/types';

export interface ScenarioParams {
  apartmentValuePerSqm: number;
  /** Realised construction overrun above the quote (adverse ₪12,650 = ₪11,000 × 1.15). */
  costOverrun: number;
  interest: number;
  durationYears: number;
  developerPriceFactor: number;
  monthlyRent: number;
  levyFactor: number;
  annualIndexation: number;
  /** Open-market price today (pre-approval), per original m². */
  immediateSalePricePerSqm: number;
  postApprovalLandValuePerSqm: number;
}

export type ScenarioParamKey = keyof ScenarioParams;

export const SCENARIO_LABELS: Record<ScenarioId, string> = {
  favorable: 'אופטימי',
  base: 'בסיס',
  adverse: 'שמרני',
};

export const PARAM_LABELS: Record<ScenarioParamKey, string> = {
  apartmentValuePerSqm: 'שווי דירה למ״ר',
  costOverrun: 'חריגה בעלות הבנייה',
  interest: 'ריבית משכנתא',
  durationYears: 'משך הפרויקט',
  developerPriceFactor: 'מחיר שהיזם ישלם על זכויות',
  monthlyRent: 'שכר דירה',
  levyFactor: 'שומת היטל ההשבחה',
  annualIndexation: 'הצמדת עלויות בנייה',
  immediateSalePricePerSqm: 'מחיר מכירה מיידית בשוק',
  postApprovalLandValuePerSqm: 'שווי קרקע אחרי אישור (ועיכוב באישור)',
};

export function scenarioParams(config: ProjectConfig, id: ScenarioId): ScenarioParams {
  if (id === 'favorable') {
    return {
      apartmentValuePerSqm: 28000,
      costOverrun: 0,
      interest: 0.04,
      durationYears: 3,
      developerPriceFactor: 1.1,
      monthlyRent: 6500,
      levyFactor: 0.85,
      annualIndexation: 0.01,
      immediateSalePricePerSqm: 2739,
      postApprovalLandValuePerSqm: 7810,
    };
  }
  if (id === 'adverse') {
    return {
      apartmentValuePerSqm: 21000,
      costOverrun: 0.15,
      interest: config.financing.stressInterest,
      durationYears: 8,
      developerPriceFactor: 0.75,
      monthlyRent: 4500,
      levyFactor: 1.25,
      annualIndexation: 0.05,
      immediateSalePricePerSqm: 1647,
      postApprovalLandValuePerSqm: 5325,
    };
  }
  return {
    apartmentValuePerSqm: config.market.apartmentValuePerSqm,
    costOverrun: 0,
    interest: config.financing.nominalAnnualInterest,
    durationYears: config.construction.durationYears,
    developerPriceFactor: 1,
    monthlyRent: config.market.monthlyRentPerApartment,
    levyFactor: 1,
    annualIndexation: config.construction.annualIndexation,
    immediateSalePricePerSqm: config.market.immediateLandSalePricePerSqm ?? config.market.immediateSaleReferencePerSqm,
    postApprovalLandValuePerSqm: config.market.postApprovalLandValuePerSqm,
  };
}

/** Returns a config with the given scenario parameters applied. Does not mutate. */
export function applyScenarioParams(config: ProjectConfig, p: ScenarioParams): ProjectConfig {
  return {
    ...config,
    construction: {
      ...config.construction,
      costOverrun: p.costOverrun,
      durationYears: p.durationYears,
      annualIndexation: p.annualIndexation,
    },
    market: {
      ...config.market,
      apartmentValuePerSqm: p.apartmentValuePerSqm,
      monthlyRentPerApartment: p.monthlyRent,
      immediateSaleReferencePerSqm: p.immediateSalePricePerSqm,
      postApprovalLandValuePerSqm: p.postApprovalLandValuePerSqm,
      developerRightsSaleScenario: {
        ...config.market.developerRightsSaleScenario,
        pricePerOriginalSqm: config.market.developerRightsSaleScenario.pricePerOriginalSqm * p.developerPriceFactor,
      },
    },
    taxation: { ...config.taxation, bettermentLevyFactor: config.taxation.bettermentLevyFactor * p.levyFactor },
    financing: { ...config.financing, nominalAnnualInterest: p.interest },
  };
}

export function applyScenario(config: ProjectConfig, id: ScenarioId): ProjectConfig {
  return id === 'base' ? config : applyScenarioParams(config, scenarioParams(config, id));
}

export const SCENARIO_IDS: ScenarioId[] = ['favorable', 'base', 'adverse'];
