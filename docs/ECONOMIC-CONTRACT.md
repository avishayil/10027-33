# Economic contract — shared BLRO semantics in this repository

The governing specification defines a logical contract shared with LandLens (same inputs + evidence version + kernel
version + contract snapshot ⇒ the same financial results). This document maps it onto this codebase, states the
invariants and where they are tested, and lists the cross-product fixtures. It is a logical contract: no shared package,
service or runtime dependency. Status: **v1** (Milestone B): `ContractSnapshot` schema `blro-contract/1`, kernel `mimush-kernel/2026-11-28.1`, Project Pack schema `blro-pack/1` (`src/pack`).

## 1. Canonical entities ↔ code

| Entity | Here today | Gap to v1 (Milestone B) |
|---|---|---|
| `ProjectPack` | `src/pack/index.ts` `HADERA_PACK`: schema, id `hadera-c13-10027-33`, version = data version, effective date, plan and allocation versions, parcel, lots, rights model (official share + 2.25 convention), inventory explicitly unknown, evidence, model (`PROJECT_CONFIG`); `loadPack` refuses unsupported schemas and invalid data | export/import UI (out of V1 scope) |
| `EvidenceRef` | Pack evidence (stable ids `<group>.<field>`, `price.<knob>`, `land_tx.<n>`, `allocation_tables_106b`), canonical statuses `verified_fact` / `reported` / `appraisal_reference` / `confirmed_offer` / `assumption` / `scenario` / `unknown`, locators, observed and retrieved dates, scope (lots, validity window) | reviewer sign-off (Milestone D) |
| `RightsHolding` | `UserProfile` (area, lot) → `calculateRights` (`domain/rights.ts`): official share and, separately, the 2.25 simulation conversion (`rights.entitlementBasis`) | Expose both figures and the residual in one object |
| `InventoryClaim` | `ConsiderationReconciliation.claims` (`domain/lotDeveloper.ts` `considerationReconciliation`): recipient owner / pool / unallocated, quantity, area, value, price basis, source | Lot and unit type ids; reservation date |
| `ParticipantProfile` | `UserProfile` (anonymous, local); `GroupMember` | Explicit party ids and roles in the snapshot |
| `ContractSnapshot` | `optimizer/contract.ts`: schema/kernel/pack versions, scenario id, id, input hash (profile + whole config + terms), participants, terms, route legs, events, facilities, inventory claims, evidence ids, owner and developer projections from one evaluation, conditions, status | — |
| `BilateralEvent` | `kernel/events.ts`: every non-zero ledger amount source → destination (owner, developer, bank, other-property lender, tax authority, municipality, buyer, seller, service providers), liable vs contractual payer, month, price basis, conditions; facility draws, interest, repayments and refinance transfers | evidence ids per event (snapshot-level today) |
| `FinancingFacility` | `kernel/events.ts` `facilitiesOf` from `SimulationResult.facilityAccounts`: lender, approval (always conditional), drawn, interest (capitalised or paid), repayments, transfers, terminal balance, rate, maturity, collateral, repayment source | fees (none modelled) |
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
| Every cash event has a source and a recipient; facilities reconcile; loan proceeds are not profit; refinance is not consideration | `kernel/events.ts`; `tests/kernel/events.test.ts` (parties, ledger completeness, per-facility reconciliation, refinance as a transfer); F1/F2 | holds |
| Liability, contractual payer and funding separated; tax timing by the relevant event | `domain/arrangements.ts` per-tax terms; `BilateralEvent.liable` vs `payer` (levy and capital gains always the owner's liability); `tests/domain/contractTerms.test.ts`, `tests/kernel/events.test.ts` | holds (VAT liability modelled as the payer — to confirm with a tax adviser) |
| Events only when prerequisites hold; approval precedes permit; no receipt before settlement; a contingent branch cannot alter the common history | `tests/domain/timeline.test.ts`; receipts after settlement (`tests/kernel/events.test.ts`); `shiftBeforeExercise` + C2 | holds |
| Owner and developer on the same snapshot, scenario and dates; the project baseline excludes the owner's tax profile | `optimizer/contract.ts`; `tests/optimizer/jointSearch.test.ts` J1; `typical()` in `lotDeveloper.ts` uses a zero-basis typical holding | holds |
| Transaction NPV, equity NPV, delivery balance sheet and projection distinct; common date and basis; no double counting | `evaluate.ts` (`transactionValue`, `comparisonValue`, `delivery`, projection); `tests/optimizer/equityValue.test.ts`, `accounting10.test.ts` D4 | holds |
| Hard failure, missing information, modelled conditional and confirmed terms kept apart; software never approves | `Affordability` (`unknown` ≠ `does_not_fit`); `ContractStatus` (never `terms_confirmed` while outside options are unknown); typed evidence (D7) | holds |

## 3. Cross-product fixtures

Independent expected numbers; tolerance stated in each test. "Basis": `SIM` = `C_SIM` (2.25 per 167 m²), `OFF` = the
official default, `—` = a pure function with explicit inputs.

| Fixture | Expected | Test | Basis | Status |
|---|---|---|---|---|
| 167 m² / 2.25 / 35% | 0.7875 equivalents = ₪1,968,750 | `tests/validation/golden.test.ts`, `tests/domain/consideration.test.ts` | SIM | pass |
| Hybrid one unit | x = 0.326923, 1.923077 in combination; services ≈ ₪498,607 | `golden.test.ts`, `tests/validation/sharedFixtures.test.ts` (exact before indexation) | SIM | pass |
| Official vs simulated | ₪2,307,793 vs ₪1,968,750, ₪339,043 unallocated (material) | `consideration.test.ts` | SIM / OFF | pass |
| Levy proxy | incoming ≈ ₪200,492, outgoing ≈ ₪714,371, 50% ≈ ₪256,939 | `tests/optimizer/iteration4.test.ts`, `tests/domain/financial.test.ts` | SIM | pass |
| Bought 0.75 right before approval | buyer levy ≈ ₪85,646, once, dated before approval | `tests/domain/boughtRightsLevy.test.ts`, `sharedFixtures.test.ts` | SIM | pass |
| 102 units, 25% quota | 25 slots; partial claim takes a whole slot; displaced participant | `tests/domain/quota.test.ts` | OFF | pass |
| ₪1M received before ₪1M spent | no financing | `tests/validation/release.test.ts` | — | pass |
| Project ₪300K, tax maturity ₪200K in cash | project draws ₪300K; repaid from cash; nothing refinanced | `accounting10.test.ts` F1, `sharedFixtures.test.ts` | — | pass |
| ₪2.5M real collateral, 2%, year 5, 50% | nominal ceiling ≈ ₪1,380,101; engine derives 50% × collateral × index | `accounting10.test.ts` F3, `sharedFixtures.test.ts` | — / OFF | pass |
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
| Change terms during analysis, then print | old snapshot invalidated or labelled | `tests/hooks/snapshot.test.ts` (snapshot id per input key; print header reads the snapshot); `tests/e2e/privacy.mjs` (stale joint result hidden) | OFF | partial (browser print test — Milestone E) |

## 4. Versioning

`CONFIG_VERSION` versions the data; the contract schema and kernel versions are introduced with ContractSnapshot v1.
A change to any fixture's expected number requires an independent recalculation recorded in VALIDATION-REPORT.
