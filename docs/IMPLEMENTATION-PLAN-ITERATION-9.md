# Iteration 9 — implementation plan (reviews of 0bf74d7)

Inputs: *Iteration 8 independent review* and *Comprehensive architecture, business logic and innovation review
(BLRO)*, both of revision `0bf74d7`, config `2026-11-27.8`. Each finding was checked against the code before planning;
the check result is in the "Verified" column. Nothing here changes a tax rule, a market value or a user assumption
without a source or an owner decision.

Kept as is (owner decisions / user assumptions): 2.25 simulation rights per 167 m²; owners' services price ₪11,000/m²;
combination slider and 15–20% markup; ordinary 50% levy rate; four personal questions; evidence-first unknowns; all
computation in the browser; summary with one card per deal family (#57–#59); the three goals in the wizard (#53 — an
owner decision; the engine keeps all five and the migration is shown, see P1-7).

## 1. Findings, verified

| ID | Finding | Where | Verified |
|---|---|---|---|
| F01 | Owner and developer value the same consideration differently (owner: 2.25 × 35% × ₪2.5M = ₪1.969M; developer: 11,209 m² × 2.353% × 35% × ₪25,000 = ₪2.308M; ~₪339K apart) | `lotDeveloper.ts` `routeDelta` (`areaPerRight = lotShare × residentialArea / R` ≈ 117 m² per right) vs owner's 100 m² standard | **Yes** |
| F02 | Quota units differ: policy counts whole slots (S11's 0.327 apartment takes 1 slot), lot model subtracts the fractional `apartmentsBuilt` and uses a fractional quota (25% × 102 = 25.5) | `policy.ts` `serviceApartments`; `analyze.ts` passes `userServicesUnits: plan.apartmentsBuilt`; `lotDeveloperPnL` `quota = share × units` | **Yes** |
| F03 | Tax loan is folded into mortgage debt at delivery before any check; the "extension needed" test fires whenever the pool sale is later, even if cash covers the maturity | `cashflow.ts` (delivery block), `feasibility.ts` (`TAX_LOAN_EXTENSION_NEEDED`) | **Yes** |
| F04 | Cash-flow uses raw amounts: indexed construction is nominal, everything else is in today's prices, loans charge nominal interest; only the NPV deflates | `cashflow.ts`, `evaluate.ts` `NOMINAL` set | **Yes** |
| F05 | Levy on complementary rights bought at signing is always put on the seller | `transactions.ts` `buy_rights` | **Yes** |
| F06 | Zero basis / 25% is labelled as a conservative bound; it is a scenario, not an upper bound | `taxation.ts`, config, UI ranges | Yes (labels) |
| F07 | The unverified ₪6,900 developer price sets the liquidity scale of every goal score | `analyze.ts` `buildScales.landValue` | **Yes** |
| F08 | Legacy calculator still shows obsolete finance (gain tax on gross transfer, etc.) as an equal tab | `simulationMath.js`, `LegacySimulator.jsx` | Yes |
| R-BOI | "Any purpose" loan limit: min(70%, 50% + ₪200K) of value, after existing secured debt (BOI circular 2840) | `config.ts` `ltvLimits.additionalHome = 0.5` | Model uses 50% only — needs source check |
| F09–F13 | Joint optimisation, Pareto mix search, developer budget completeness, cancellation state ledger, evidence typing | various | Yes (scope) |
| F14 | Input validation at the domain boundary (area above the lot, zero fraction, invalid saved lot) | `useDecisionEngine.ts`, `rights.ts`, `storage.ts` | Yes |
| F15 | Whole analysis runs synchronously in `useMemo`; CI needed a 30 s timeout | `useDecisionEngine.ts` | Needs measurement |
| F16 | Browser privacy test is not in CI; action versions not pinned to SHAs | `.github/workflows/deploy-pages.yml` | **Yes** |
| F17 | Stale UI text: "banks don't finance taxes" (a secured / tax loan now can); "₪11,000 direct cost" in the developer panel | `fields.tsx:168`, `DetailSections.tsx:312, 637` | **Yes** |

## 2. Phases (one PR each; merge only on the owner's go-ahead)

### Phase A — Baseline and safety net (small, first)
1. **Golden fixtures computed outside the engine** (plain arithmetic in the test, not engine calls): 167 m² / 2.25 / 35%
   mixed (consideration, levy, tax reserve, completion ₪531,250, S11 split x = 0.326923 and ₪498,607 build cost);
   lot 149 direct budget ₪114,432,600 and +10% = ₪11,443,260; zero-rate loan draw/repay; nominal ↔ real conversion
   (₪1M real at year 5 = ₪1,104,081 nominal at 2%). Written **before** any formula change; where current output
   differs, the test is marked as the expected new behaviour with a reason — never adjusted to pass.
2. **Before/after scenario matrix** snapshot (`tests/report/matrix`) saved so every later phase reports what changed.
3. **CI**: run the browser privacy test on the production build in the workflow; run checks on pull requests, not only
   on `main`; pin actions to commit SHAs.
4. **Stale UI text** (F17) and tax-scenario labels (F06): wording only, no number changes.

### Phase B — P0 financial correctness
1. **One transfer ledger (F01).** Add `src/domain/ledger/`: every event has month, from/to party, asset, quantity,
   amount, price basis (real-today / fixed-nominal / indexed), legal payer, contractual payer, evidence id. The owner
   plan and the developer route delta become two views of the same events, with conservation tests (rights, apartments,
   area, cash both sides). **Needs an owner decision on the common unit** — see §3, Q1.
2. **Quota in whole slots (F02).** Lot quota = ⌊share × units⌋ (25 for lot 149); a user on services takes
   `serviceApartments()` slots; when the quota is full, an explicit displaced typical participant moves to combination
   (their receipts and taxes restored). The partial-apartment build cost stays fractional. Tests: 25 slots, S11 takes
   one, full quota displaces exactly one, no negative inventory.
3. **Tax-loan maturity (F03).** At maturity: repay from unrestricted cash first; the remaining shortfall is covered only
   by an explicit, conditional refinance facility (limit, collateral, combined with other secured debt); otherwise it
   is an unfunded maturity gap. "Extension needed" only when a gap remains. Tests: cash-covered maturity with a later
   pool sale passes; no apartment to refinance on fails; same-month events; zero-rate subsidy; maturity after horizon.
4. **One money basis (F04).** Every ledger event carries its price basis; the simulator converts all of them to one
   nominal timeline (affordability, debt service), and the equity NPV deflates that same timeline once. No double
   indexing. Imputed housing benefit stays outside cash.
5. **Levy on bought rights (F05).** Acquisition date relative to approval decides who is liable by default (before
   approval → buyer bears the levy on the bought rights, e.g. 0.75 right ≈ ₪85.6K at the lot 149 proxy); shown as a
   scenario with the alternative, never double-deducted.
6. **Evidence-neutral ranking (F07).** Scales from the appraisal entitlement value only; no hypothetical price can move
   a score. A confirmed offer (optional advanced input, typed `confirmedOffer`) is the only thing that unlocks a
   price-dependent route as evidence-based.
7. **Any-purpose loan limit (R-BOI).** Verify circular 2840 / directive 329 first. If confirmed: keep 50% as the base and
   show min(70%, 50% + ₪200K) minus existing secured debt as a conditional upper bound (optional input: existing
   secured debt). Mixed-purpose loans assessed jointly.
8. **Legacy calculator (F08).** Rename and label "מחשבון ישן — להשוואה בלבד, חישובי מס ומימון לא מעודכנים"; keep the
   allocation-table computation as a pure TS function; plan to replace the tab with ledger views in Phase D.

### Phase C — P1 developer budget and evidence
1. Area definitions from plan Table 5 (main / service / saleable / balconies / parking / public); confirm 11,209 m² is
   the same basis as the ₪25,000/m² comparables; check the 325 public m² is not inside the above-ground quantity.
2. VAT basis consistent (public shell cost is VAT-inclusive; developer accounts ex-VAT).
3. Split the 12% soft costs (design, supervision, marketing, guarantees, insurance, fees); development levies and
   infrastructure as **unknown** lines with a range, not zero.
4. Developer metrics: profit on cost, peak equity, peak borrowing, equity IRR; stresses: cost ±10%, sale price by
   apartment type, approval delay, rate — jointly, not one at a time.
5. Evidence registry: typed levels (observed / appraisal / contract / scenario / unknown) with date, units and scope;
   category-specific prices and rents where sourced.

### Phase D — P1 optimiser, UX, performance
1. Apartment-mix search kept by a goal-aware Pareto filter (cash gap, debt, value, count, rent), not "closest six".
2. Rental variants: vacancy, rental tax, delayed start, the share of rent a lender recognises; keep S08/S14 when the
   goal values rent.
3. Cancellation as a state ledger (no approval / delay / developer failure): refunds, guarantees, debt left, retained
   land and bought rights kept as assets of unknown value.
4. Domain validation (F14): area above the lot, zero fraction, invalid saved lot, exact fraction restore, null ≠ 0.
5. Performance (F15): measure on a mid-range phone profile first; if needed, split first verdict from advanced
   sensitivity, cache lot context, debounce, then a Web Worker.
6. Replace the legacy tab with views of the new ledger.
7. Saved goals: when an old saved goal is migrated, say so once ("ההעדפה הקודמת שלכם הועברה ל…").

### Phase E — P1 bilateral contract search (BLRO) — after B is merged
`src/optimizer/joint/` reusing the candidate and ledger modules: contract vector (combination %, services split, tax
terms and caps, completion price, payment dates, loan provider); owner reservation (best individual route or "unknown")
and developer hurdle (margin, equity IRR, facility limit). Output: feasible contracts, or a **negotiation-gap
certificate** — the smallest changes on each axis that would close it, and who must move. Thresholds as interval sets
(non-monotonic scans), never "equal developer profit" presented as viable. One new card in the advanced view only.

### Phase F — P2, planned separately (not in this iteration)
Collective allocation across owners (opt-in anonymous distribution, mixed-integer / bounded search, no owner worse than
their own baseline) and stage-contingent contracts (state tree without invented probabilities).

## 3. Decisions needed from the owner before Phase B

- **Q1 — the common unit for F01.** The simulation says 2.25 rights per 167 m² (your assumption); the lot table gives
  this share ≈ 2.4 units and ≈ 117 m² of saleable area per simulation right; the owner side values a right at a 100 m²
  standard apartment. Options:
  (a) keep 2.25 and 100 m² for the owner; the developer gives up exactly what the owner receives, and the difference
      to the official share is shown as an explicit "unallocated entitlement" line (no value invented);
  (b) owner entitlement from the official share (≈ 2.4 units, ≈ 110 m² average) — changes every owner number;
  (c) keep 2.25 rights but price them at the lot's average saleable area (110 m² × ₪/m²).
  Recommended: **(a)** — it keeps your assumption and makes the gap visible instead of hiding it in either side.
- **Q2 — delivery cadence**: one PR per phase, merged after your review (recommended), or A+B together.
- **Q3 — any-purpose loan upper bound**: show it (conditional, after verification and an optional "existing secured
  debt" answer) or keep only the 50% base.

## 4. Release gates (unchanged by passing tests)
Typecheck, lint, all unit/property tests, production build and the browser privacy test in CI; independent
reconciliation report with before/after table; professional review by an appraiser, a tax adviser and a lawyer before
any claim of accuracy. Actual offers, tender costs, final permit areas and inventory, assessed levy and individual tax
remain unknown and stay labelled so.
