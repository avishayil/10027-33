# V1.0 release criteria

Milestones and the definition of done from the governing specification, with the current status. A box is ticked only
with evidence (a test, a measurement or a signed record). Status as of the baseline `14f4f48`.

## Milestones

| Milestone | Scope | Exit gate | Status |
|---|---|---|---|
| A — Baseline and scope freeze | Pin main; inventory findings; requirements; approved assumptions | Every backlog item mapped to code/test/evidence; no new mandatory questions | done |
| B — Economic correctness | MH-01…09 with independent fixtures | All P0 accounting, feasibility and snapshot tests pass; unsupported advanced claims disabled or conditional | done (VALIDATION-REPORT) |
| C — Consumer experience | MH-10…13: simplified verdict, actual-offer comparison, print | Each of the five goals gives meaningful guidance or an explicit no-fit reason for representative profiles | done (`guidance.test.ts`) |
| D — Evidence and professional review | Area definitions, offers when available, tax and legal treatment | Signed validation record with unresolved data disclosed; no unqualified commercial recommendation | open (sign-off is external) |
| E — Release hardening | Browser, performance, privacy, accessibility, docs | CI and production acceptance pass; V1.0 report and open limitations published | open |

## Definition of done (V1.0)

- [ ] Financial conservation and all applicable shared fixtures pass; independent reference calculations agree within
      documented precision. *(Most pass — ECONOMIC-CONTRACT §3; four partial.)*
- [ ] No unsupported cash, inventory, tax financing or refinancing; every modelled gap and conditional dependency visible.
- [x] Consumer outputs explain entitlement, recommendation, capital/taxes/financing, delivery consideration, negotiation
      and risk. *(Milestone C: summary, guidance, terms to request, protections, print report.)*
- [ ] Actual-offer comparison keeps the entered terms, date and missing facts; print is tied to the exact snapshot.
- [x] All five goals, zero/unknown values, three lots and slider extremes tested; the cash goal never silently changed.
      *(`guidance.test.ts`, matrix, `storage.test.ts`.)*
- [ ] Evidence registry traces every material assumption; no hypothetical price treated as an observed deal; allocation
      levy proxy vs legal levy clearly distinguished.
- [ ] Appraiser, tax adviser and real-estate lawyer have reviewed representative fixtures. Until then, no claim of
      validated production reliance (blocking). Lender terms require actual approval.
- [ ] Unit/property tests, typecheck, lint, locked production build, browser privacy tests and deployment-base
      interaction tests pass, including advanced view, actual offer, print/reset, stale result, keyboard/RTL/mobile and
      storage tests.
- [ ] No personal data transmitted, no telemetry, no silent group persistence; public PDFs and the pack reviewed for
      identifiers; restrictive CSP, pinned reviewed CI actions, dependency lock, least-privilege deploy *(CI parts done
      in iteration 10)*; limits of localStorage and CSP documented.
- [ ] Typical and worst supported holdings, the advanced solvers and the UI benchmarked on a mobile CPU slowdown;
      budgets set from the baseline and reported.
- [ ] README, architecture, financial methodology, evidence standard, validation report and release notes updated;
      before/after recommendation changes explained.

## Performance budgets (proposed — to confirm after the Milestone E baseline at 4× CPU slowdown)

| Measure | Budget | Last measurement |
|---|---|---|
| Input paint after a slider step | < 100 ms | ≈ 40 ms (iteration 9, 4× slowdown) |
| Main recalculation, reference profile (167 m², ₪300K, ₪5K) | < 1 s | ≈ 300 ms (iteration 9, 4× slowdown) |
| Joint search, reference profile | < 3 s | 0.4–0.5 s laptop (iteration 10); phone not yet measured |
| Group planner, 8 members | < 1 s | ≤ 90 ms laptop |
| Offer check | < 1 s | — (Milestone C) |

## Validation matrix (required rows)

167 m² with zero capital / no borrowing, ₪300K + ₪5K/month, ₪800K; 83.5 m²; 1.5, 3 and 4 rights; unknown inputs; every
goal type; three lots; slider extremes (25% / 45%, markup 15% / 20%). Outcomes may change when a defect is corrected —
each change documented with its independent calculation.
