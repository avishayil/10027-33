/**
 * Domain contracts for the מימוש חכם decision engine.
 * All amounts are nominal ₪. All rates are fractions (0.35, not 35).
 * Time is measured in whole months from contract signing (month 0).
 */

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------

export type SourceType =
  | 'statutory'
  | 'official_planning'
  | 'official_market'
  | 'secondary_market'
  | 'developer_offer'
  | 'user_assumption'
  | 'planning_assumption';

export type Verification = 'verified' | 'reported' | 'assumed' | 'unknown';

export interface DataPoint<T> {
  value: T;
  /** Short Hebrew label shown in the assumptions panel. */
  label: string;
  sourceType: SourceType;
  sourceUrl?: string;
  sourceName?: string;
  observedAt?: string;
  retrievedAt: string;
  range?: { low: T; high: T };
  verification: Verification;
  notes?: string;
}

// ---------------------------------------------------------------------------
// User input
// ---------------------------------------------------------------------------

export type Goal =
  | 'balanced'
  | 'maximize_apartments'
  | 'passive_income'
  | 'immediate_cash'
  | 'minimize_risk';

export interface UserProfile {
  landAreaSqm: number;
  /** null = the user has not told us. Never silently treated as a real zero. */
  availableCapital: number | null;
  /** 0 = no new mortgage; null = unknown. */
  maxMonthlyRepayment: number | null;
  goal: Goal;

  lotId?: string;
  /** Total historical acquisition cost of the whole holding (₪). null/undefined = unknown. */
  acquisitionBasis?: number | null;
  liquidityDeadlineYears?: number;
}

/** The two commercial sliders. Fractions. */
export interface CommercialTerms {
  combinationPct: number;
  developerMarkup: number;
}

// ---------------------------------------------------------------------------
// Configuration (flat numeric view built from the DataPoints)
// ---------------------------------------------------------------------------

export interface PaymentMilestone {
  /** Position within the development period, 0 = signing, 1 = completion. */
  at: number;
  share: number;
  label: string;
}

export interface ProjectConfig {
  version: string;
  rights: {
    originalAreaSqm: number;
    apartmentEquivalents: number;
    planningVersion: string;
    tableVersion: 'v2';
    defaultLotId: string;
    lotIds: string[];
  };
  construction: {
    costPerSqm: number;
    apartmentSizeSqm: number;
    contingency: number;
    /** Realised overrun above the quote. Scenario-driven; 0 in the base case. */
    costOverrun: number;
    annualIndexation: number;
    durationYears: number;
    permitAt: number;
    schedule: PaymentMilestone[];
  };
  commercial: {
    combination: { min: number; max: number; default: number };
    developerMarkup: { min: number; max: number; default: number };
    revenueShare: number;
    /** When the developer pays for purchased surplus rights (years from signing). */
    developerPaymentYear: number;
    /** Price of completion area as a share of finished-apartment market value. */
    completionPriceFactor: number;
  };
  market: {
    apartmentValuePerSqm: number;
    apartmentValueAnnualGrowth: number;
    monthlyRentPerApartment: number;
    rentalExpenseReserve: number;
    /** Intentionally null: no current parcel-specific valuation exists. */
    immediateLandSalePricePerSqm: number | null;
    /** Historical reported transactions in parcel 33 (pre-106(b)). Reference only. */
    immediateSaleReferencePerSqm: number;
    developerRightsSaleScenario: { pricePerOriginalSqm: number; confirmedOffer: boolean };
  };
  taxation: {
    bettermentLevyRate: number;
    /** Scenario multiplier on the levy proxy (1 in base). */
    bettermentLevyFactor: number;
    vatRate: number;
    indicativeCapitalGainsRate: number;
    landPurchaseTaxRate: number;
    rentalTaxReserve: number;
    saleTransactionCostRate: number;
  };
  financing: {
    nominalAnnualInterest: number;
    stressInterest: number;
    durationYears: number;
    targetRepaymentRatio: number;
    alternativeNetAnnualReturn: number;
    maxLtv: number;
    comfortableLtv: number;
  };
  analysis: {
    horizonYears: number;
    liquidityDeadlineYears: number;
  };
}

// ---------------------------------------------------------------------------
// Rights
// ---------------------------------------------------------------------------

export interface RightsInfo {
  landAreaSqm: number;
  /** Simulation apartment-equivalents: A / 167 × 2.25. */
  apartmentEquivalents: number;
  /** Original parcel m² that correspond to one apartment-equivalent. */
  sqmPerRight: number;
  lotId: string;
  /** Official allocation-table quantities (kept separate from the simulation unit). */
  table: {
    lotShare: number;
    units: number;
    allocationValue: number;
    incomingValue: number;
    increase: number;
  };
  /** Estimated levy on the whole holding (proxy, before scenario factor). */
  bettermentLevy: number;
}

// ---------------------------------------------------------------------------
// Strategies
// ---------------------------------------------------------------------------

export type StrategyType =
  | 'S01' // sell all rights to a developer
  | 'S01M' // sell now on the open market (reference only)
  | 'S02' // full combination
  | 'S03' // construction services for all whole apartments, sell the fraction
  | 'S04' // revenue sharing
  | 'S05' // sell surplus rights, build fewer whole apartments
  | 'S06' // combination + paid completion to whole apartments
  | 'S07' // build several, sell one at completion
  | 'S08' // build, keep and rent (rent counts toward repayment)
  | 'S09' // wait and reassess after approval
  | 'S10'; // buy complementary rights and build

export type Leg =
  | { kind: 'sell_rights'; rights: number; market: 'developer' | 'open_market' }
  | { kind: 'combination'; rights: number }
  | { kind: 'completion'; apartmentEquivalents: number }
  | { kind: 'buy_rights'; rights: number }
  | { kind: 'build'; apartments: number; ownRightsUsed: number; purchasedRightsUsed: number }
  | { kind: 'revenue_share'; rights: number }
  | { kind: 'sell_apartments'; apartments: number }
  | { kind: 'hold_land'; rights: number }
  | { kind: 'rent_for_repayment' };

export interface Candidate {
  id: string;
  type: StrategyType;
  legs: Leg[];
  /** Whole apartments the owner is targeting to keep. */
  targetApartments: number;
}

export type LedgerCategory =
  | 'sale_proceeds'
  | 'revenue_share'
  | 'apartment_sale'
  | 'construction'
  | 'betterment_levy'
  | 'capital_gains_tax'
  | 'purchase_tax'
  | 'transaction_costs'
  | 'rights_purchase'
  | 'completion_payment';

export type Payer = 'owner' | 'developer' | 'buyer' | 'seller';

export interface LedgerEntry {
  category: LedgerCategory;
  label: string;
  /** Positive magnitude. */
  amount: number;
  direction: 'in' | 'out';
  month: number;
  payer: Payer;
  /** For levy entries: which apartment-equivalents of rights the entry covers. */
  rightsPortion?: number;
  /** True for liabilities that are not paid within the horizon (held land). */
  deferred?: boolean;
  range?: { low: number; high: number };
  /** Part of disposing of land rights (used to compute net sale proceeds). */
  saleRelated?: boolean;
}

export interface CashEvent {
  month: number;
  /** + source, − use. */
  amount: number;
  label: string;
  category: LedgerCategory;
}

export interface TransactionPlan {
  events: CashEvent[];
  ledger: LedgerEntry[];
  rightsSold: number;
  rightsPurchased: number;
  rightsInCombination: number;
  rightsInRevenueShare: number;
  rightsBuilt: number;
  rightsHeld: number;
  /** Apartment-equivalents owned after completion (may be fractional). */
  retainedApartmentEquivalents: number;
  wholeApartmentsRetained: number;
  apartmentsBuilt: number;
  completionMonth: number;
  rentCountsForRepayment: boolean;
  /** Value of held land at the horizon, before deferred liabilities. */
  heldLandValueAtHorizon: number;
  deferredLiabilities: number;
  /** Indicative value a lender might recognise (today's prices). */
  collateralValue: number;
  constructionCost: number;
  capitalGainsRange: { low: number; high: number };
}

export interface SimulationResult {
  cashAtHorizon: number;
  debtAtHorizon: number;
  peakDebt: number;
  totalDrawn: number;
  peakPersonalMonthly: number;
  constructionPhaseMonthly: number;
  postCompletionMonthly: number;
  monthlyNetRent: number;
  personalPaymentsFV: number;
  cashAtLiquidityDeadline: number;
  cashAtCompletion: number;
  /** Starting capital grown at the alternative return, at completion. */
  referenceAtCompletion: number;
  /** Largest amount of the user's own starting capital that was consumed. */
  personalCapitalUsed: number;
  yearly: { year: number; cash: number; debt: number }[];
}

export type Feasibility = 'estimated_feasible' | 'conditional' | 'fragile' | 'infeasible' | 'unknown';

export type ReasonCode =
  | 'NO_BORROWING_CAPACITY'
  | 'REPAYMENT_EXCEEDED'
  | 'LTV_EXCEEDED'
  | 'CAPITAL_UNKNOWN'
  | 'IMMEDIATE_PRICE_UNKNOWN'
  | 'FRACTIONAL_UNIT'
  | 'ADVERSE_FAILS'
  | 'NO_DEBT'
  | 'USES_MORTGAGE'
  | 'RENT_SUPPORTS_REPAYMENT'
  | 'COMBINATION_BELOW_WHOLE_UNIT'
  | 'NOT_ENOUGH_RIGHTS';

export type ConditionCode =
  | 'DEVELOPER_PRICE_UNVERIFIED'
  | 'PARTIAL_RIGHTS_PURCHASE'
  | 'REVENUE_SHARE_UNVERIFIED'
  | 'COMPLETION_PRICE'
  | 'COMPLEMENTARY_SELLER'
  | 'LENDER_CONFIRMATION'
  | 'MORTGAGE_CAPACITY_UNKNOWN'
  | 'LTV_ABOVE_COMFORT'
  | 'WHOLE_UNIT_ALLOCATION'
  | 'TAX_ALLOCATION'
  | 'CURRENT_APPRAISAL';

export interface ScenarioAssessment {
  fails: ReasonCode[];
  conditions: ConditionCode[];
  missing: ReasonCode[];
}

export type ScenarioId = 'favorable' | 'base' | 'adverse';

export interface ScenarioResult {
  scenarioId: ScenarioId;
  futureNetWealth: number;
  valueCreated: number;
  mortgageRequired: number;
  monthlyRepayment: number;
  feasible: boolean;
  fails: ReasonCode[];
}

export interface Metrics {
  /** Value created from the land at the horizon (wealth − starting capital grown). */
  valueCreated: number;
  resilience: number;
  wholeApartments: number;
  liquidity: number;
  simplicity: number;
  sustainableMonthlyIncome: number;
  peakDebt: number;
}

export interface StrategyResult {
  id: string;
  strategyType: StrategyType;
  candidate: Candidate;

  originalRights: number;
  rightsSold: number;
  rightsPurchased: number;
  residualRights: number;
  completedApartmentTarget: number;

  grossSaleProceeds: number;
  netSaleProceeds: number;

  constructionCost: number;
  bettermentLevy: number;
  capitalGainsTaxReserve: number;
  capitalGainsRange: { low: number; high: number };
  purchaseTax: number;
  additionalCosts: number;

  personalCapitalRequired: number;
  mortgageRequired: number;
  monthlyRepayment: number;
  peakFundingGap: number;

  completedPropertyValue: number;
  estimatedNetMonthlyRentalCashflow: number;
  netPresentValue: number;
  futureNetWealth: number;

  feasibility: Feasibility;
  reasonCodes: ReasonCode[];
  requiredConditions: ConditionCode[];
  scenarioResults: ScenarioResult[];
  metrics: Metrics;
  ledger: LedgerEntry[];
  plan: TransactionPlan;
  simulation: SimulationResult;
}

export type NegotiationCode =
  | 'MIN_SURPLUS_PRICE'
  | 'MAX_CONSTRUCTION_COST'
  | 'MAX_DEVELOPER_MARKUP'
  | 'MIN_COMBINATION_PCT'
  | 'MAX_COMPLETION_PAYMENT'
  | 'REQUIRED_ADDITIONAL_CAPITAL'
  | 'MAX_SUSTAINABLE_MORTGAGE'
  | 'LATEST_SURPLUS_PAYMENT';

export interface NegotiationTarget {
  code: NegotiationCode;
  strategyId?: string;
  /** null = not achievable within the searched range. */
  value: number | null;
  unit: 'ils' | 'ils_per_sqm' | 'pct' | 'months';
  /** The current assumption, for comparison. */
  current?: number;
  note?: string;
}

export interface FollowUpQuestion {
  id: string;
  question: string;
  why: string;
}

export interface Sensitivity {
  byScenario: Record<ScenarioId, string | null>;
  /** Parameters that, on their own, change the top recommendation. */
  drivers: string[];
}

export interface DecisionResult {
  rights: RightsInfo;
  results: StrategyResult[];
  ranked: StrategyResult[];
  frontierIds: string[];
  recommendation: StrategyResult | null;
  alternatives: StrategyResult[];
  negotiationTargets: NegotiationTarget[];
  followUpQuestions: FollowUpQuestion[];
  sensitivity: Sensitivity;
  mortgageCapacity: number | null;
}
