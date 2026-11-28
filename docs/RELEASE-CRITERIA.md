# V1.0 release criteria

Milestones and the definition of done from the governing specification, with the current status. A box is ticked only
with evidence (a test, a measurement or a signed record). Status as of the baseline `14f4f48`.

## Milestones

| Milestone | Scope | Exit gate | Status |
|---|---|---|---|
| A — Baseline and scope freeze | Pin main; inventory findings; requirements; approved assumptions | Every backlog item mapped to code/test/evidence; no new mandatory questions | done |
| B — Economic correctness | MH-01…09 with independent fixtures | All P0 accounting, feasibility and snapshot tests pass; unsupported advanced claims disabled or conditional | done (VALIDATION-REPORT) |
| C — Consumer experience | MH-10…13: simplified verdict, actual-offer comparison, print | Each of the five goals gives meaningful guidance or an explicit no-fit reason for representative profiles | done (`guidance.test.ts`) |
| D — Evidence and professional review | Area definitions, offers when available, tax and legal treatment | Signed validation record with unresolved data disclosed; no unqualified commercial recommendation | packets and source refresh done (`docs/review/`); **sign-off open — external, blocking** |
| E — Release hardening | Browser, performance, privacy, accessibility, docs | CI and production acceptance pass; V1.0 report and open limitations published | done — release candidate 1.0.0-rc.1 (`docs/RELEASE-NOTES.md`) |

## Definition of done (V1.0)

- [x] Financial conservation and all applicable shared fixtures pass; independent reference calculations agree within
      documented precision. *(ECONOMIC-CONTRACT §3: 19 pass; stale-then-print now covered in the browser.)*
- [x] No unsupported cash, inventory, tax financing or refinancing; every modelled gap and conditional dependency visible.
      *(pool conservation, conditional funding, facility reconciliation, inventory conditional.)*
- [x] Consumer outputs explain entitlement, recommendation, capital/taxes/financing, delivery consideration, negotiation
      and risk. *(Milestone C: summary, guidance, terms to request, protections, print report.)*
- [x] Actual-offer comparison keeps the entered terms, date and missing facts; print is tied to the exact snapshot.
      *(`offer.test.ts`, `snapshot.test.ts`, `release.mjs`.)*
- [x] All five goals, zero/unknown values, three lots and slider extremes tested; the cash goal never silently changed.
      *(`guidance.test.ts`, matrix, `storage.test.ts`.)*
- [x] Evidence registry traces every material assumption; no hypothetical price treated as an observed deal; allocation
      levy proxy vs legal levy clearly distinguished. *(Project Pack, `pack.test.ts`.)*
- [ ] Appraiser, tax adviser and real-estate lawyer have reviewed representative fixtures. Until then, no claim of
      validated production reliance (blocking). Lender terms require actual approval. *(Packets ready in
      `docs/review/`; sign-off open — the only open item; it keeps the version at 1.0.0-rc.1.)*
- [x] Unit/property tests, typecheck, lint, locked production build, browser privacy tests and deployment-base
      interaction tests pass, including advanced view, actual offer, print/reset, stale result, keyboard/RTL/mobile and
      storage tests. *(`tests/e2e/privacy.mjs`, `tests/e2e/release.mjs`.)*
- [x] No personal data transmitted, no telemetry, no silent group persistence; public PDFs and the pack reviewed for
      identifiers; restrictive CSP, pinned reviewed CI actions, dependency lock, least-privilege deploy; limits of
      localStorage and CSP documented (ARCHITECTURE "Privacy limits").
- [x] Typical and worst supported holdings, the advanced solvers and the UI benchmarked on a mobile CPU slowdown;
      budgets set from the baseline and reported. *(below; `tests/perf/benchmark.test.ts`, `release.mjs`.)*
- [x] README, architecture, financial methodology, evidence standard, validation report and release notes updated;
      before/after recommendation changes explained.

## Performance budgets (set from the Milestone E baseline; Chromium at 4× CPU slowdown, 390 px)

| Measure | Budget | Measured (2026-11-28) | CI check |
|---|---|---|---|
| Input paint after a slider step | < 100 ms | ≈ 35 ms | fails above 3× budget |
| Recalculation incl. the 250 ms debounce, reference household | < 1.25 s | ≈ 650 ms | same |
| Joint search, reference household | < 3 s | ≈ 1.7 s | same |
| Offer check | < 1 s | ≈ 125 ms | same |
| Group planner, 8 members (Node) | < 1 s | ≤ 120 ms | benchmark log |
| Joint search, whole-lot holding (Node) | — | ≈ 2.2 s | benchmark log |

No Web Worker: every budget holds with a wide margin.

## Validation matrix (required rows)

167 m² with zero capital / no borrowing, ₪300K + ₪5K/month, ₪800K; 83.5 m²; 1.5, 3 and 4 rights; unknown inputs; every
goal type; three lots; slider extremes (25% / 45%, markup 15% / 20%). Outcomes may change when a defect is corrected —
each change documented with its independent calculation.
