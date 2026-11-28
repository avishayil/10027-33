# Validation report — iteration 3

Baseline reviewed: `1a0d80e` (2026-11-27). This report records what was reproduced, what changed and why, and
what still needs professional review. **Every number here is illustrative arithmetic under stated assumptions —
not a tax assessment, appraisal, lending approval or legal opinion.**

## 1. Reproduction of the baseline

The reviewer's independent Python check (`independent-financial-check.py`) was run unchanged; the TypeScript
engine at `1a0d80e` produced the same figures:

| Case | S06 net | S06 owner-paid | S11 net | S05 |
|---|---|---|---|---|
| 2.25 rights, ₪300K | 235,276 / 1,375 | 515,041 / 3,011 | 313,615 / 1,833 | 1,249,749 / 7,306 |
| 1.125, ₪300K | 1,282,082 / 7,495 | 1,420,281 / 8,303 | 1,506,055 / 8,804 | — |
| 1.5, ₪300K | 934,270 / 5,462 | 1,118,534 / 6,539 | 1,109,754 / 6,488 | — |
| 2.25, ₪800K | 0 / 0 | 0 / 0 | 0 / 0 | 688,074 / 4,022 |

Developer P&L (Python): −13.8% at 35% net; −18.8% with contractor profit and purchase tax (old base). The two
iteration-2 golden fixtures are kept as named **LEGACY** scenarios (`tests/fixtures/configs.ts`) and still
reproduce ₪515,041 / ₪3,011 and ₪235,276 exactly.

## 2. Household matrix — before (`1a0d80e`)

| R | Cash | Repay | Goal | Decision | Status | Cash at signing | Tax reserve (owner) | Peak debt | Monthly | Dev. margin | Adverse value | S06 / S11 / S05 peak / monthly |
|---|---:|---:|---|---|---|---:|---:|---:|---:|---:|---:|---|
| 2.25 | 300,000 | 5,000 | balanced | S06-1 | conditional/questionable | 0 | 0 | 235,276 | 1,375 | -13.8% | 2,077,211 | 235,276 / 1,375 · 313,615 / 1,833 · 1,249,749 / 7,306 |
| 2.25 | 0 | 0 | balanced | S02 | estimated_feasible/questionable | 0 | 0 | 0 | 0 | -13.8% | 1,612,730 | 563,125 / 3,292 · 637,155 / 3,725 · 1,573,623 / 9,199 |
| 2.25 | 800,000 | 5,000 | balanced | S06-1 | estimated_feasible/questionable | 0 | 0 | 0 | 0 | -13.8% | 2,081,874 | 0 / 0 · 0 / 0 · 688,074 / 4,022 |
| 1.125 | 300,000 | 5,000 | balanced | S02 | estimated_feasible/questionable | 0 | 0 | 0 | 0 | -13.8% | 806,365 | 1,282,082 / 7,495 · 1,506,055 / 8,804 · — |
| 1.5 | 300,000 | 5,000 | maximize_apartments | S08-1 | fragile/unverified | 167,767 | 48,462 | 1,483,960 | 4,968 | 16.2% | -420,514 (fails) | 934,270 / 5,462 · 1,109,754 / 6,488 · — |
| 3 | 600,000 | 8,000 | balanced | S02 | estimated_feasible/questionable | 0 | 0 | 0 | 0 | -13.8% | 2,752,310 | 1,868,540 / 10,923 · 2,219,507 / 12,975 · 672,348 / 3,930 |
| 3 | 300,000 | 5,000 | balanced | S02 | estimated_feasible/questionable | 0 | 0 | 0 | 0 | -13.8% | 2,752,310 | 2,193,020 / 12,820 · 2,535,346 / 14,821 · 1,013,133 / 5,923 |
| 4 | 3,000,000 | 20,000 | maximize_apartments | S06-2 | estimated_feasible/questionable | 0 | 0 | 0 | 0 | -13.8% | 3,695,949 | 0 / 0 · 0 / 0 · 0 / 0 |
| 2.25 | ? | ? | balanced | S02 | estimated_feasible/questionable | 0 | 0 | 0 | 0 | -13.8% | 1,612,730 | 563,125 / 3,292 · 637,155 / 3,725 · 1,573,623 / 9,199 |

## 3. Household matrix — after (this PR, headline = mixed deal)

| R | Cash | Repay | Goal | Decision | Status | Cash at signing | Tax reserve (owner) | Peak debt | Monthly | Dev. margin | Adverse value | S06 / S11 / S05 peak / monthly |
|---|---:|---:|---|---|---|---:|---:|---:|---:|---:|---:|---|
| 2.25 | 300,000 | 5,000 | balanced | S09 | estimated_feasible/unverified | 0 | 226,262 | 0 | 0 | — | 564,858 | 531,250 / 3,106 · 534,178 / 3,123 · 1,118,686 / 6,540 |
| 2.25 | 0 | 0 | balanced | S09 | estimated_feasible/unverified | 0 | 226,262 | 0 | 0 | — | 564,858 | 531,250 / 3,106 · 545,293 / 3,188 · 1,418,686 / 8,293 |
| 2.25 | 800,000 | 5,000 | balanced | S13-80 | estimated_feasible/questionable | 0 | 322,746 | 0 | 0 | -5.6% | 1,645,441 | 1,947 / 11 · 0 / 0 · 562,812 / 3,290 |
| 1.125 | 300,000 | 5,000 | balanced | S09 | estimated_feasible/unverified | 0 | 113,131 | 0 | 0 | — | 282,429 | 1,473,768 / 8,616 · 1,379,247 / 8,063 · — |
| 1.5 | 300,000 | 5,000 | maximize_apartments | S13-80 | conditional/questionable | 0 | 215,164 | 633,184 | 3,702 | -5.6% | 1,008,990 | 1,173,184 / 6,858 · 1,097,455 / 6,416 · — |
| 3 | 600,000 | 8,000 | balanced | S02 | estimated_feasible/questionable | 0 | 430,328 | 0 | 0 | -5.6% | 2,164,373 | 2,346,368 / 13,717 · 2,194,910 / 12,831 · 560,965 / 3,279 |
| 3 | 300,000 | 5,000 | balanced | S09 | estimated_feasible/unverified | 0 | 301,682 | 0 | 0 | — | 753,144 | 2,375,000 / 13,884 · 2,437,780 / 14,251 · 896,541 / 5,241 |
| 4 | 3,000,000 | 20,000 | maximize_apartments | S13-80 | estimated_feasible/questionable | 0 | 573,771 | 0 | 0 | -5.6% | 2,899,965 | 0 / 0 · 0 / 0 · 0 / 0 |
| 2.25 | ? | ? | balanced | S09 | estimated_feasible/unverified | 0 | 226,262 | 0 | 0 | — | 564,858 | 531,250 / 3,106 · 545,293 / 3,188 · 1,418,686 / 8,293 |

Columns: decision; status (feasibility/commercial); owner cash at signing; owner capital-gains reserve; peak debt;
peak monthly payment; modelled developer margin of that candidate; value under the adverse scenario; and the S06 /
S11 / S05 peak debt / monthly for comparison.

## 4. Decision by tax arrangement (after)

| Household | Gross | Mixed (headline) | Net |
|---|---|---|---|
| 2.25 rights, ₪300K, ₪5K | wait for approval, sell (S09) | S09 | **combination + 80 m² apartment, no debt (S13-80)** |
| 2.25, ₪0, no mortgage | S09 | S09 | full combination (fraction) |
| 1.5, ₪300K, ₪5K | S09 | combination + 80 m² (₪633K mortgage) | combination + 80 m² (₪418K mortgage) |
| 3, ₪300K, ₪5K | S09 | S09 | full combination (1 apartment) |
| 4, ₪3M, ₪20K, max apts | S13-80 (2 apartments) | S13-80 | S13-80 |

## 5. Why verdicts changed (each change traced to a model correction, not a preference)

1. **Contractor profit in the taxable services value** (+17.5%): the owner's reserve for 2.25 rights at 35% rises
   from ₪255,544 to ₪300,264 before levy effects (mixed deal with proportional levy: ₪322,746).
2. **No global net default.** Under the headline mixed deal the owner pays that tax at plan approval (§19(3א),
   conditional). ₪300K grown to month 24 (₪324,480) no longer covers tax + 8% completion purchase tax → S06 is
   infeasible (unfunded), and a pure combination is "fragile" (just covered, fails in the adverse scenario).
3. **Completion purchase tax 8% when property status is unknown** (was 6%): ₪42,500 on ₪531,250. Answering
   "sole home" can set it to 0% — the app asks only when that changes the outcome.
4. **Value-based apartment tiers**: the 0.7875 entitlement nearly covers a compact 80 m² apartment (gap ₪31,250),
   so under a net deal the moderate household gets a whole apartment without a mortgage.
5. **Commercial risk in ranking**: combination candidates carry a negative modelled developer margin (−5.6% mixed,
   −14%+ net) → "questionable"; waiting (S09) is unverified but not developer-dependent at signing.
6. **Developer sales are conditional on approval**: S05 proceeds now arrive at month 24 (was 6), so the hybrid
   needs bridge financing for longer.
7. **Negotiation overlap**: for the 1-apartment hybrid the owner's break-even surplus price (≈ ₪14,700/m²) is far
   above the developer's plausible maximum at a 15% margin (≈ ₪7,230/m²) → **no overlap** under these assumptions.

## 6. Source evidence (retrieved 2026-11-27)

| Topic | What was verified | Status |
|---|---|---|
| EA 6672/19 Yekutieli | Secondary summaries (Nadlan Center) confirm: entrepreneurial profit excluded; instruction 23/98 includes 15–20% contractor profit | Full ruling text not read |
| Position 06/26, §19(3א) | Secondary sources (Gelberg & co.) report sale date = approval date also when the buyer bears the seller's taxes; declaration and payment deferred | Official paper text not extracted |
| Net vs gross practice | Law-firm guides: many deals "net", others split; legal liability stays with the owner | No industry-wide statistic |
| Mihali (2026) | Reported limited construction-services election within a 106-unit project | Supports quotas as a mechanism only |
| Purchase-tax rates | Official simulator page referenced; 0% sole home within exemption / ~8% additional | Brackets not encoded; range used |
| Balancing pool (יחידת סל) | Ministry of Construction historical study | Practice, not a project term |

## 7. Professional review required before relying on results

- **Tax lawyer / adviser:** combination consideration (contractor profit, levy allocation, gross-up), §19(3א)
  eligibility for this project, completion classification and purchase tax, revenue-share timing, basis/inheritance.
- **Appraiser:** apartment values and tiers, post-approval land value, pre-approval sale price.
- **Project lender:** bridge / construction / mortgage availability, security, recognition of paid-in amounts.
- **Developer / owners' representative:** actual offers, services quota and eligibility, tax arrangement, completion
  pricing, balancing-pool mechanics, inventory.

## 8. Not implemented in this iteration (documented limitations)

- Project-wide (lot-level) developer P&L and IRR; the per-candidate P&L is standalone, at today's prices.
- Explicit no-approval scenario and separate planning-delay vs construction-duration stress.
- Mortgage-term stress (15/20/30 years), insurance and fees; directive-329 payment-to-income rules.
- Encoded residential purchase-tax brackets; capital-gains linear apportionment and surtax.
- Family consolidation (S12); anonymised owner-size distribution for actual slot demand.

## 9. Commands run

`npm ci` · `npm run typecheck` · `npm run lint` · `npm test` · `npm run build` · `npm run test:e2e`
(results in the PR description).

## Iteration 5 — services VAT, equivalent %, tax loan (2026-11-27)

Before = `main` at `fd92088`; after = this change (headline mixed, 35%). Generated by `tests/report/matrix.test.ts`.

### Before
| R | Cash | Repay | Goal | Decision | Status | Cash at signing | Tax reserve (owner) | Peak debt | Monthly | Dev. margin | Adverse value | S06 / S11 / S05 peak / monthly |
|---|---:|---:|---|---|---|---:|---:|---:|---:|---:|---:|---|
| 2.25 | 300,000 | 5,000 | balanced | none | — | — | — | — | — | — | — | 531,250 / 3,106 · 545,293 / 3,188 · 1,118,686 / 6,540 |
| 2.25 | 0 | 0 | balanced | none | — | — | — | — | — | — | — | 531,250 / 3,106 · 545,293 / 3,188 · 1,418,686 / 8,293 |
| 2.25 | 800,000 | 5,000 | balanced | S13-3r | estimated_feasible/questionable | 0 | 322,746 | 0 | 0 | -7.6% | 1,310,872 | 96,496 / 564 · 58,477 / 342 · 618,686 / 3,617 |
| 1.125 | 300,000 | 5,000 | balanced | S02P | estimated_feasible/questionable | 0 | 252,413 | 0 | 0 | -7.6% | 593,702 | 1,498,248 / 8,759 · 1,389,783 / 8,125 · — |
| 1.5 | 300,000 | 5,000 | maximize_apartments | S02P | estimated_feasible/questionable | 0 | 336,551 | 0 | 0 | -7.6% | 791,602 | 1,187,500 / 6,942 · 1,112,681 / 6,505 · — |
| 3 | 600,000 | 8,000 | balanced | S02 | estimated_feasible/questionable | 0 | 430,328 | 0 | 0 | -7.6% | 1,746,178 | 2,375,000 / 13,884 · 2,225,362 / 13,009 · 600,607 / 3,511 |
| 3 | 300,000 | 5,000 | balanced | none | — | — | — | — | — | — | — | 2,375,000 / 13,884 · 2,437,780 / 14,251 · 900,607 / 5,265 |
| 4 | 3,000,000 | 20,000 | maximize_apartments | S13-3r | estimated_feasible/questionable | 0 | 573,771 | 0 | 0 | -7.6% | 2,276,626 | 0 / 0 · 0 / 0 · 0 / 0 |
| 2.25 | ? | ? | balanced | none | — | — | — | — | — | — | — | 531,250 / 3,106 · 545,293 / 3,188 · 1,418,686 / 8,293 |

### After
| R | Cash | Repay | Goal | Decision | Status | Cash at signing | Tax reserve (owner) | Peak debt | Monthly | Dev. margin | Adverse value | S06 / S11 / S05 peak / monthly |
|---|---:|---:|---|---|---|---:|---:|---:|---:|---:|---:|---|
| 2.25 | 300,000 | 5,000 | balanced | S02P | conditional/questionable | 0 | 459,023 | 194,896 | 0 | -2.2% | 986,255 | 727,242 / 4,251 · 659,464 / 3,855 · 1,118,686 / 6,540 |
| 2.25 | 0 | 0 | balanced | none | — | — | — | — | — | — | — | 531,250 / 3,106 · 545,293 / 3,188 · 1,418,686 / 8,293 |
| 2.25 | 800,000 | 5,000 | balanced | S13-3r | estimated_feasible/questionable | 0 | 276,943 | 0 | 0 | -2.2% | 1,173,464 | 233,905 / 1,367 · 175,921 / 1,028 · 618,686 / 3,617 |
| 1.125 | 300,000 | 5,000 | balanced | S02P | estimated_feasible/questionable | 0 | 229,511 | 0 | 0 | -2.2% | 524,997 | 1,515,625 / 8,860 · 1,401,527 / 8,193 · — |
| 1.5 | 300,000 | 5,000 | maximize_apartments | S02P | conditional/questionable | 0 | 306,015 | 8,239 | 0 | -2.2% | 695,953 | 1,195,785 / 6,990 · 1,159,659 / 6,779 · — |
| 3 | 600,000 | 8,000 | balanced | S02 | conditional/questionable | 0 | 369,258 | 16,570 | 97 | -2.2% | 1,550,862 | 2,391,570 / 13,981 · 2,319,317 / 13,558 · 600,607 / 3,511 |
| 3 | 300,000 | 5,000 | balanced | S02 | conditional/questionable | 0 | 369,258 | 383,699 | 2,243 | -2.2% | 1,368,348 | 2,758,699 / 16,127 · 2,455,691 / 14,356 · 900,607 / 5,265 |
| 4 | 3,000,000 | 20,000 | maximize_apartments | S13-3r | estimated_feasible/questionable | 0 | 492,343 | 0 | 0 | -2.2% | 2,032,344 | 0 / 0 · 0 / 0 · 0 / 0 |
| 2.25 | ? | ? | balanced | none | — | — | — | — | — | — | — | 1,094,372 / 6,398 · 1,026,594 / 6,001 · 1,418,686 / 8,293 |

What changed and why:
- **₪300K / ₪5K, 2.25 rights** and **₪300K / ₪5K, 3 rights**: from "nothing fits" to a recommendation via a tax loan
  (#62) — combination + pool sale with ₪195K repaid at delivery; full combination with ₪384K refinanced at ₪2,243/month.
- **No cash, borrowing ruled out**: still nothing fits — no loan without borrowing capacity.
- **Owner capital-gains reserves fall** (e.g. ₪322,746 → ₪276,943): VAT the owner pays is not consideration (#60).
- **Developer margin −7.6% → −2.2%**: the owner, not the developer, pays the services VAT in a mixed deal.
- Arrangement outcomes are now at their developer-equivalent % (≈ 25.7% net / 40.5% gross for 35% mixed, #61).

## Iteration 6 — review of c482315 (2026-11-27)

Before = `main` at `c482315`; after = this change (headline mixed, 35%). "none → X if developer_loan" = no route fits
without financing the household must still obtain; X fits with a developer/bank tax loan (#71).

### Before
| R | Cash | Repay | Goal | Decision | Status | Cash at signing | Tax reserve (owner) | Peak debt | Monthly | Dev. margin | Adverse value | S06 / S11 / S05 peak / monthly |
|---|---:|---:|---|---|---|---:|---:|---:|---:|---:|---:|---|
| 2.25 | 300,000 | 5,000 | balanced | S02P | conditional/questionable | 0 | 459,023 | 194,896 | 0 | -2.2% | 986,255 | 727,242 / 4,251 · 659,464 / 3,855 · 1,118,686 / 6,540 |
| 2.25 | 0 | 0 | balanced | none | — | — | — | — | — | — | — | 531,250 / 3,106 · 545,293 / 3,188 · 1,418,686 / 8,293 |
| 2.25 | 800,000 | 5,000 | balanced | S13-3r | estimated_feasible/questionable | 0 | 276,943 | 0 | 0 | -2.2% | 1,173,464 | 233,905 / 1,367 · 175,921 / 1,028 · 618,686 / 3,617 |
| 1.125 | 300,000 | 5,000 | balanced | S02P | estimated_feasible/questionable | 0 | 229,511 | 0 | 0 | -2.2% | 524,997 | 1,515,625 / 8,860 · 1,401,527 / 8,193 · — |
| 1.5 | 300,000 | 5,000 | maximize_apartments | S02P | conditional/questionable | 0 | 306,015 | 8,239 | 0 | -2.2% | 695,953 | 1,195,785 / 6,990 · 1,159,659 / 6,779 · — |
| 3 | 600,000 | 8,000 | balanced | S02 | conditional/questionable | 0 | 369,258 | 16,570 | 97 | -2.2% | 1,550,862 | 2,391,570 / 13,981 · 2,319,317 / 13,558 · 600,607 / 3,511 |
| 3 | 300,000 | 5,000 | balanced | S02 | conditional/questionable | 0 | 369,258 | 383,699 | 2,243 | -2.2% | 1,368,348 | 2,758,699 / 16,127 · 2,455,691 / 14,356 · 900,607 / 5,265 |
| 4 | 3,000,000 | 20,000 | maximize_apartments | S13-3r | estimated_feasible/questionable | 0 | 492,343 | 0 | 0 | -2.2% | 2,032,344 | 0 / 0 · 0 / 0 · 0 / 0 |
| 2.25 | ? | ? | balanced | none | — | — | — | — | — | — | — | 1,094,372 / 6,398 · 1,026,594 / 6,001 · 1,418,686 / 8,293 |

### After
| R | Cash | Repay | Goal | Decision | Status | Cash at signing | Tax reserve (owner) | Peak debt | Monthly | Dev. margin | Adverse value | S06 / S11 / S05 peak / monthly |
|---|---:|---:|---|---|---|---:|---:|---:|---:|---:|---:|---|
| 2.25 | 300,000 | 5,000 | balanced | none → S02P if developer_loan | — | — | — | — | — | — | — | 531,250 / 3,106 · 545,293 / 3,188 · 1,118,686 / 6,540 |
| 2.25 | 0 | 0 | balanced | none → S02P if net | — | — | — | — | — | — | — | 531,250 / 3,106 · 545,293 / 3,188 · 1,418,686 / 8,293 |
| 2.25 | 800,000 | 5,000 | balanced | S13-3r | estimated_feasible/questionable | 0 | 276,943 | 0 | 0 | -5.0% | 1,173,464 | 233,905 / 1,367 · 175,921 / 1,028 · 618,686 / 3,617 |
| 1.125 | 300,000 | 5,000 | balanced | S02P | estimated_feasible/questionable | 0 | 229,511 | 0 | 0 | -5.0% | 524,997 | 1,515,625 / 8,860 · 1,401,527 / 8,193 · — |
| 1.5 | 300,000 | 5,000 | maximize_apartments | none → S02P if developer_loan | — | — | — | — | — | — | — | 1,187,500 / 6,942 · 1,159,659 / 6,779 · — |
| 3 | 600,000 | 8,000 | balanced | none → S02 if developer_loan | — | — | — | — | — | — | — | 2,375,000 / 13,884 · 2,319,317 / 13,558 · 600,607 / 3,511 |
| 3 | 300,000 | 5,000 | balanced | none → S02 if developer_loan | — | — | — | — | — | — | — | 2,375,000 / 13,884 · 2,437,780 / 14,251 · 900,607 / 5,265 |
| 4 | 3,000,000 | 20,000 | maximize_apartments | S13-3r | estimated_feasible/questionable | 0 | 492,343 | 0 | 0 | -5.0% | 2,032,344 | 0 / 0 · 0 / 0 · 0 / 0 |
| 2.25 | ? | ? | balanced | none → S02P if net | — | — | — | — | — | — | — | 531,250 / 3,106 · 545,293 / 3,188 · 1,418,686 / 8,293 |

Reproduced against the review's independent figures: owner obligations at 35% gross ₪652,860 / mixed ₪460,155 / net ₪0;
tax loan ₪160,155 → ₪203,223 at 7.965% (₪43,068 interest); VAT-reconciled standalone net-equivalent ≈ 25.44%.
What changed and why:
- Households that fitted only by assuming a tax loan (2.25 / ₪300K; 1.5 / ₪300K; 3 rights / ₪300K and ₪600K) now get a
  conditional direction with the loan's cost — the loan is no longer assumed (#71).
- Developer margin −2.2% → −5.0%: the lot-level model adds financing and the timing of the taxes it bears (#75).
- Peak debt is measured before same-month repayment; delivery value deducts the tax-loan interest (#66).
- Not done this round: two smaller apartments instead of one; project-wide P&L across all three lots; professional
  review of VAT, levy deduction and capital-gains treatment.

## Iteration 7 — review of c32bb73 (2026-11-27)

Before = `main` at `c32bb73`; after = this change. Reproduced against the review: lot 149, 35% mixed —
margin −3.69% (review −4.27%; the difference is the ownership-share tax scaling, ≈ ₪0.73M), viable % 17.3% (16.8%),
break-evens ₪8,870/m² developer cost (₪8,805) and ₪32,106/m² apartment price (₪32,323).

### Before
| R | Cash | Repay | Goal | Decision | Status | Cash at signing | Tax reserve (owner) | Peak debt | Monthly | Dev. margin | Adverse value | S06 / S11 / S05 peak / monthly |
|---|---:|---:|---|---|---|---:|---:|---:|---:|---:|---:|---|
| 2.25 | 300,000 | 5,000 | balanced | none → S02P if developer_loan | — | — | — | — | — | — | — | 531,250 / 3,106 · 545,293 / 3,188 · 1,118,686 / 6,540 |
| 2.25 | 0 | 0 | balanced | none → S02P if net | — | — | — | — | — | — | — | 531,250 / 3,106 · 545,293 / 3,188 · 1,418,686 / 8,293 |
| 2.25 | 800,000 | 5,000 | balanced | S13-3r | estimated_feasible/questionable | 0 | 276,943 | 0 | 0 | -5.0% | 1,173,464 | 233,905 / 1,367 · 175,921 / 1,028 · 618,686 / 3,617 |
| 1.125 | 300,000 | 5,000 | balanced | S02P | estimated_feasible/questionable | 0 | 229,511 | 0 | 0 | -5.0% | 524,997 | 1,515,625 / 8,860 · 1,401,527 / 8,193 · — |
| 1.5 | 300,000 | 5,000 | maximize_apartments | none → S02P if developer_loan | — | — | — | — | — | — | — | 1,187,500 / 6,942 · 1,159,659 / 6,779 · — |
| 3 | 600,000 | 8,000 | balanced | none → S02 if developer_loan | — | — | — | — | — | — | — | 2,375,000 / 13,884 · 2,319,317 / 13,558 · 600,607 / 3,511 |
| 3 | 300,000 | 5,000 | balanced | none → S02 if developer_loan | — | — | — | — | — | — | — | 2,375,000 / 13,884 · 2,437,780 / 14,251 · 900,607 / 5,265 |
| 4 | 3,000,000 | 20,000 | maximize_apartments | S13-3r | estimated_feasible/questionable | 0 | 492,343 | 0 | 0 | -5.0% | 2,032,344 | 0 / 0 · 0 / 0 · 0 / 0 |
| 2.25 | ? | ? | balanced | none → S02P if net | — | — | — | — | — | — | — | 531,250 / 3,106 · 545,293 / 3,188 · 1,418,686 / 8,293 |

### After
| R | Cash | Repay | Goal | Decision | Status | Cash at signing | Tax reserve (owner) | Peak debt | Monthly | Dev. margin | Adverse value | S06 / S11 / S05 peak / monthly |
|---|---:|---:|---|---|---|---:|---:|---:|---:|---:|---:|---|
| 2.25 | 300,000 | 5,000 | balanced | none → S02P if developer_loan | — | — | — | — | — | — | — | 531,250 / 3,106 · 545,293 / 3,188 · 1,118,686 / 6,540 |
| 2.25 | 0 | 0 | balanced | none → S02 if net | — | — | — | — | — | — | — | 531,250 / 3,106 · 545,293 / 3,188 · 1,418,686 / 8,293 |
| 2.25 | 800,000 | 5,000 | balanced | S13-3r | estimated_feasible/questionable | 0 | 276,943 | 0 | 0 | -3.7% | 1,173,464 | 233,905 / 1,367 · 175,921 / 1,028 · 618,686 / 3,617 |
| 1.125 | 300,000 | 5,000 | balanced | S02P | estimated_feasible/questionable | 0 | 229,511 | 0 | 0 | -3.7% | 524,997 | 1,515,625 / 8,860 · 1,401,527 / 8,193 · — |
| 1.5 | 300,000 | 5,000 | maximize_apartments | none → S02P if developer_loan | — | — | — | — | — | — | — | 1,187,500 / 6,942 · 1,159,659 / 6,779 · — |
| 3 | 600,000 | 8,000 | balanced | none → S02 if developer_loan | — | — | — | — | — | — | — | 2,375,000 / 13,884 · 2,319,317 / 13,558 · 600,607 / 3,511 |
| 3 | 300,000 | 5,000 | balanced | none → S02 if developer_loan | — | — | — | — | — | — | — | 2,375,000 / 13,884 · 2,437,780 / 14,251 · 900,607 / 5,265 |
| 4 | 3,000,000 | 20,000 | maximize_apartments | S13-3r+3r | estimated_feasible/questionable | 0 | 492,343 | 0 | 0 | -3.7% | 2,053,533 | 0 / 0 · 0 / 0 · 0 / 0 |
| 2.25 | ? | ? | balanced | none → S02 if net | — | — | — | — | — | — | — | 531,250 / 3,106 · 545,293 / 3,188 · 1,418,686 / 8,293 |

What changed and why:
- Developer margin −5.0% → −3.7%: cash carry-forward and ownership-share taxes (#80, #81).
- 4 rights / ₪3M, whole-apartment goal: two 3-room apartments instead of one standard + one 3-room (#88).
- 2.25 rights with no cash: the conditional net direction is now full combination — on present value, holding the
  fraction until a later sale is compared on timing (#85).
- Still open: professional review of the tax treatment; actual developer cost data; inventory and allocation rules.

## Iteration 8 — review of cffb86d (2026-11-27)

Before = `main` at `cffb86d`; after = this change.

### Before
| R | Cash | Repay | Goal | Decision | Status | Cash at signing | Tax reserve (owner) | Peak debt | Monthly | Dev. margin | Adverse value | S06 / S11 / S05 peak / monthly |
|---|---:|---:|---|---|---|---:|---:|---:|---:|---:|---:|---|
| 2.25 | 300,000 | 5,000 | balanced | none → S02P if developer_loan | — | — | — | — | — | — | — | 531,250 / 3,106 · 545,293 / 3,188 · 1,118,686 / 6,540 |
| 2.25 | 0 | 0 | balanced | none → S02 if net | — | — | — | — | — | — | — | 531,250 / 3,106 · 545,293 / 3,188 · 1,418,686 / 8,293 |
| 2.25 | 800,000 | 5,000 | balanced | S13-3r | estimated_feasible/questionable | 0 | 276,943 | 0 | 0 | -3.7% | 1,173,464 | 233,905 / 1,367 · 175,921 / 1,028 · 618,686 / 3,617 |
| 1.125 | 300,000 | 5,000 | balanced | S02P | estimated_feasible/questionable | 0 | 229,511 | 0 | 0 | -3.7% | 524,997 | 1,515,625 / 8,860 · 1,401,527 / 8,193 · — |
| 1.5 | 300,000 | 5,000 | maximize_apartments | none → S02P if developer_loan | — | — | — | — | — | — | — | 1,187,500 / 6,942 · 1,159,659 / 6,779 · — |
| 3 | 600,000 | 8,000 | balanced | none → S02 if developer_loan | — | — | — | — | — | — | — | 2,375,000 / 13,884 · 2,319,317 / 13,558 · 600,607 / 3,511 |
| 3 | 300,000 | 5,000 | balanced | none → S02 if developer_loan | — | — | — | — | — | — | — | 2,375,000 / 13,884 · 2,437,780 / 14,251 · 900,607 / 5,265 |
| 4 | 3,000,000 | 20,000 | maximize_apartments | S13-3r+3r | estimated_feasible/questionable | 0 | 492,343 | 0 | 0 | -3.7% | 2,053,533 | 0 / 0 · 0 / 0 · 0 / 0 |
| 2.25 | ? | ? | balanced | none → S02 if net | — | — | — | — | — | — | — | 531,250 / 3,106 · 545,293 / 3,188 · 1,418,686 / 8,293 |

### After
| R | Cash | Repay | Goal | Decision | Status | Cash at signing | Tax reserve (owner) | Peak debt | Monthly | Dev. margin | Adverse value | S06 / S11 / S05 peak / monthly |
|---|---:|---:|---|---|---|---:|---:|---:|---:|---:|---:|---|
| 2.25 | 300,000 | 5,000 | balanced | none → S02P if developer_loan | — | — | — | — | — | — | — | 531,250 / 3,106 · 545,293 / 3,188 · 1,118,686 / 6,540 |
| 2.25 | 0 | 0 | balanced | none → S02 if net | — | — | — | — | — | — | — | 531,250 / 3,106 · 545,293 / 3,188 · 1,418,686 / 8,293 |
| 2.25 | 800,000 | 5,000 | balanced | S13-3r | estimated_feasible/unverified | 0 | 276,943 | 0 | 0 | 4.2% | 1,173,464 | 233,905 / 1,367 · 175,921 / 1,028 · 618,686 / 3,617 |
| 1.125 | 300,000 | 5,000 | balanced | S02P | estimated_feasible/unverified | 0 | 229,511 | 0 | 0 | 4.2% | 524,997 | 1,515,625 / 8,860 · 1,401,527 / 8,193 · — |
| 1.5 | 300,000 | 5,000 | maximize_apartments | none → S02P if developer_loan | — | — | — | — | — | — | — | 1,187,500 / 6,942 · 1,159,659 / 6,779 · — |
| 3 | 600,000 | 8,000 | balanced | none → S02 if developer_loan | — | — | — | — | — | — | — | 2,375,000 / 13,884 · 2,319,317 / 13,558 · 600,607 / 3,511 |
| 3 | 300,000 | 5,000 | balanced | none → S02 if developer_loan | — | — | — | — | — | — | — | 2,375,000 / 13,884 · 2,437,780 / 14,251 · 900,607 / 5,265 |
| 4 | 3,000,000 | 20,000 | maximize_apartments | S13-3r+3r | estimated_feasible/unverified | 0 | 492,343 | 0 | 0 | 4.2% | 2,053,533 | 0 / 0 · 0 / 0 · 0 / 0 |
| 2.25 | ? | ? | balanced | none → S02 if net | — | — | — | — | — | — | — | 531,250 / 3,106 · 545,293 / 3,188 · 1,418,686 / 8,293 |

Developer margin −3.7% → +4.2% (#91–#92): the plan-area budget is about the old direct cost; the change comes from
selling the lot's actual saleable area (110 m² a unit). Household directions are unchanged in this matrix; the
ranking now uses value to you (#94). Still outstanding (release gate): professional review by an appraiser, a tax
adviser and a real-estate lawyer; actual developer tenders; development levies and fees (not modelled).

## Iteration 9 — reviews of 0bf74d7 (2026-11-27)

Plan: `docs/IMPLEMENTATION-PLAN-ITERATION-9.md` (phases A and B; owner decisions: reconciliation option (a), A+B in
one PR, any-purpose loan kept at the 50% base).

**Independent arithmetic** (`tests/validation/golden.test.ts`, numbers typed from the formulas, not from the engine):
2.25 rights, 0.7875 at 35%, 44.44% for a whole apartment; completion ₪531,250; S11 split 0.326923 / 1.923077 and
₪498,607 of services at ₪1,525,150 per apartment; lot 149 direct budget ₪114,432,600 (+10% = ₪11,443,260,
₪10,208.99 per saleable m²); owner ₪1,968,750 vs official-share ₪2,307,793 (117.22 m² per right); ₪1M real at year 5
= ₪1,104,081 nominal, fixed nominal ₪1M = ₪905,731 real, PV difference ≈ ₪81,320 at 3%.

**Reconciliation** (`tests/domain/consideration.test.ts`): owner value + not credited = developer forgone for every
route of three holdings; ₪1,968,750 + ₪339,043 = ₪2,307,793 at 35% full combination on lot 149.

**Quota** (`tests/domain/quota.test.ts`): 25 slots; S11 takes one; a full quota displaces exactly one participant whose
unit moves into combination; never negative or above the quota.

**Tax-loan maturity** (`tests/domain/taxLoanMaturity.test.ts`): zero-rate draw/repay; cash-covered maturity with a
later pool sale passes; no cash and no facility → full gap, repaid later; facility capped, remainder a gap; draw after
delivery.

**Money basis** (`tests/domain/moneyBasis.test.ts`): real ₪1M at year 5 needs ₪1,104,081; nominal used as is; zero
inflation unchanged; zero-rate borrow/repay leaves financing value 0; valuation deflates once (real 1/1.03⁵, nominal
1/(1.03·1.02)⁵).

**Levy and evidence** (`tests/domain/boughtRightsLevy.test.ts`): bought rights carry their levy once, on the buyer,
range 0–full; 0.75 right ≈ ₪85.6K on lot 149; doubling the unverified developer price does not change the ranking.

**Before / after** (`docs/validation/before-0bf74d7.md` → `docs/validation/after-iteration9.md`): no decision changed
in the nine-household matrix. Developer margin 4.2% → 4.1% (whole slots). Completion and services borrowing are shown
in the shekels of delivery (S06 ₪531,250 → ₪569,628; S05 and S11 figures move with them). Adverse-scenario values are
restated in today's prices (e.g. 2.25 / ₪800K: ₪1,173,464 → ₪1,245,871).

**Test expectations changed on purpose** (each with a reason in the test): the lot quota 25.5 → 25; refinancing above the
facility now ends as a maturity gap (`TAX_LOAN_EXTENSION_NEEDED`) instead of an LTV failure; the near-miss capital in
iteration 4 grew ≈ ₪10.6K → ≈ ₪25.8K (taxes in the shekels of their date); the levy invariant counts rights held at
approval (own + bought); the iteration-2 legacy fixture runs with 0% inflation, as iteration 2 did.

**Not done here** (planned in phases C–E): developer budget detail (area definitions, VAT basis, indirect costs,
developer IRR, joint stresses), Pareto mix search, rental realism, cancellation state ledger, input validation,
performance measurement, joint owner–developer contract search. Pinning CI actions to SHAs. Professional review by an
appraiser, a tax adviser and a lawyer remains a release gate.

Commands: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e`.

### Iteration 9 — phase C (developer budget and evidence)
Tests: `tests/domain/developerStress.test.ts` — IRR of a known 1%-a-month flow; no sign change → no IRR; equity-flow
conservation; base row = lot P&L; every adverse stress lowers the margin and the public-buildings row raises it; the
combined stress is worse than any single one; headroom × saleable area = profit (and profit − target × revenue); a 10%
cost rise lowers profit by more than ₪11.44M × 1.12. Performance: one analysis ≈ 79 ms (unchanged). Recommendations
unchanged (no owner-side formula changed; the favourable immediate-sale scenario only affects the price-dependent sale
route's threshold display).

### Iteration 9 — phase D (optimiser, UX, performance)
Tests: `tests/optimizer/mixSearch.test.ts` (extremes kept, cap, unique ids, integer entitlement, two above whole);
`tests/domain/rental.test.ts` (rent start delay costs ≥ 3 months' rent; 80% recognition raises the personal payment by
20% of rent; fraction earns no rent; rental variants kept for an income goal); `tests/optimizer/cancellation.test.ts`
(failure month, paid-to-developer from the ledger, protected/unprotected identities, S02 pays nothing; delay computed for
shown routes only and lowers value); `tests/domain/validation.test.ts` (parcel and lot bounds — 7,097 m² on lot 149 —,
unknown lot, negatives, percentages, null ≠ 0, engine refuses); storage tests (goal migration reported, unknown saved lot
dropped). Household matrix unchanged (`docs/validation/before-phaseD.md` = `after-phaseD.md`). Browser timing at 4× CPU
slowdown: load ≈ 0.9 s; slider step ≈ 40 ms (was ≈ 300 ms); a 5-step drag settles in ≈ 1.5 s (was ≈ 2.0 s).

### Iteration 9 — phase E (bilateral contract search)
`tests/optimizer/jointSearch.test.ts`: the grid covers 3 × 11 contracts inside the slider; the developer side equals the
lot P&L on the same terms and "ok" means at or above the hurdle; feasible = both accept; the frontier is non-dominated;
the whole-apartment goal is respected; the exact developer maximum equals `lotViablePct`; without overlap (167 m²,
₪300K, ₪5K/month) the net deal fits the owner but never the developer, and pricing apartments at the computed floor
restores the developer's target. Example (that household): no overlap in 25–45%; mixed deal — the developer's maximum is
≈ 24.7%, and there the household would need ≈ ₪39K more own capital; net deal — at 25% it works for the developer only
at ≤ ₪8,920/m² direct cost or ≥ ₪28,701/m² apartment price. Model thresholds, not market data.

### Iteration 9 — phase F (group planner, contracts with an option)
`tests/optimizer/collective.test.ts`: slots never exceeded; a pool forms only with ≥ one apartment of shares; no owner
below their baseline; totals reconcile; more slots never lower first choices; at most eight owners; with the review's
illustrative four owners and two slots, a pool-dependent owner's 0.79 share is completed by another owner joining (alone
the pool would not form). `tests/optimizer/contingent.test.ts`: fallback is the full combination; regret is zero for the
best choice per state and never negative; option rows take the target's value when financed and the combination's
otherwise; ordering by largest regret. Main recommendation and household matrix unchanged.

## Iteration 10 — review of c689d0b (2026-11-28)

Brief: `iteration-9-comprehensive-review.md`. Owner decisions: entitlement = official allocation share; deliver to `main`.
Commits: I1 entitlement + consideration ledger · I2 accounting (§D) · I3 contract snapshot + bilateral search · I4 group
planner · I5 contracts with an option · I6 concessions and explanations · I7 validation, CI, e2e, benchmarks, docs.

**Acceptance tests** (expected values typed independently, not read from the engine):

| ID | Test | Result |
|---|---|---|
| J1 | `tests/optimizer/jointSearch.test.ts` — A 1.5M / 14%, B 1.4M / 15.5%, hurdle 15% → only B; each pair's margin = that route's lot margin; stable contract ids | pass |
| J2 | same — a 30.2–30.8% band is missed at a 2-point step (complete: false), found at the 0.5-point slider step; refinement where the result changes; endpoints included | pass |
| J3 | same — step 0, NaN, negative, ∞ and min > max throw; the search validates its step | pass |
| J4 | same — five goals, each on its own metric; tier/mix routes and the rentals derived from them never count for the owner | pass |
| J5 | same — the price lever, re-evaluated, restores the developer's hurdle and reports whether the owner still accepts | pass |
| G1 | `tests/optimizer/collective.test.ts` — 2 × 0.7875 at ₪2.5M, 2% → one unit, ₪2.45M in all, ₪1,225,000 each, 0.575 residual (₪1,437,500 gross, no cash); integration: each owner's pool inflow = 0.5 of one unit's net, 0.2875 kept | pass |
| G2 | same — eight 1,000 m² holdings in lot 149 (> 7,097 m²) rejected; > 8 members, NaN / negative inputs rejected | pass |
| G3 | same — lots 150 and 153 evaluated on their own rights, never lot 149 | pass |
| G4 | same — every option is a snapshot of the group's contract; one lot P&L for the group; a one-owner group equals that route's lot P&L | pass |
| G5 | same — slots above the quota, 1.5, −1, NaN rejected; no policy-blocked option; slots = whole service apartments | pass |
| G6 | same — outside-option and no-reservation statuses; no fairness claim unless it holds for all; bounds reported | pass |
| C1 | `tests/optimizer/contingent.test.ts` — no implicit fallback; option rows name S02, the exercise date, the condition, fee unknown | pass |
| C2 | same — ₪100K at signing in the target moves to month 24, PV ⌊94,259⌋; the fallback's prefix kept, identical events paid once | pass |
| C3 | same — a conditional deal keeps its arrangement, % and funding; no-financing disables all facilities; unknown capital executable only where no capital is needed; unique contract ids | pass |
| C4 | same — A (100, 100, −100) → 100, B (95, 95, 0) → 5; approved-only would give 0 / 5 | pass |
| F1–F3, F6, F7, D4, D5, D7 | `tests/domain/accounting10.test.ts` — facility rows, overdue tax loan, nominal ceiling ₪1,380,101, today's-price delivery, equivalence roots, direct-cost stress, typed evidence, interval solver | pass |
| F4, F5 | `tests/domain/consideration.test.ts` — ₪1,968,750 vs ₪2,307,793 kept apart on the simulation basis (residual ₪339,043 flagged), equal on the official basis; two 81 m² units = 2 apartments, 162 m² | pass |
| UX1 | `tests/e2e/privacy.mjs` — after the joint search, changing the markup hides the result ("הנתונים השתנו") | pass |
| PRIV1 | same — joint search and group planner trigger no requests; no group inputs in localStorage; served under `/10027-33/` | pass |

Also: `tests/optimizer/concessions.test.ts` (efficiency 30K / 20K = 1.5; +1 point re-evaluated on both sides; lot-wide
cost attributed by the lot share; frontier executable and non-dominated; explanations separate financing from the
developer's hurdle), `tests/domain/validation.test.ts` (new checks), `tests/release/publicAssets.test.ts`.

**Before / after** (`docs/validation/before-c689d0b.md` → `docs/validation/after-iteration10.md`). Changes come from the
official entitlement (167 m² ≈ 2.64 apartment equivalents instead of 2.25), as decided:
- 2.25-right household with ₪800K: S13-3r → S06-1-rent. The whole apartment now needs only a small completion (its
  S06 mortgage ₪292,590 → ₪0); for the ₪300K household the S06 mortgage falls ₪569,628 → ₪206,092.
- 4 rights / ₪3M: two → three 3-room apartments (conditional: a ₪822,939 mortgage).
- Households without a fitting route keep the same conditional direction; developer lot margin 4.1% → 3.9–4.0%.

**Test expectations changed on purpose**: legacy numeric fixtures pinned to the 2.25 simulation basis (`C_SIM`); the
solver's maximum is the end of the last feasible interval; cancellation, delivery interest and failure debt are in
today's prices; the facility list gains a refinance transfer row; the iteration-9 joint, group and contingent tests were
replaced — they asserted the defects the review found (baseline developer margin, `units + leftover = shares`, the
implicit fallback and approved-only regret).

**Benchmarks** (`tests/perf/benchmark.test.ts`, laptop, Node): group of 8 — 37–84 ms; joint search — 389 ms (2
fundings, 142 contracts), 499 ms (3 fundings, 213), 1,950 ms for a whole-lot holding (246); contingent plan 2 ms;
concession frontier 21 ms; one analysis of a whole-lot holding 134 ms. No Web Worker (DECISIONS #134).

**Limits**: searches are bounded (grid resolution, at most 5 options + the reservation per owner, single concessions);
the outside options and the developer's real hurdle are unknown, so nothing is "terms_confirmed"; pool inventory and
option terms need the developer's agreement. Professional review by an appraiser, a tax adviser and a lawyer remains a
release gate.

Commands: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `E2E_BASE=/10027-33/ npm run test:e2e`.

## V1.0 — Milestone A: baseline and scope freeze (2026-11-28)

**Acceptance**: every backlog item MH-01…15 mapped to code, test and evidence (`docs/BACKLOG-V1.md`); no new mandatory
questions; approved assumptions and the two owner-approved deviations recorded (`docs/PRODUCT-SPEC.md` §4–§5).
**Baseline**: `main` at `14f4f48`, config `2026-11-28.14`, 530 tests passing, deploy green.
**Summary**: product spec, economic contract (entity mapping, invariants, 20 cross-product fixtures with basis and
status), release criteria with proposed budgets, finite backlog. Status at baseline: resolved MH-02, MH-04, MH-12;
engine-resolved with UI work left MH-03, MH-06, MH-07, MH-11; partial MH-01, MH-05, MH-08, MH-09, MH-13, MH-15; open
MH-10, MH-14. Fixtures: 16 pass, 4 partial (bought-rights dating, F1 cash repayment, F3 engine-derived ceiling,
stale-then-print).
**Behaviour**: unchanged (documentation only). **Limits**: professional review outstanding (blocking for reliance).

## V1.0 — Milestone B: economic correctness (2026-11-28)

**Acceptance**: all P0 accounting, feasibility and snapshot tests pass; unsupported claims stay conditional.

| Item | Result | Tests |
|---|---|---|
| MH-01 snapshot v1 + events | resolved (engine) | `tests/kernel/events.test.ts` — parties, ledger completeness, liable vs payer, receipts after settlement, schema/kernel/pack versions, input hash sensitivity |
| MH-05 facilities reconcile | resolved | same file — every facility of 4 households × 3 contracts × all routes reconciles within ₪0.0001; flow totals = accounts; refinance is a transfer |
| MH-09 pack, evidence, scope | resolved | `tests/pack/pack.test.ts` — validity, stable ids, canonical statuses, no personal identifiers, refusals; offer scope by lot and date; doubled scenario price leaves the ranking unchanged |
| MH-13 cancellation split | resolved (engine) | `tests/optimizer/cancellation.test.ts` — parts add up to the payments; rights bought reported, valued at zero in the maximum |
| MH-08 snapshot binding | resolved (engine) | `tests/hooks/snapshot.test.ts` — snapshot = analysis of its key; id stable / sensitive; invalid → no snapshot; "forget" clears every app key |
| Shared fixtures F-b, F-e, F-h, F-i | pass | `tests/validation/sharedFixtures.test.ts` — ₪498,607 exact before indexation; 0.75 right bought at month 0 < approval, one ₪85,646 levy line on the owner; F1 repaid from cash, refinance 0; ceiling = 50% × collateral × 1.02⁵ |

**Before / after** (`docs/validation/before-milestone-b.md` = `after-milestone-b.md`): identical — the new 16-row
matrix (all five goals, three lots, slider extremes, unknown inputs; official and simulation bases) gives the same
decisions and figures before and after. Milestone B changed accounting structure, evidence and reporting, not
outcomes. Noted for Milestone C: the cash-soon and passive-income goals currently get the same conditional direction
as "balanced" for 167 m² / ₪300K — they need their own guidance (C3).

**Performance**: dated facility flows on demand keep the joint search at baseline (407 ms vs 399 ms for the
reference household; recording always would have cost ≈ 35%).

**Evidence changes**: canonical statuses; `analysis.valuationDate` 2026-11-28; data version 2026-11-28.15.
**Limits**: VAT liability modelled as the payer's (adviser to confirm); per-event evidence ids are snapshot-level.

## V1.0 — Milestone C: consumer experience (2026-11-28)

**Acceptance**: each of the five goals gives meaningful guidance or an explicit no-fit reason for representative
profiles — `tests/optimizer/guidance.test.ts`: 5 goals × 5 households (167 m² with 0 / ₪300K / ₪800K, 83.5 m²,
unknown inputs): a direction or the reasons, ≤ 2 alternatives of other deal families, the goal's measure; the cash goal
gets a sale-price threshold; passive income is net monthly income after debt service; the goal is never replaced.

| Item | Tests |
|---|---|
| C1 offer check | `tests/optimizer/offer.test.ts` (15): empty offer = base terms with ≥ 10 missing terms and questions; tax payers → arrangement (incl. net with ₪0 levy cap); VAT mismatch flagged; licensed area × 14,269 / 11,209 on lot 149; completion factor; schedule complete and = 100%; tax loan funding, rate, cap (draws never above it); expired / other-lot flags; invalid numbers; diff on the common date with delta = offer − base; same route on both sides; Sale Law guarantee → protected loss; option fee → options rankable |
| C3 goals | `tests/hooks/storage.test.ts` — each of the five saved goals loads unchanged |
| C4 terms to request | `tests/optimizer/negotiation.test.ts` — coverage, labelled modelled, minimum % judged on the full combination at that % (route margin, not a baseline), within the slider range |

**Before / after**: the 16-row matrix is identical to Milestone B — Milestone C adds guidance, the offer check, the
negotiation list and presentation; it does not change the ranking.
**Screens**: summary and advanced view checked at 390 px (no overflow; e2e green).
**Limits**: the offer check maps taxes onto the three arrangement templates (a per-tax VAT payer is flagged, not
modelled); completion timing in an offer is not modelled (its price is); the print report is tested in the browser
in Milestone E.
