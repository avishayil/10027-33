# Economic contract — shared BLRO semantics in this repository

The governing specification defines a logical contract shared with LandLens (same inputs + evidence version + kernel
version + contract snapshot ⇒ the same financial results). This document maps it onto this codebase, states the
invariants and where they are tested, and lists the cross-product fixtures. It is a logical contract: no shared package,
service or runtime dependency. Status: **v0 (mapping)** — schema v1 fields land in Milestone B (BACKLOG-V1 MH-01).

## 1. Canonical entities ↔ code

| Entity | Here today | Gap to v1 (Milestone B) |
|---|---|---|
| `ProjectPack` | `src/data/config.ts` (`PROJECT_CONFIG`, `CONFIG_VERSION`), `src/data/parcel33.js` (allocation tables), `src/data/evidence.ts`, `src/data/{project,market,regulation,commercial,sources}.ts` (DataPoints with source, date, verification) | One versioned, validated pack object (`src/pack/`): schema version, pack id/version, plan and allocation versions, lots, rights model, inventory explicitly unknown, cost scopes, rules, scenarios; `PROJECT_CONFIG` derived from it; refuse unsupported versions |
| `EvidenceRef` | `config.evidence` (statuses observed / appraisal / confirmed_offer / assumed / hypothetical / unknown); DataPoint `verification` (verified / reported / assumed / unknown); `evidence.ts` levels | Canonical statuses `verified_fact`, `reported`, `appraisal_reference`, `confirmed_offer`, `assumption`, `scenario`, `unknown`, stable ids, locators, observed/retrieved dates |
| `RightsHolding` | `UserProfile` (area, lot) → `calculateRights` (`domain/rights.ts`): official share and, separately, the 2.25 simulation conversion (`rights.entitlementBasis`) | Expose both figures and the residual in one object |
| `InventoryClaim` | `ConsiderationReconciliation.claims` (`domain/lotDeveloper.ts` `considerationReconciliation`): recipient owner / pool / unallocated, quantity, area, value, price basis, source | Lot and unit type ids; reservation date |
| `ParticipantProfile` | `UserProfile` (anonymous, local); `GroupMember` | Explicit party ids and roles in the snapshot |
| `ContractSnapshot` | `optimizer/contract.ts` `ContractSnapshot`: id (fingerprint of lot + terms + route), inputHash, lotId, terms (`ContractTerms`), route (legs), owner and developer projections from one evaluation, consideration, conditions, status, result | `schemaVersion`, `kernelVersion`, `packId`/`packVersion`, `scenarioId`, `participants`, `events`, `facilities`, `inventoryClaims`, `evidenceIds`; `inputHash` over profile + full config + terms |
| `BilateralEvent` | `TransactionPlan.ledger` (`LedgerEntry`: category, amount, direction, month, payer, price basis) and `plan.events` (`CashEvent`) | Source → destination party (government, bank, buyer, developer, pool), liable party vs contractual payer, monetary basis, evidence and conditions |
| `FinancingFacility` | `SimulationResult.facilities` (project loan, tax loan, tax-loan refinance transfer, secured loan) with drawn amounts; tax-loan balance history fields | Draw schedule, rate/indexation/fees, collateral, maturity, repayment source, approval status, terminal balance per facility |
| `EvaluationResult` | `StrategyResult` (metrics, reason codes, conditions, scenario results, ledger, simulation, developer lot P&L) + `DecisionResult` | Snapshot id link; search coverage fields are already in `JointResult` / `GroupResult` (`complete: false`, resolution, bounds) |

Monetary basis: plan events state `priceBasis` (`real` = today's prices, `nominal` = fixed/indexed shekels on their
date); the cash-flow simulation runs on one nominal timeline and valuation deflates it once
(`tests/domain/moneyBasis.test.ts`). Physical unit counts are kept apart from fractional economic entitlements
(`considerationReconciliation.physicalApartments`, `tests/domain/consideration.test.ts`). Missing values stay `null`
(validation: `domain/validation.ts`; unknown ≠ zero throughout `UserProfile`).

## 2. Economic invariants and where they are enforced

| Invariant (spec §B) | Enforced by | Status |
|---|---|---|
| Rights and assets conserved incl. external parties and unsettled claims; no duplicated inventory; valuation differences explicitly allocated | `considerationReconciliation` claims; `tests/domain/consideration.test.ts` (owner + unallocated = developer forgone); pool conservation `tests/optimizer/collective.test.ts` G1 | holds; residual allocation explicit on the simulation basis |
| Every cash event has a source and a recipient; facilities reconcile; loan proceeds are not profit; refinance is not consideration | payer + direction on `LedgerEntry`; facility rows `tests/domain/accounting10.test.ts` F1/F2; `tests/domain/facilities.test.ts` | partial — no recipient field, no per-facility terminal reconciliation test (MH-01, MH-05) |
| Liability, contractual payer and funding separated; tax timing by the relevant event | `domain/arrangements.ts` per-tax terms; `tests/domain/contractTerms.test.ts`, `arrangements.test.ts`; tax loan conditional (`taxLoan.available: false`) | holds for payer/timing; liable-vs-payer field to add with events |
| Events only when prerequisites hold; approval precedes permit; no receipt before settlement; a contingent branch cannot alter the common history | `tests/domain/timeline.test.ts`; `shiftBeforeExercise` + `tests/optimizer/contingent.test.ts` C2 | holds; explicit receipt-after-settlement invariant to add |
| Owner and developer on the same snapshot, scenario and dates; the project baseline excludes the owner's tax profile | `optimizer/contract.ts`; `tests/optimizer/jointSearch.test.ts` J1; `typical()` in `lotDeveloper.ts` uses a zero-basis typical holding | holds |
| Transaction NPV, equity NPV, delivery balance sheet and projection distinct; common date and basis; no double counting | `evaluate.ts` (`transactionValue`, `comparisonValue`, `delivery`, projection); `tests/optimizer/equityValue.test.ts`, `accounting10.test.ts` D4 | holds |
| Hard failure, missing information, modelled conditional and confirmed terms kept apart; software never approves | `Affordability` (`unknown` ≠ `does_not_fit`); `ContractStatus` (never `terms_confirmed` while outside options are unknown); typed evidence (D7) | holds |

## 3. Cross-product fixtures

Independent expected numbers; tolerance stated in each test. "Basis": `SIM` = `C_SIM` (2.25 per 167 m²), `OFF` = the
official default, `—` = a pure function with explicit inputs.

| Fixture | Expected | Test | Basis | Status |
|---|---|---|---|---|
| 167 m² / 2.25 / 35% | 0.7875 equivalents = ₪1,968,750 | `tests/validation/golden.test.ts`, `tests/domain/consideration.test.ts` | SIM | pass |
| Hybrid one unit | x = 0.326923, 1.923077 in combination; services ≈ ₪498,607 | `golden.test.ts`, `tests/optimizer/iteration2.test.ts` | SIM | pass (engine-paid amount bounded, exact pre-indexation figure to assert — MH-12) |
| Official vs simulated | ₪2,307,793 vs ₪1,968,750, ₪339,043 unallocated (material) | `consideration.test.ts` | SIM / OFF | pass |
| Levy proxy | incoming ≈ ₪200,492, outgoing ≈ ₪714,371, 50% ≈ ₪256,939 | `tests/optimizer/iteration4.test.ts`, `tests/domain/financial.test.ts` | SIM | pass |
| Bought 0.75 right before approval | buyer levy ≈ ₪85,646, once | `tests/domain/boughtRightsLevy.test.ts` | SIM | partial (arithmetic; dated purchase and once-only on a 0.75 purchase to add) |
| 102 units, 25% quota | 25 slots; partial claim takes a whole slot; displaced participant | `tests/domain/quota.test.ts` | OFF | pass |
| ₪1M received before ₪1M spent | no financing | `tests/validation/release.test.ts` | — | pass |
| Project ₪300K, tax maturity ₪200K in cash | project draws ₪300K | `tests/domain/accounting10.test.ts` F1 | — | pass (assert cash repayment, refinance 0 — to add) |
| ₪2.5M real collateral, 2%, year 5, 50% | nominal ceiling ≈ ₪1,380,101 | `accounting10.test.ts` F3 | — | pass (engine-derived 50% end-to-end — to add) |
| ₪1M real in year 5 | ₪1,104,081 nominal; deflated once | `tests/domain/moneyBasis.test.ts` | — | pass |
| Tax maturity before pool sale | cash first, capped facility, gap flagged; no false gap | `tests/domain/taxLoanMaturity.test.ts`, `release.test.ts` | — / OFF | pass |
| A 1.5M/14%, B 1.4M/15.5%, hurdle 15% | only B | `tests/optimizer/jointSearch.test.ts` J1 | — | pass |
| Band 30.2–30.8%, 2-point grid | unresolved, never "no deal"; bad steps rejected | `jointSearch.test.ts` J2/J3 | — | pass |
| Two pool shares 0.7875 | 1 unit + 0.575 residual; ₪2.45M net | `tests/optimizer/collective.test.ts` G1 | — / SIM | pass |
| Eight 1,000 m² in lot 149 | rejected (> ≈ 7,097 m²) | `collective.test.ts` G2, `tests/domain/validation.test.ts` | OFF | pass |
| Two smaller apartments | exactly 2 physical units, actual areas and values | `tests/domain/developerBudget.test.ts`, `consideration.test.ts`, `release.test.ts` | OFF | pass |
| Option exercised at month 24, ₪100K | PV ≈ ₪94,260; no retroactive payment | `tests/optimizer/contingent.test.ts` C2 | — | pass |
| Regret A (100,100,−100), B (95,95,0) | 100 / 5 | `contingent.test.ts` C4 | — | pass |
| Unknown price, inventory, bank approval | conditional / unresolved | `release.test.ts` (unknown price never ranks), contract status tests | OFF | pass |
| Change terms during analysis, then print | old snapshot invalidated or labelled | `tests/e2e/privacy.mjs` (stale joint result hidden) | OFF | partial (print path — MH-08) |

## 4. Versioning

`CONFIG_VERSION` versions the data; the contract schema and kernel versions are introduced with ContractSnapshot v1.
A change to any fixture's expected number requires an independent recalculation recorded in VALIDATION-REPORT.
