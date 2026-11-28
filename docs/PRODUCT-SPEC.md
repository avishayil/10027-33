# מימוש חכם — product specification (V1.0)

Governing source: *מימוש חכם — Product specification and V1.0 release plan* (received 2026-11-28), adapted to this
repository. Baseline: `main` at `14f4f48` (iteration 10, config `2026-11-28.14`). Companion documents:
[ECONOMIC-CONTRACT](ECONOMIC-CONTRACT.md) (shared semantics), [RELEASE-CRITERIA](RELEASE-CRITERIA.md) (definition of
done), [BACKLOG-V1](BACKLOG-V1.md) (the finite backlog and its status).

## 1. Purpose

A consumer-facing, project-specific decision and negotiation aid for private landowners of original parcel 10027/33
(Hadera compound 13, plan 302-1306018). A user should understand what their land could become, what they can afford,
which terms to negotiate, what a real offer means and which uncertainties prevent a firm conclusion. Recommendations are
reproducible, financially reconciled and conditional where they must be. A useful answer does not require a developer
offer or a market valuation — and none is ever manufactured.

The open-ended review-and-feature cycle ends here: V1.0 is reached by closing the finite backlog, not by adding features.
LandLens (separate project) will host the professional interface; the two share economic semantics, not code (yet).

## 2. Boundaries

| Capability | V1.0 treatment |
|---|---|
| Personal questionnaire | Core: four initial questions, no new mandatory ones |
| Pure and hybrid transactions (S01–S14) | Generated, explained and compared automatically |
| Taxes, levy, construction, financing | Reconciled cash flows; explicit liability estimates, payer and date |
| Actual developer offer | First-class, optional advanced panel (all fields optional, missing = unknown) |
| Developer economics | Supporting plausibility and negotiation check, never an approval |
| Bilateral search | Conditional recommendations and thresholds on one contract snapshot |
| Apartment mixes | Conditional until inventory is confirmed |
| Group planner (pools, services quota) | Advanced view, labelled **illustrative — limited**; full collective allocation belongs to LandLens |
| Contracts with an option | **Protections and negotiation questions**; an option is ranked only when its terms are entered in the offer panel |
| Professional budget, GIS, multi-project, full contract design | Out of scope (LandLens) |
| Document upload, AI extraction, remote inference, server, accounts, analytics, data sharing | Out of scope |

## 3. Consumer journey

1. **Holding** — original area or fraction, optional lot. The entitlement on the official allocation share is shown
   with the 2.25-per-167 m² simulation convention beside it and the difference explained. Precise family ownership is
   never inferred from an area.
2. **Household** — capital after an emergency reserve, monthly repayment capacity (0 ≠ unknown), goal. The wizard offers
   three goals; the advanced view offers all five (balanced, whole apartment, passive income, cash soon, no risk). A
   saved goal is never replaced by another.
3. **Recommend** — one direction and up to two materially different alternatives, after affordability and contractual
   checks. If none fits: the binding constraints and the conditional remedies, not a forced winner. A cash-oriented
   owner gets a sale-price threshold even when the current sale value is unknown.
4. **Explain** — every amount, when it is due, who bears each tax, funding gaps, peak debt, monthly payments, delivery
   consideration, liquidity and risk; value at signing, position at delivery and the optional long-term projection kept
   apart.
5. **Negotiate** — terms to request (minimum consideration, maximum affordable completion price, tax contributions,
   interest subsidy, timing, conditional financing), each with what makes it plausible to the developer. A modelled
   hurdle is never called an offer.
6. **Check a real offer** — optional advanced panel (see BACKLOG-V1 MH-10), compared with the owner's alternatives on
   the same valuation basis and date, as changes against the base scenario; printable, with questions for the developer
   and advisers.
7. **Print** — a concise Hebrew RTL report of the current calculation snapshot only (id, date, data version), with
   assumptions and source dates, dependencies, taxes, the comparison and negotiation questions. Saving answers warns
   about shared devices and can be cleared completely.

## 4. Approved assumptions (unchanged unless a new decision says so)

| Item | Treatment |
|---|---|
| Parcel | 10027/33, 21,258 m²; updated 106(ב) tables of 23 Nov 2026; lots 149 / 150 / 153 (102 / 96 / 100 units) |
| Entitlement | **Official allocation share** (residential area share ÷ 100 m²; 167 m² ≈ 2.64 in lot 149) — see deviation D-1 |
| Simulation convention | 167 m² = 2.25 standard-apartment rights; shown alongside; basis of the shared fixtures (`C_SIM`) |
| Standard unit | 100 m² scenario, not inventory |
| Owners' construction price | ₪11,000/m² before markup and VAT, independent of the developer's internal cost |
| Combination slider / markup | 25–45% (step 0.5 point) / 15–20%, base 17.5% |
| Betterment levy | ordinary 50% of the enhancement; the allocation-table difference is a proxy only |
| VAT / capital gains | 18% (to verify with an adviser) / a scenario reserve, not an upper bound |
| Apartment value / rent | ₪25,000/m², ₪5,500/month — reference scenarios, not sales or leases |
| Real discount / inflation | 3% / 2%; no apartment appreciation |
| Developer hurdle | 15% of revenue — an illustrative target, not a rule |
| Services quota | 25% (20–30%), whole slots; exclusion rules hypothetical unless agreed |
| LTV | 75% sole / 70% replacement / 50% additional or unanswered — not a loan approval |
| Tax loan | never assumed; prime + 2% + VAT on interest as the example; 50% cap an assumption |
| Any-purpose refinance | 50% baseline |
| Unknown prices | immediate sale, developer buy-out, post-approval price stay unknown unless independently supported |

## 5. Deviations from the governing specification (owner-approved)

| ID | Spec says | V1.0 does | Decision | Consequence |
|---|---|---|---|---|
| D-1 | Keep 167 m² = 2.25 as the entitlement; do not replace it with the official allocation | Official share is the default; 2.25 shown beside it | Owner, iteration 10 and again 2026-11-28 | Shared fixtures run on `rights.entitlementBasis: 'simulation'` (`C_SIM`); LandLens must use the same switch to reproduce them. Two household recommendations changed in iteration 10 (VALIDATION-REPORT). |
| D-2 | Preserve all five goals | Wizard: three; advanced view: all five; no migration of saved goals | Owner, 2026-11-28 (amends DECISIONS #53) | The engine, tests and the advanced view cover five goals; the wizard stays short. |

## 6. Delivery

Milestones A–E (RELEASE-CRITERIA), each committed in reviewable increments and fast-forwarded to `main` after every
check passes, with a report per milestone in VALIDATION-REPORT: acceptance criteria, summary, test results, limits,
before/after recommendations and evidence changes. Professional sign-off (appraiser, tax adviser, real-estate lawyer)
is external and blocks any claim of validated reliance.
