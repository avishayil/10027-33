/**
 * Domain contracts for the deal-simulation decision engine.
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
  /**
   * How much the household can borrow against its other property (₪). Only when given is that loan assumed available
   * (up to the limit); otherwise it is a conditional funding route.
   */
  otherPropertyBorrowingLimit?: number | null;
  /** The completed apartment replaces the household's current home (sold within the period): 70% mortgage limit. */
  replacementHome?: boolean;
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
  /** Signing (month 0), the building permit, or a point in the construction period. */
  phase: 'signing' | 'permit' | 'construction';
  /** For 'construction': position within the construction period, 0 = permit, 1 = delivery. */
  at: number;
  share: number;
  label: string;
}

/**
 * Explicit milestones, each dependent on the previous: plan approval → building permit → construction → delivery.
 * A permit can never precede the approval of the plan it depends on.
 */
export interface Timeline {
  approvalMonths: number;
  permitAfterApprovalMonths: number;
  constructionMonths: number;
  /** Delay of a pool sale / developer buy-back after delivery (0 in base; a stress in the adverse scenario). */
  settlementDelayMonths: number;
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
    schedule: PaymentMilestone[];
  };
  timeline: Timeline;
  commercial: {
    combination: { min: number; max: number; default: number };
    developerMarkup: { min: number; max: number; default: number };
    revenueShare: number;
    /** When the developer pays for purchased surplus rights (years from signing). */
    developerPaymentYear: number;
    /** Price of completion area as a share of finished-apartment market value. */
    completionPriceFactor: number;
    /** Price at which a developer settles a fractional entitlement in cash, as a share of market value. */
    fractionCashSettlementFactor: number;
    /**
     * Tax arrangement in combination deals: gross (owner pays levy, capital-gains tax and services VAT), mixed
     * (developer pays the levy), net (developer pays all three, the tax grossed up). This is what the offer at the
     * slider's combination % includes; the other arrangements are evaluated at their developer-equivalent %.
     */
    taxArrangement: TaxArrangement;
    /** Statutory sale date for a pre-approval combination: plan approval under §19(3א) (conditional) or signing. */
    combinationSaleDate: 'approval' | 'signing';
    /** Ordinary contractor profit inside the taxable market value of construction services (instruction 23/98). */
    contractorProfitRate: number;
    /** Terms of an actual developer offer that override the arrangement template (advanced, optional). */
    offer: { levyCap: number | null; developerPaysTaxLoanInterest: boolean };
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
    /**
     * Override of the developer's direct construction cost per saleable m² (matrix / break-even rows). null = the
     * evidence-based budget: the plan's built areas per lot × the appraisers' survey rates.
     */
    directCostPerSqm: number | null;
    /** June 2026 construction-cost survey (Sharon): per licensed m² above ground (tower), underground; balcony share. */
    survey: { aboveGroundPerSqm: number; undergroundPerSqm: number; balconyShare: number };
    /** Planning, fees, financing, marketing and overhead as a share of direct cost. */
    softCostRate: number;
    /** Indicative profit a developer requires, as a share of revenue net of VAT. */
    targetMarginOnRevenue: number;
    /** Lot-level model: developer equity as a share of total costs, funded before the escort loan. */
    equityShare: number;
    /** Lot-level model: escort (ליווי) loan rate on the drawn balance. */
    escortLoanRate: number;
    /** Lot-level model: share of the developer's sales received as presales during construction. */
    presaleShare: number;
  };
  market: {
    /**
     * Apartment types for value-based allocation. Value relative to the 4-room standard comes from appraisal
     * comparables (pp.69/73) — smaller units cost more per m². Not confirmed project inventory.
     */
    apartmentTypes: { rooms: number; sizeSqm: number; relativeValue: number }[];
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
    /** Price per original m² for buying complementary rights from other owners; null = the post-approval reference. */
    complementaryRightsPricePerSqm: number | null;
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
    /**
     * VAT on the construction services received in a combination is charged to whoever the arrangement names
     * (owner in gross/mixed, developer in net). Off = the developer always absorbs it (iteration 1–4 behaviour).
     */
    servicesVatOnOwner: boolean;
  };
  financing: {
    nominalAnnualInterest: number;
    stressInterest: number;
    durationYears: number;
    targetRepaymentRatio: number;
    alternativeNetAnnualReturn: number;
    /** Pre-delivery (construction-stage) financing limit. */
    maxLtv: number;
    comfortableLtv: number;
    /**
     * Mortgage limits on a delivered apartment by the buyer's status (Bank of Israel directive 329): a sole home,
     * a replacement home, an additional (investment) home. An unknown status is treated as an additional home.
     */
    ltvLimits: { soleHome: number; replacementHome: number; additionalHome: number };
    /** Share of amounts already paid into construction that a lender might recognise as security before completion. */
    workInProgressRecognition: number;
    /**
     * Tax loan from the developer or the financing bank for combination taxes (reported practice). Not assumed:
     * `available` is off in the headline; the engine evaluates it as a conditional funding route.
     */
    taxLoan: {
      available: boolean;
      /** Before VAT on interest (prime + 2%). */
      annualRate: number;
      /** Developer loans: VAT charged on the interest (Rothstein: prime + 2% plus VAT). */
      vatOnInterest: boolean;
      /** Facility cap as a share of the owner's apartment entitlement value today; null = no cap. */
      maxShareOfEntitlement: number | null;
      /** Evaluate it as a conditional funding route when it is not assumed (off = no tax loan exists at all). */
      considerAsAlternative: boolean;
    };
    /** Assume a loan on another property without a stated limit (only for the conditional funding run). */
    otherPropertyLoanAssumed: boolean;
    /** The loan on another property ("any purpose"): rate and term; it amortises from the draw. */
    securedLoan: { annualRate: number; years: number };
  };
  analysis: {
    horizonYears: number;
    liquidityDeadlineYears: number;
    /** Real annual rate for the present value the ranking compares (today's prices; iteration 7). */
    discountRate: number;
    /** Inflation used to deflate nominal flows (indexed construction payments, loans) to today's prices. */
    inflation: number;
  };
  /** Illustrative long-term projection only (never used for the primary verdict). */
  projection: { apartmentValueAnnualGrowth: number; alternativeNetAnnualReturn: number };
  /** Developer-side project obligations (appraisal evidence). */
  publicConstruction: { sqmPerLot: number; costPerSqm: number };
}

// ---------------------------------------------------------------------------
// Rights
// ---------------------------------------------------------------------------

export interface RightsInfo {
  landAreaSqm: number;
  /** True when no lot was given and the default lot was assumed. */
  lotAssumed: boolean;
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
  | 'S11' // mixed: combination on part of the rights + construction services on the rest
  | 'S13' // combination + a whole apartment of a different size (value-based allocation)
  | 'S14'; // a combination route with whole apartments, renting them out (rent supports repayment)

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
  /**
   * Convert the fractional combination entitlement into one whole apartment of `sizeSqm` (value-based): pay the
   * value gap if the apartment is worth more, receive the excess (settlement factor) if it is worth less.
   */
  | { kind: 'tier_apartment'; rooms: number }
  /** Replace the whole entitlement by this mix of apartment types (by rooms); the value gap is paid or received. */
  | { kind: 'apartment_mix'; rooms: number[] }
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
  | 'services_vat'
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
  /** A combination tax the owner pays that a developer/bank tax loan may cover. */
  taxLoanEligible?: boolean;
}

export interface CashEvent {
  month: number;
  /** + source, − use. */
  amount: number;
  label: string;
  category: LedgerCategory;
  /** A combination tax the owner pays that a developer/bank tax loan may cover. */
  taxLoanEligible?: boolean;
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
  /** Value (in standard-apartment equivalents) of the whole apartments the owner keeps — sizes may differ. */
  wholeApartmentValueEq: number;
  /** Sizes (m²) of the whole apartments the owner keeps. Illustrative types — not confirmed inventory. */
  apartmentSizes: number[];
  /** Value of each whole apartment kept, in standard-apartment equivalents. */
  apartmentValues: number[];
  /** Room counts of the whole apartments the owner keeps. */
  apartmentRooms: number[];
  /** Monthly benefit of living in a kept apartment (rent saved) — NOT cash; shown only in the projection. */
  housingBenefitMonthly: number;
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
  /** Outstanding debt right after the completion month. */
  debtAtCompletion: number;
  /** Interest paid from income up to and including completion. */
  interestPaidToCompletion: number;
  /** Starting capital grown at the alternative return, at completion. */
  referenceAtCompletion: number;
  /** Largest amount of the user's own starting capital that was consumed. */
  personalCapitalUsed: number;
  /** Borrowing by financing stage. */
  drawsByStage: Record<FinancingStage, number>;
  /** Obligations no lender finances (taxes, levy, costs) that cash could not cover. Not a loan — no interest. */
  unfunded: number;
  /** Taxes/levy/costs financed by a loan secured on another property the household owns (conditional). */
  taxesFinancedBySecuredLoan: number;
  /** Combination taxes covered by a tax loan from the developer or the financing bank (conditional). */
  taxLoanDrawn: number;
  /** Interest capitalised on the tax loan until delivery (then refinanced as a mortgage). */
  taxLoanInterest: number;
  /** Tax-loan balance due at delivery (principal + capitalised interest), before any repayment. */
  taxLoanAtMaturity: number;
  /** Interest on regular debt paid after delivery, within the horizon. */
  interestAfterCompletion: number;
  /** Tax-loan balance that had to be refinanced as a mortgage at delivery (not repaid from cash). */
  taxLoanRefinanced: number;
  /** Tax-loan interest the developer bears on the owner's behalf (a developer cost, not the owner's). */
  taxLoanSubsidy: number;
  /** Present value at signing of all interest the owner pays (monthly interest, and capitalised interest at maturity). */
  pvInterest: number;
  /** Interest paid up to plan approval (what financing would have cost if the plan is then cancelled). */
  interestToApproval: number;
  /** PV of the owner's financing flows: + loan proceeds, − debt service (interest + principal), − debt left at the end. */
  pvFinancing: number;
  /** Each financing facility on its own: drawn, peak balance, rate and repayment schedule. */
  facilities: {
    type: 'project_loan' | 'secured_other_property' | 'tax_loan';
    drawn: number;
    peak: number;
    annualRate: number;
    repayment: 'interest_only_then_amortising' | 'amortising_from_draw' | 'bullet_at_delivery';
    termMonths: number;
    monthsUsed: number;
  }[];
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
  /** The tax loan falls due at delivery but the money to repay it (a pool sale / buy-back) comes later. */
  | 'TAX_LOAN_EXTENSION_NEEDED'
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
  | 'LEVY_TERMS'
  | 'SECURED_LOAN_OTHER_PROPERTY'
  | 'TAX_LOAN'
  | 'TAX_LOAN_REFINANCE'
  | 'REPAID_FROM_POOL_SALE';

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
  /** Position at delivery minus interest after delivery, in this scenario (the ranking value). */
  comparisonValue: number;
  mortgageRequired: number;
  monthlyRepayment: number;
  feasible: boolean;
  fails: ReasonCode[];
}

export interface Metrics {
  /**
   * Ranking value (iteration 6): position at delivery in today's prices minus interest paid after delivery within the
   * horizon. (The 10-year wealth stays in the optional projection.)
   */
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
  /** VAT on construction services received in a combination, when the owner pays it (gross / mixed). */
  servicesVat: number;
  /**
   * Owner money paid before plan approval (e.g. a construction prepayment, rights bought, tax on a revenue-share
   * deal) — at risk if the plan is not approved within the horizon. Conditional contracts risk nothing.
   */
  approvalRisk: number;
  /**
   * If the plan is never approved: conditional contracts lapse, no apartments are built, no rent, and the owner keeps
   * the land. Three scenarios, since the loss depends on guarantees, refunds and conditions in the contract:
   * protected (advances refunded; interest and non-refundable costs lost), partially protected (half the advances),
   * unprotected (all advances and interest — the maximum modelled exposure). Bought rights stay the owner's, but their
   * resale value is unknown — not credited.
   */
  noApproval: {
    advances: number;
    interest: number;
    /** Non-refundable costs paid before approval (purchase tax, transaction costs). */
    nonRefundable: number;
    /** Paid for complementary rights before approval (the rights remain; resale value unknown). */
    purchasedRights: number;
    protected: number;
    partial: number;
    unprotected: number;
    apartments: 0;
    rent: 0;
  };
  capitalGainsRange: { low: number; high: number };
  purchaseTax: number;
  additionalCosts: number;

  personalCapitalRequired: number;
  mortgageRequired: number;
  monthlyRepayment: number;
  peakFundingGap: number;

  completedPropertyValue: number;
  estimatedNetMonthlyRentalCashflow: number;
  /** The deal before personal financing: ledger flows and the apartments, discounted (real, today's prices). */
  transactionValue: number;
  futureNetWealth: number;
  /** Owner cash obligations at signing (excluding the contingency reserve). */
  cashAtSigning: number;
  /** Primary, today's-price view at delivery (no appreciation, no investment return). */
  delivery: DeliverySnapshot;
  /** The ranking value: delivery position minus interest after delivery (= metrics.valueCreated). */
  comparisonValue: number;
  /** The lot-level developer P&L with this owner on this route (null when the route involves no developer). */
  developerLot: LotPnLSummary | null;
  /** Betterment levy on the owner's original rights: total proxy and who pays it. */
  levy: LevyBreakdown;
  /** Non-null when the outcome depends on a price or term nobody has verified (excluded from the ranking). */
  priceDependency: PriceKnob | null;
  /** Net cash in hand right after delivery, beyond the starting capital grown. */
  netCashAtDelivery: number;

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
  /** When the fallback depends on an unverified price: the price it would need. */
  fallbackThreshold: PriceThreshold | null;
  /** When the fallback comes from another arrangement's run: those terms (its % is the equivalent %). */
  fallbackTerms: { arrangement: TaxArrangement; combinationPct: number } | null;
  /** Strategies outside the expected developer policy — negotiation-only, not recommended. */
  negotiationOnly: StrategyResult[];
  /** Strategies whose outcome depends on an unverified price — with the price they would need. */
  priceConditional: { result: StrategyResult; threshold: PriceThreshold }[];
  /** Land value references for the owner's area: dated transactions, appraisal, and what is unknown. */
  landReferences: LandReference[];
  /** True when the lot was not given and lot 149 was assumed (levy shown as a range across lots). */
  lotAssumed: boolean;
  levyRangeAcrossLots: { min: number; max: number };
  /**
   * When nothing fits under the headline terms but a route fits under a different tax arrangement: that route,
   * presented as a conditional direction ("works if the developer bears the taxes").
   */
  /**
   * Nothing fits under the headline terms, but a route fits with financing the household must still obtain
   * (kind 'funding': a tax loan or a loan on another property, under the offer's own terms) or under other tax terms
   * (kind 'arrangement', at that arrangement's equivalent %).
   */
  conditionalRecommendation: {
    result: StrategyResult;
    kind: 'funding' | 'arrangement';
    method: FundingMethod | null;
    arrangement: TaxArrangement;
    combinationPct: number;
  } | null;
  /** Conditional funding routes for the owner's taxes, evaluated automatically (none is assumed in the headline). */
  fundingAlternatives: FundingAlternative[];
  /** Developer-side thresholds on the lot model (calculated, not market estimates). */
  developerThresholds: DeveloperThresholds;
  /** When no evidence-based route fits: the closest ones and the extra capital each would need. */
  nearMiss: { result: StrategyResult; additionalCapital: number | null }[];
  /** Extra own capital per evidence-based route type that does not fit (one per strategy type). */
  capitalGaps: { result: StrategyResult; additionalCapital: number | null }[];
  /** Optional illustrative long-term projection for the recommendation, itemised so every shekel is explained. */
  projection: Projection | null;
}

export interface Projection {
  years: number;
  apartmentGrowth: number;
  alternativeReturn: number;
  /** Apartments (and any unresolved fraction / held land) at the horizon, at the assumed growth. */
  assets: number;
  cash: number;
  debt: number;
  mortgagePaymentsFV: number;
  deferredLiabilities: number;
  unfunded: number;
  startingCapitalGrown: number;
  /** assets + cash − debt − payments − deferred − unfunded − starting capital grown. */
  total: number;
  /** Non-cash: rent saved by living in the apartment(s) after delivery (not included in total). */
  housingBenefit: number;
}

export interface LotPnLSummary {
  units: number;
  servicesUnits: number;
  revenue: number;
  costs: number;
  financingCost: number;
  profit: number;
  margin: number;
  profitOnCost: number;
  /** Physical apartments this owner receives on the route. */
  userPhysicalUnits: number;
}

export interface DeveloperThresholds {
  /** Viable % (target margin) for developer direct cost × apartment price; null = not viable even at 0%. */
  matrix: { directCosts: number[]; apartmentPrices: number[]; cells: (number | null)[][] };
  /** At the offer's %: highest developer direct cost / lowest apartment price that leave the target margin. */
  maxDirectCostPerSqm: number | null;
  minApartmentPricePerSqm: number | null;
  targetMarginOnRevenue: number;
  profitOnCostAtTarget: number;
  /** The three lots on the offer's terms. */
  project: { lots: { lotId: string; profit: number; margin: number; units: number }[]; profit: number; margin: number; units: number };
  /** Lot margin at the offer's % with 0 / 50 / 100% of the services quota taken up. */
  participation: { share: number; margin: number }[];
  /** The evidence-based budget of the owner's lot and its sensitivities (survey ±10%, the appraisal's 27% indirect). */
  budget: {
    direct: number;
    perSaleableSqm: number;
    lines: { aboveGround: number; underground: number; balconies: number };
    sensitivity: { label: string; margin: number }[];
  };
}

export type FundingMethod = 'developer_loan' | 'other_property';

export interface FundingAlternative {
  method: FundingMethod;
  /** Effective annual rate to the owner (developer loan: incl. VAT on interest). */
  annualRate: number;
  /** Best route with this funding (null = still nothing fits). */
  top: StrategyResult | null;
  /** Principal borrowed for taxes, capitalised interest and the balance due at delivery. */
  loan: number;
  interest: number;
  atMaturity: number;
  /** What the owner saves if the developer also bears the interest. */
  savingIfDeveloperPaysInterest: number;
  /** Highest rate at which the route still fits (null = not reached / not applicable). */
  maxRate: number | null;
  /** In the same run: the best whole 3-room apartment route (instead of selling the fraction), if it fits. */
  smaller: StrategyResult | null;
}

export interface ArrangementOutcome {
  arrangement: TaxArrangement;
  /**
   * The combination % this arrangement was evaluated at: the slider for the headline, otherwise the
   * developer-equivalent % (same developer profit). Null when no % in range is equivalent.
   */
  combinationPct: number | null;
  /** The % under this arrangement at which the owner is as well off as under the headline offer. */
  ownerBreakEvenPct: number | null;
  /** The highest % at which the lot still leaves the developer its target margin (lot-level P&L); null = none. */
  viablePct: number | null;
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

export type PriceKnob =
  | 'developer_price'
  | 'post_approval_price'
  | 'immediate_price'
  | 'revenue_share'
  | 'buyback_factor'
  /** Price paid to other owners for complementary rights — a cost, so the threshold is a maximum. */
  | 'complementary_price';

export interface DeliverySnapshot {
  /** Value of the whole apartments kept, at today's comparable-based scenario price. */
  apartmentsValue: number;
  /** Unresolved fractional share at today's price less the illiquidity discount. */
  fractionValue: number;
  ownerCashIn: number;
  ownerCashOut: number;
  constructionAndCompletionPaid: number;
  interestToDelivery: number;
  debtAtDelivery: number;
  /** Receipts due after delivery (e.g. a delayed pool sale): receivables at delivery, not cash. */
  receivablesAfterDelivery: number;
  /** Owner payments due after delivery. */
  payablesAfterDelivery: number;
  /**
   * Position at delivery (display): apartments + fraction + cash in − cash out by delivery + receivables − payables
   * − interest to delivery (today's prices; debt is financing). The ranking uses the present value instead.
   */
  netPosition: number;
}

export interface LevyBreakdown {
  /** Allocation-table proxy for the owner's original rights (incoming vs outgoing value × 50%). */
  total: number;
  owner: number;
  developer: number;
  /** Transferred to a buyer (pre-approval sale) — future exposure, not zero liability. */
  buyer: number;
  /** Owner levy not yet paid within the horizon (held land). */
  deferred: number;
  /** Month the owner pays its share (null if none). */
  ownerMonth: number | null;
}

export interface PriceThreshold {
  strategyId: string;
  knob: PriceKnob;
  /** Required value (₪ per original m², or a fraction for share/factor). null = not reached in the searched range. */
  required: number | null;
  /** 'min': at least this much (a price you receive); 'max': at most this much (a price you pay). */
  direction: 'min' | 'max';
  /** What it must beat: the evidence-based recommendation, or affordability only. */
  against: string | null;
  /** The unverified scenario value the engine would otherwise have used. */
  scenarioValue: number;
}

export interface LandReference {
  label: string;
  amount: number | null;
  date: string;
  level: 'observedTransaction' | 'planningAppraisal' | 'confirmedOffer' | 'unknown';
  note: string;
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
  /** Lot-level P&L on the offer's terms (the basis of combinationMargin and maxCombinationAtTargetMargin). */
  lot: {
    units: number;
    servicesUnits: number;
    developerUnits: number;
    revenue: number;
    costs: number;
    financingCost: number;
    profit: number;
    peakEquity: number;
    peakLoan: number;
    lines: { label: string; amount: number }[];
  };
}
