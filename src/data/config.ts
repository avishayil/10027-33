/**
 * Assembles the flat ProjectConfig the engine runs on, from the provenance-tagged DataPoints.
 * Bump CONFIG_VERSION whenever a value changes.
 */
import type { DataPoint, ProjectConfig } from '../domain/types';
import { COMBINATION_RANGE, COMMERCIAL, MARKUP_RANGE, PAYMENT_SCHEDULE, PERMIT_AT } from './commercial';
import { FINANCING, MARKET } from './market';
import { DEFAULT_LOT_ID, PLANNING_VERSION, PROJECT, TARGET_LOT_IDS } from './project';
import { REGULATION } from './regulation';

export const CONFIG_VERSION = '2026-11-27.1';

export const PROJECT_CONFIG: ProjectConfig = {
  version: CONFIG_VERSION,
  rights: {
    originalAreaSqm: PROJECT.originalAreaSqm.value,
    apartmentEquivalents: PROJECT.apartmentEquivalentsPerBlock.value,
    planningVersion: PLANNING_VERSION,
    tableVersion: 'v2',
    defaultLotId: DEFAULT_LOT_ID,
    lotIds: TARGET_LOT_IDS,
  },
  construction: {
    costPerSqm: COMMERCIAL.constructionCostPerSqm.value,
    apartmentSizeSqm: PROJECT.apartmentSizeSqm.value,
    contingency: COMMERCIAL.contingency.value,
    costOverrun: 0,
    annualIndexation: COMMERCIAL.annualIndexation.value,
    durationYears: COMMERCIAL.durationYears.value,
    permitAt: PERMIT_AT,
    schedule: PAYMENT_SCHEDULE,
  },
  commercial: {
    combination: COMBINATION_RANGE,
    developerMarkup: MARKUP_RANGE,
    revenueShare: COMMERCIAL.revenueShare.value,
    developerPaymentYear: COMMERCIAL.developerPaymentYear.value,
    completionPriceFactor: COMMERCIAL.completionPriceFactor.value,
    approvalYears: COMMERCIAL.approvalYears.value,
    fractionCashSettlementFactor: COMMERCIAL.fractionCashSettlementFactor.value,
  },
  developerPolicy: {
    servicesCapShareOfLot: COMMERCIAL.servicesCapShareOfLot.value,
    maxServiceApartmentsPerOwner: COMMERCIAL.maxServiceApartmentsPerOwner.value,
    noServicesWhenCombinationYieldsWhole: COMMERCIAL.noServicesWhenCombinationYieldsWhole.value === 1,
  },
  developer: {
    directCostPerSqm: COMMERCIAL.developerDirectCostPerSqm.value,
    softCostRate: COMMERCIAL.developerSoftCostRate.value,
    targetMarginOnRevenue: COMMERCIAL.developerTargetMargin.value,
  },
  market: {
    apartmentValuePerSqm: MARKET.apartmentValuePerSqm.value,
    apartmentValueAnnualGrowth: MARKET.apartmentValueAnnualGrowth.value,
    monthlyRentPerApartment: MARKET.monthlyRentPerApartment.value,
    rentalExpenseReserve: MARKET.rentalExpenseReserve.value,
    immediateLandSalePricePerSqm: null,
    immediateSaleReferencePerSqm: MARKET.immediateSaleReferencePerSqm.value,
    postApprovalLandValuePerSqm: MARKET.postApprovalLandValuePerSqm.value,
    fractionIlliquidityDiscount: MARKET.fractionIlliquidityDiscount.value,
    developerRightsSaleScenario: {
      pricePerOriginalSqm: MARKET.developerRightsPricePerOriginalSqm.value,
      confirmedOffer: false,
    },
  },
  taxation: {
    bettermentLevyRate: REGULATION.bettermentLevyRate.value,
    bettermentLevyFactor: 1,
    vatRate: REGULATION.vatRate.value,
    indicativeCapitalGainsRate: REGULATION.indicativeCapitalGainsRate.value,
    landPurchaseTaxRate: REGULATION.landPurchaseTaxRate.value,
    rentalTaxReserve: REGULATION.rentalTaxReserve.value,
    saleTransactionCostRate: REGULATION.saleTransactionCostRate.value,
    revenueShareTaxAtSigning: true,
  },
  financing: {
    nominalAnnualInterest: FINANCING.nominalAnnualInterest.value,
    stressInterest: FINANCING.stressInterest.value,
    durationYears: FINANCING.durationYears.value,
    targetRepaymentRatio: FINANCING.targetRepaymentRatio.value,
    alternativeNetAnnualReturn: FINANCING.alternativeNetAnnualReturn.value,
    maxLtv: FINANCING.maxLtv.value,
    comfortableLtv: FINANCING.comfortableLtv.value,
  },
  analysis: {
    horizonYears: PROJECT.horizonYears.value,
    liquidityDeadlineYears: 2,
  },
};

export interface AssumptionGroup {
  id: string;
  title: string;
  items: DataPoint<number | string>[];
}

/** Every external assumption, grouped for the assumptions panel and the provenance test. */
export const ASSUMPTION_GROUPS: AssumptionGroup[] = [
  { id: 'project', title: 'קרקע ותכנון', items: Object.values(PROJECT) },
  { id: 'commercial', title: 'בנייה ותנאים מסחריים', items: Object.values(COMMERCIAL) },
  { id: 'market', title: 'שווי שוק', items: Object.values(MARKET) },
  { id: 'financing', title: 'מימון', items: Object.values(FINANCING) },
  { id: 'regulation', title: 'מסים ורגולציה', items: Object.values(REGULATION) },
];
