/**
 * Predefined stress scenarios. Proposed stress assumptions — not statistical confidence intervals.
 * The commercial sliders (combination %, developer markup) keep the user's values in every scenario.
 */
import type { ProjectConfig, ScenarioId, Timeline } from '../domain/types';

export interface ScenarioParams {
  apartmentValuePerSqm: number;
  /** Realised construction overrun above the quote (adverse ₪12,650 = ₪11,000 × 1.15). */
  costOverrun: number;
  interest: number;
  /** Approval, permit lag, construction and settlement delay — explicit dependent milestones. */
  timeline: Timeline;
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
  timeline: 'לוח זמנים (אישור, היתר, בנייה, מכירת יחידת סל)',
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
      timeline: { approvalMonths: 18, permitAfterApprovalMonths: 0, constructionMonths: 30, settlementDelayMonths: 0 },
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
      // Approval a year late, the permit a year after it, longer construction, and the pool sale / buy-back a year
      // after delivery (a tax loan with no whole apartment to refinance on then has nothing to repay it from).
      timeline: { approvalMonths: 36, permitAfterApprovalMonths: 12, constructionMonths: 48, settlementDelayMonths: 12 },
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
    timeline: config.timeline,
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
      annualIndexation: p.annualIndexation,
    },
    timeline: p.timeline,
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
    // The tax-loan rate moves with the mortgage rate (both priced off prime).
    financing: {
      ...config.financing,
      nominalAnnualInterest: p.interest,
      taxLoan: { ...config.financing.taxLoan, annualRate: config.financing.taxLoan.annualRate + (p.interest - config.financing.nominalAnnualInterest) },
    },
  };
}

export function applyScenario(config: ProjectConfig, id: ScenarioId): ProjectConfig {
  return id === 'base' ? config : applyScenarioParams(config, scenarioParams(config, id));
}

export const SCENARIO_IDS: ScenarioId[] = ['favorable', 'base', 'adverse'];
