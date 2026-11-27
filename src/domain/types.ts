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
  | 'planning_assumption'
  | 'official_rule'
  | 'court_ruling'
  | 'offer_confirmed'
  | 'unknown';

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
  /** Would a completed apartment be the household's only home? null/undefined = unknown (adaptive follow-up). */
  soleHome?: boolean | null;
}

/** Who carries the taxes in a combination (and revenue-sharing) deal. */
export type TaxArrangement = 'gross' | 'mixed' | 'net';

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
    /** Years from today until statutory approval (waiting strategy sells then). */
    approvalYears: number;
    /** Price at which a developer settles a fractional entitlement in cash, as a share of market value. */
    fractionCashSettlementFactor: number;
    /**
     * Tax arrangement in combination deals: gross (owner pays levy and capital-gains tax), mixed (developer pays
     * the levy), net (developer pays both, the tax grossed up). The engine evaluates all three; this is the headline.
     */
    taxArrangement: TaxArrangement;
    /** Statutory sale date for a pre-approval combination: plan approval under §19(3א) (conditional) or signing. */
    combinationSaleDate: 'approval' | 'signing';
    /** Ordinary contractor profit inside the taxable market value of construction services (instruction 23/98). */
    contractorProfitRate: number;
  };
  /** Expected developer policy for construction services (שירותי בנייה) inside a lot. Planning assumption. */
  developerPolicy: {
    /** Share of a lot's units the developer is expected to release for construction services (20–30%). */
    servicesCapShareOfLot: number;
    /** Most apartments one owner can build through construction services. */
    maxServiceApartmentsPerOwner: number;
    /** No construction services for owners whose full combination already yields a whole apartment. */
    noServicesWhenCombinationYieldsWhole: boolean;
    /** Project-wide reference combination rate used for the eligibility test (not the individual slider). */
    referenceCombinationPct: number;
    /** Lot-share scenarios for the services quota: restrictive / expected / flexible. */
    capShareRange: { restrictive: number; flexible: number };
    /** True only if the project has confirmed the policy in writing — then out-of-policy routes are unavailable. */
    confirmed: boolean;
  };
  developer: {
    /** Developer's own direct construction cost per m² (no markup). */
    directCostPerSqm: number;
    /** Planning, fees, financing, marketing and overhead as a share of direct cost. */
    softCostRate: number;
    /** Indicative profit a developer requires, as a share of revenue net of VAT. */
    targetMarginOnRevenue: number;
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
    /** Open-market land value per original m² once the plan is approved (independent of developer offers). */
    postApprovalLandValuePerSqm: number;
    /** Discount applied to an unresolved fractional apartment share (illiquid co-ownership). */
    fractionIlliquidityDiscount: number;
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
    /** Purchase tax on buying the missing part of an apartment: range by the buyer's property status. */
    completionPurchaseTax: { soleHome: number; additionalHome: number };
    saleTransactionCostRate: number;
    /** Capital-gains tax on revenue-sharing deals is assessed at signing (conservative). */
    revenueShareTaxAtSigning: boolean;
  };
  financing: {
    nominalAnnualInterest: number;
    stressInterest: number;
    durationYears: number;
    targetRepaymentRatio: number;
    alternativeNetAnnualReturn: number;
    maxLtv: number;
    comfortableLtv: number;
    /** Share of amounts already paid into construction that a lender might recognise as security before completion. */
    workInProgressRecognition: number;
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
  | 'S02' // full combination (fraction kept as an unresolved share)
  | 'S02C' // full combination, fraction settled in cash
  | 'S02P' // full combination, fraction pooled into a balancing unit (יחידת סל)
  | 'S03' // construction services for all whole apartments, sell the fraction
  | 'S04' // revenue sharing
  | 'S05' // sell surplus rights, build fewer whole apartments
  | 'S06' // combination + paid completion to whole apartments
  | 'S07' // build several, sell one at completion
  | 'S08' // build, keep and rent (rent counts toward repayment)
  | 'S09' // wait and reassess after approval
  | 'S10' // buy complementary rights and build
  | 'S11'; // mixed: combination on part of the rights + construction services on the rest

export type Leg =
  | { kind: 'sell_rights'; rights: number; market: 'developer' | 'open_market' | 'post_approval' }
  | { kind: 'combination'; rights: number }
  | { kind: 'completion'; apartmentEquivalents: number }
  | { kind: 'buy_rights'; rights: number }
  /** `apartments` may be fractional (S11 builds only the part of an apartment not covered by combination). */
  | { kind: 'build'; apartments: number; ownRightsUsed: number; purchasedRightsUsed: number }
  /** The developer buys out a fractional combination entitlement for cash at completion. */
  | { kind: 'settle_fraction_cash' }
  /** The fraction joins a project balancing pool (יחידת סל) sold at completion; net proceeds distributed. */
  | { kind: 'balancing_pool' }
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
  | 'completion_payment'
  | 'fraction_settlement'
  | 'contingency_reserve'
  | 'contingency_release';

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
  /** Unresolved fractional share (no rent, illiquid). */
  fractionalShare: number;
  /** Land rights the owner still holds before completion (built share, combination-retained share, purchased). */
  retainedLandRights: number;
  apartmentsBuilt: number;
  /** Completed apartments the owner sells at completion (S07). */
  apartmentsSoldByOwner: number;
  /** A fractional entitlement settled at completion (developer cash buy-back or balancing pool). */
  fractionSettled: { mode: 'cash' | 'pool'; share: number } | null;
  completionMonth: number;
  rentCountsForRepayment: boolean;
  /** Value of held land at the horizon, before deferred liabilities. */
  heldLandValueAtHorizon: number;
  deferredLiabilities: number;
  /** Land a lender could recognise before completion (retained rights at the developer price). Sold rights excluded. */
  preCompletionLandCollateral: number;
  /** Whole retained apartments (today's prices) — fractional shares excluded. */
  postCompletionCollateral: number;
  constructionCost: number;
  capitalGainsRange: { low: number; high: number };
}

export type FinancingStage = 'bridge' | 'construction' | 'mortgage';

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
  /** Borrowing by financing stage. */
  drawsByStage: Record<FinancingStage, number>;
  /** Obligations no lender finances (taxes, levy, costs) that cash could not cover. Not a loan — no interest. */
  unfunded: number;
  unfundedItems: { month: number; category: LedgerCategory; label: string; amount: number }[];
  peakPreCompletionLtv: number;
  peakPostCompletionLtv: number;
  yearly: { year: number; cash: number; debt: number }[];
}

/** Financial affordability — can the household fund it? */
export type Affordability = 'fits' | 'fits_with_financing' | 'does_not_fit' | 'unknown';
/** Does it survive the adverse scenario? */
export type Resilience = 'robust' | 'fragile';
/** Have the commercial terms it relies on been confirmed, and are they plausible for a developer? */
export type CommercialCertainty = 'not_required' | 'unverified' | 'questionable' | 'negotiable';

export interface Assessment {
  affordability: Affordability;
  resilience: Resilience;
  commercial: CommercialCertainty;
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
  | 'NOT_ENOUGH_RIGHTS'
  | 'UNFUNDED_OBLIGATION'
  | 'DEVELOPER_POLICY_WHOLE_FROM_COMBINATION'
  | 'DEVELOPER_POLICY_PER_OWNER_CAP'
  | 'FRACTION_UNRESOLVED';

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
  | 'CURRENT_APPRAISAL'
  | 'BRIDGE_FINANCING'
  | 'CONSTRUCTION_FINANCING'
  | 'MIXED_STRUCTURE'
  | 'FRACTION_SETTLEMENT'
  | 'PLANNING_APPROVAL'
  | 'SERVICES_CAPACITY'
  | 'SALE_DATE_DEFERRAL'
  | 'COMPLETION_CLASSIFICATION'
  | 'NET_TAX_TERMS'
  | 'LEVY_TERMS';

export interface ScenarioAssessment {
  fails: ReasonCode[];
  /** Financing conditions (affect affordability). */
  conditions: ConditionCode[];
  /** Commercial / legal dependencies (affect commercial certainty, not affordability). */
  commercial: ConditionCode[];
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
  /** 1 = no developer dependency, 0.6 = unverified, 0.2 = questionable (negative modelled developer margin). */
  commercialScore: number;
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
  assessment: Assessment;
  /** Indicative developer margin on revenue for this candidate's own deal (null = no developer involved). */
  developerMargin: number | null;
  developerPnL: DeveloperPnL | null;
  reasonCodes: ReasonCode[];
  /** Financing and commercial conditions together. */
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
  | 'LATEST_SURPLUS_PAYMENT'
  | 'BREAKEVEN_SURPLUS_PRICE'
  | 'CONSERVATIVE_SURPLUS_PRICE'
  | 'IMMEDIATE_SALE_MIN_PRICE'
  | 'MAX_COMBINATION_AT_TARGET_MARGIN'
  | 'DEVELOPER_RESIDUAL_LAND_PRICE'
  | 'COMBINATION_CONSISTENT_PRICE'
  | 'NEGOTIATION_RANGE';

export interface NegotiationTarget {
  code: NegotiationCode;
  strategyId?: string;
  /** null = not achievable within the searched range. */
  value: number | null;
  unit: 'ils' | 'ils_per_sqm' | 'pct' | 'months';
  /** The current assumption, for comparison. */
  current?: number;
  /** For NEGOTIATION_RANGE: the developer's maximum (value is the owner's minimum). */
  upper?: number | null;
  /** For NEGOTIATION_RANGE: whether the owner's minimum is at or below the developer's maximum. */
  overlap?: boolean;
  /** What the threshold answers: affordability, economic break-even, conservative recommendation, developer side. */
  kind?: 'financing' | 'breakeven' | 'conservative' | 'developer' | 'general';
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
  developer: DeveloperEconomics;
  lotPolicy: LotPolicy;
  /** Recommendation under each tax arrangement (the headline uses config.commercial.taxArrangement). */
  arrangements: ArrangementOutcome[];
  /** What to do if the headline's unconfirmed conditions fail. */
  fallback: StrategyResult | null;
  /** Strategies outside the expected developer policy — negotiation-only, not recommended. */
  negotiationOnly: StrategyResult[];
}

export interface ArrangementOutcome {
  arrangement: TaxArrangement;
  recommendationId: string | null;
  wholeApartments: number;
  feasibility: Feasibility | null;
  cashAtSigning: number;
  mortgageRequired: number;
}

/** How scarce construction-services slots are expected to be in the user's lot. */
export interface LotPolicy {
  lotId: string;
  lotUnits: number;
  capShare: number;
  /** Units the developer is expected to release for construction services in the lot (integer, rounded down). */
  capUnits: number;
  capUnitsRange: { restrictive: number; flexible: number };
  /** Whether the policy is confirmed by the project (only then is out-of-policy "unavailable"). */
  confirmed: boolean;
  /** HYPOTHETICAL count of owners who would want a slot if every holding were 167 m² — not actual demand. */
  estimatedDemand: number;
  /** Rights at or above which full combination already yields a whole apartment (1 / c). */
  wholeFromCombinationThreshold: number;
  maxServiceApartmentsPerOwner: number;
  /** Whether this owner is expected to be offered construction services at all. */
  servicesOffered: boolean;
}

/** Indicative per-candidate developer P&L (standalone, today's prices, before financing and timing). */
export interface DeveloperPnL {
  revenue: number;
  costs: number;
  profit: number;
  marginOnRevenue: number;
  marginOnCost: number;
  lines: { label: string; amount: number }[];
}

export interface DeveloperEconomics {
  /** Gross value of the combination entitlement per original m² (undiscounted, today's prices). */
  impliedCombinationValuePerSqm: number;
  combinationEntitlementValue: number;
  grossSaleValue: number;
  /** Developer margin on revenue (net of VAT) for a full combination at the selected %. */
  combinationMargin: number;
  /** Developer margin when buying all the land at the developer price scenario. */
  landPurchaseMargin: number;
  /** Highest combination % that still leaves the developer its target margin. */
  maxCombinationAtTargetMargin: number;
  /** Highest cash price per original m² that leaves the developer its target margin. */
  residualLandValuePerSqm: number;
  revenueShareMargin: number;
  /** Grossed-up capital-gains tax the developer pays for the owner in a net combination (0 if not net). */
  combinationTaxCost: number;
  /** Cash price per original m² that leaves the developer as well off as the selected combination offer. */
  consistentCashPricePerSqm: number;
}
