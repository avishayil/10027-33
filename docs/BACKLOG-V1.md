# V1.0 backlog (finite)

The governing backlog MH-01…MH-15, re-validated against `main` at `14f4f48`; updated after Milestone B. "Resolved" only with the proving test.
Each open item names the milestone step that closes it (plan: milestones A–E). Supersedes `IMPLEMENTATION-PLAN.md`
and `IMPLEMENTATION-PLAN-ITERATION-9.md` (kept as history).

| ID | Pri. | Requirement (short) | Status | Evidence today | Remaining → step |
|---|---|---|---|---|---|
| MH-01 | P0 | One immutable contract snapshot and bilateral events; 2.25 simulation vs official share vs inventory; residual explicitly accounted | resolved (engine); UI part open | snapshot v1 (`optimizer/contract.ts`: schema/kernel/pack versions, scenario, participants, events, facilities, inventory claims, evidence ids, full input hash) — `tests/kernel/events.test.ts`; consideration claims incl. `unallocated` (`consideration.test.ts`) | show 2.25 beside the official share → **C2** |
| MH-02 | P0 | Joint search uses each candidate's route delta, slots and funding; a lower-owner-value route can be jointly viable | resolved | pairs per (contract, route), funding variants, route margin = `developerLot.margin` (J1, J5) | — |
| MH-03 | P0 | No pool cash without a sold asset or funded buy-out; maturity and taxes on the actual settlement; else residual or conditional | resolved | `poolAllocation`, `balancing_pool.soldFraction`, G1 (`collective.test.ts`); single-owner S02P carries `FRACTION_SETTLEMENT` (pool needs other owners) | — |
| MH-04 | P0 | Tax-loan maturity: cash → capped conditional refinance → overdue gap; project-draw reporting; delivery debt and interest cut-off | resolved | `taxLoanMaturity.test.ts`; F1/F2; F-h with cash repayment and zero refinance (`tests/validation/sharedFixtures.test.ts`) | — |
| MH-05 | P0 | One nominal basis; collateral and refinance on the same date; delivery metrics normalised; equity NPV reconciles facilities and terminal balances | resolved | `moneyBasis.test.ts`; per-facility accounts reconcile to terminal balances for every snapshot (`tests/kernel/events.test.ts`); F-i engine-derived ceiling (`sharedFixtures.test.ts`) | — |
| MH-06 | P0 | Group preview validates lot, aggregate rights, inventory, integer slots, contract conditions; no fairness/feasibility claim without reconciliation; labelled prototype | engine resolved; label open | G1–G6 (`collective.test.ts`) | "illustrative — limited" label and limits text → **C5** |
| MH-07 | P0 | Contingent preview keeps contract history and permitted transitions; no free fallback, no retroactive exercise; unknown exercise terms → questions | engine resolved; UI open | C1–C4 (`contingent.test.ts`) | card → protections and negotiation questions; rank only with entered option terms → **C5** |
| MH-08 | P0 | Invalidate stale results on every change incl. deferred render and async callbacks; validate inputs, money, rates, lot, goals, step, bounds | resolved (engine); e2e open | `AnalysisSnapshot` (id, inputs, config, time) used by the print header and advanced cards (`tests/hooks/snapshot.test.ts`); fingerprints in JointSearch/GroupPlanner; "forget" clears every app key; `validation.test.ts` | stale-then-print browser test → **E** |
| MH-09 | P0 | Evidence-aware eligibility; verified offers usable in scope; no price assumption in rankings; bought-rights levy kept; explicit tax scenarios | resolved | canonical statuses and the Project Pack (`tests/pack/pack.test.ts`); confirmed terms only within lot and validity date; doubled scenario price leaves the ranking unchanged; F-e (`sharedFixtures.test.ts`) | offer panel feeds scoped evidence → **C1** |
| MH-10 | P0 | Actual-offer comparison with all material missing terms and a common comparison date; print only the current snapshot | open | levy cap and interest checkbox only (wizard) | offer panel, offer snapshot, diff vs base, questions → **C1**; report → **C6** |
| MH-11 | P1 | Bounded adaptive search, no conclusive no-deal claim; all five goals and outside alternatives; both parties recomputed per lever | resolved (engine); goals in UI open | J2–J5; goal acceptance in `contract.ts` `goalReason`; `OUTSIDE_OPTION_UNKNOWN` | five goals in the advanced view, no migration → **C3** |
| MH-12 | P1 | Markup in equivalence; conditional tax funding only; cost overrides stressed; financing-inclusive headroom if claimed; disconnected sets in the reverse solver | resolved | D5, F6, F7 (`accounting10.test.ts`); exact ₪498,607 before indexation (`sharedFixtures.test.ts`) | — |
| MH-13 | P1 | Useful apartment / rental alternatives kept; no type inventory assumed; cancellation separates reserves, refunds, assets and real expenses | resolved (engine) | no-approval split into refundable advances, taxes, non-refundable costs, assets kept, reserve, real expenses (`cancellation.test.ts`); inventory routes conditional (J4) | — |
| MH-14 | Release | Professional tax, legal and appraisal review of fixtures and data; a current offer or approved benchmark for commercial reliance | open (external) | — | refreshed sources and review packets → **D** |
| MH-15 | Release | Privacy, security, accessibility, performance, CI and documentation gates | partial | pinned actions, least privilege, deployed-path e2e, public PDF guard, benchmarks (iteration 10) | keyboard/RTL/print/reset/axe e2e, mobile-slowdown budgets, release notes, v1.0.0 → **E** |

## Owner decisions for V1.0 (2026-11-28)
1. Entitlement stays on the official share (deviation D-1, PRODUCT-SPEC §5); 2.25 shown beside it; fixtures on `C_SIM`.
2. Group planner labelled illustrative; option card becomes protections + questions (MH-06, MH-07).
3. Wizard three goals, advanced view five; no migration (deviation D-2).
4. Each milestone fast-forwarded to `main` after all checks.
