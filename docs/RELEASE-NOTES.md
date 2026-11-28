# Release notes

## 1.0.0-rc.1 (2026-11-28) — V1.0 release candidate

A release **candidate**: every automated V1.0 gate passes (RELEASE-CRITERIA); professional review by an appraiser, a
tax adviser and a real-estate lawyer is open and blocking for any claim of validated reliance (`docs/review/`). It
becomes 1.0.0 when the three sign-offs are recorded.

**For owners**
- The summary shows one direction and up to two other kinds of deal, what matters for your goal (value, whole
  apartments, net monthly income, cash by your deadline, or borrowing), and — when nothing fits — what blocks it.
- All five goals are available in the advanced view (the wizard keeps three); a saved goal is never replaced.
- Your entitlement is shown on the official allocation share, with the 2.25-per-167 m² convention beside it and the
  difference explained.
- **Check a real offer**: enter only what the offer says; anything missing stays unknown and becomes a question. The
  offer is compared line by line with the base terms, on the same date and basis. Nothing is saved or sent.
- **What to ask for**: one list of terms with what each is worth to you, what it costs the developer and whether the
  model finds it plausible — a modelled hurdle, never an offer.
- Contract protections and questions (approval deadline, refunds, Sale Law guarantee, financing condition, options);
  option contracts are compared only when their terms are entered.
- A concise printed report tied to the exact calculation (id, time, data and build versions), with taxes by payer,
  dependencies, questions and source dates. Printing waits for the latest calculation.
- A warning before saving answers on a shared device; "forget" removes everything the app stored.

**Model and data** (no recommendation changed — household matrix identical before and after V1.0 work)
- One contract snapshot read by both sides, with bilateral events (who pays whom; legal liability vs contractual payer)
  and financing facilities that reconcile to their terminal balances.
- A versioned, validated Project Pack with canonical evidence statuses; a confirmed offer counts only for its lot and
  validity window on the common comparison date (2026-11-28).
- Cancellation outcome split into refundable advances, taxes, non-refundable costs, rights kept and the reserve.
- Data version 2026-11-28.15, kernel `mimush-kernel/2026-11-28.1`, contract schema `blro-contract/1`, pack schema
  `blro-pack/1`.

**Quality gates**
- 614 unit/property tests; typecheck; lint; locked production build.
- Browser checks on the deployed build and base path: privacy (no requests, nothing stored from the advanced tools),
  keyboard-only wizard, RTL, axe WCAG 2 A/AA (no serious or critical violations), print, stale results, reset.
- Timings at 4× CPU slowdown: input paint ≈ 35 ms, recalculation ≈ 650 ms, joint search ≈ 1.7 s, offer check ≈ 125 ms.
- Dependencies: 0 known vulnerabilities (`npm audit`); CI actions pinned to commits; least-privilege deploy.

**Known limits**
- Not professionally validated; lender terms need an actual approval; no current developer offer or land valuation.
- The construction-survey high-rise column, Bank of Israel directive 329 and the VAT rate need a human re-check
  (`docs/review/README.md`).
- The offer check maps taxes onto three arrangement templates (a different VAT payer is flagged, not modelled) and does
  not model completion-payment timing.
- The group planner is illustrative and limited; full collective allocation is out of V1.0 scope (LandLens).
