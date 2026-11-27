/**
 * Assembles the flat ProjectConfig the engine runs on, from the provenance-tagged DataPoints.
 * Bump CONFIG_VERSION whenever a value changes.
 */
import type { DataPoint, ProjectConfig } from '../domain/types';
import { COMBINATION_RANGE, COMMERCIAL, MARKUP_RANGE, PAYMENT_SCHEDULE } from './commercial';
import { APPRAISAL_FIGURES, relativeValueByRooms } from './evidence';
import { FINANCING, MARKET } from './market';
import { DEFAULT_LOT_ID, PLANNING_VERSION, PROJECT, TARGET_LOT_IDS } from './project';
import { REGULATION } from './regulation';

export const CONFIG_VERSION = '2026-11-27.7';

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
    schedule: PAYMENT_SCHEDULE,
  },
  timeline: {
    approvalMonths: COMMERCIAL.approvalMonths.value,
    permitAfterApprovalMonths: COMMERCIAL.permitAfterApprovalMonths.value,
    constructionMonths: COMMERCIAL.constructionMonths.value,
    settlementDelayMonths: 0,
  },
  commercial: {
    combination: COMBINATION_RANGE,
    developerMarkup: MARKUP_RANGE,
    revenueShare: COMMERCIAL.revenueShare.value,
    developerPaymentYear: COMMERCIAL.developerPaymentYear.value,
    completionPriceFactor: COMMERCIAL.completionPriceFactor.value,
    fractionCashSettlementFactor: COMMERCIAL.fractionCashSettlementFactor.value,
    taxArrangement: 'mixed',
    combinationSaleDate: 'approval',
    contractorProfitRate: COMMERCIAL.contractorProfitRate.value,
    offer: { levyCap: null, developerPaysTaxLoanInterest: false },
  },
  developerPolicy: {
    servicesCapShareOfLot: COMMERCIAL.servicesCapShareOfLot.value,
    maxServiceApartmentsPerOwner: COMMERCIAL.maxServiceApartmentsPerOwner.value,
    noServicesWhenCombinationYieldsWhole: COMMERCIAL.noServicesWhenCombinationYieldsWhole.value === 1,
    referenceCombinationPct: 0.35,
    capShareRange: { restrictive: 0.2, flexible: 0.3 },
    confirmed: false,
  },
  developer: {
    directCostPerSqm: null,
    survey: {
      aboveGroundPerSqm: COMMERCIAL.surveyTowerCostPerSqm.value,
      undergroundPerSqm: COMMERCIAL.surveyUndergroundCostPerSqm.value,
      balconyShare: COMMERCIAL.surveyBalconyShare.value,
    },
    softCostRate: COMMERCIAL.developerSoftCostRate.value,
    targetMarginOnRevenue: COMMERCIAL.developerTargetMargin.value,
    equityShare: COMMERCIAL.developerEquityShare.value,
    escortLoanRate: COMMERCIAL.escortLoanRate.value,
    presaleShare: COMMERCIAL.presaleShare.value,
  },
  market: {
    apartmentTypes: [
      { rooms: 3, sizeSqm: 81, relativeValue: relativeValueByRooms(3)!.mean },
      { rooms: 4, sizeSqm: 100, relativeValue: 1 },
      { rooms: 5, sizeSqm: 122, relativeValue: relativeValueByRooms(5)!.mean },
    ],
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
    complementaryRightsPricePerSqm: null,
  },
  taxation: {
    bettermentLevyRate: REGULATION.bettermentLevyRate.value,
    bettermentLevyFactor: 1,
    vatRate: REGULATION.vatRate.value,
    indicativeCapitalGainsRate: REGULATION.indicativeCapitalGainsRate.value,
    landPurchaseTaxRate: REGULATION.landPurchaseTaxRate.value,
    rentalTaxReserve: REGULATION.rentalTaxReserve.value,
    completionPurchaseTax: { soleHome: 0, additionalHome: REGULATION.completionPurchaseTaxAdditional.value },
    saleTransactionCostRate: REGULATION.saleTransactionCostRate.value,
    revenueShareTaxAtSigning: true,
    servicesVatOnOwner: true,
  },
  financing: {
    nominalAnnualInterest: FINANCING.nominalAnnualInterest.value,
    stressInterest: FINANCING.stressInterest.value,
    durationYears: FINANCING.durationYears.value,
    targetRepaymentRatio: FINANCING.targetRepaymentRatio.value,
    alternativeNetAnnualReturn: FINANCING.alternativeNetAnnualReturn.value,
    maxLtv: FINANCING.maxLtv.value,
    comfortableLtv: FINANCING.comfortableLtv.value,
    ltvLimits: { soleHome: 0.75, replacementHome: 0.7, additionalHome: 0.5 },
    workInProgressRecognition: COMMERCIAL.workInProgressRecognition.value,
    taxLoan: {
      available: false,
      annualRate: FINANCING.taxLoanAnnualInterest.value,
      vatOnInterest: true,
      maxShareOfEntitlement: FINANCING.taxLoanMaxShareOfEntitlement.value,
      considerAsAlternative: true,
    },
    otherPropertyLoanAssumed: false,
  },
  analysis: {
    horizonYears: PROJECT.horizonYears.value,
    liquidityDeadlineYears: 2,
    discountRate: FINANCING.realDiscountRate.value,
  },
  projection: { apartmentValueAnnualGrowth: 0.02, alternativeNetAnnualReturn: 0.04 },
  publicConstruction: {
    sqmPerLot: APPRAISAL_FIGURES.publicBuildingPerLotSqm.value,
    costPerSqm: APPRAISAL_FIGURES.publicShellConstructionPerSqm.value,
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
