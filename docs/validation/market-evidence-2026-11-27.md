# Market evidence and output correctness — iteration 4

Baseline: `de1e4d7`. Principle adopted: **when a price is unknown, compute the price the owner needs — never invent
the price they will receive.** All figures are estimates under stated assumptions, not an appraisal, tax assessment,
lending decision or legal opinion.

## 1. Evidence registry (`src/data/evidence.ts`)

Evidence levels: `observedTransaction`, `planningAppraisal`, `confirmedOffer`, `marketEstimate`, `scenario`,
`unknown`. The primary project source is the Noy-Levi balance-and-allocation appraisal, 23 Nov 2026 (106(ב)),
[Mavat](https://mavat.iplan.gov.il/SV4/1/3005361928/310). **The appraisal PDF was not available in this session**
(it was uploaded in an earlier conversation and the named tables are kept out of git); its figures were taken from the
independent review's transcription with page references and are marked "to verify against the document".

| Data | Source | Level | Notes |
|---|---|---|---|
| 11 parcel-33 land deals 2024-06 → 2026-04 | LandCheck; appraisal p.63 | observedTransaction | Not reconciled with Tax Authority records. Latest 16.04.2026 (₪300,000 / 167 m²), before the update. Excluded pending verification: 08.07.2025 (no reliable area); two ₪235,000 rows dated 02.08.2024 / 02.08.2026 (possible duplicate). |
| 6 neighbouring-parcel deals (32, 43, 65, 74) | LandCheck / Zips | observedTransaction | Different rights and planning; parcel-32 area differs between sources (79 / 83 m²). Not comparable per original m². |
| Apartment comparables by rooms (pp.69, 73) | appraisal | planningAppraisal | Project averages: 3-room ₪2,024,309 (79 m², n=2) / ₪2,360,282 (83 m², n=20); 4-room ₪2,331,841 (100, n=7) / ₪2,683,259 (103, n=23); 5-room ₪2,593,285 (120, n=3) / ₪2,984,968 (124, n=7). |
| 4-room individual sales (pp.69, 73) | appraisal | planningAppraisal | ₪2,256,980–₪2,680,000. |
| ₪4,100 / ₪4,800 per equivalent built-right m² (p.96) | appraisal | planningAppraisal | Value of building rights — not an apartment price. |
| Public building shell ₪8,000/m² incl. VAT (p.97); 325 m² per lot | appraisal; repository lot data | planningAppraisal | ≈ ₪2.6M per lot; now a developer-side cost at the owner's lot share. |
| BOI rate 3.25% (23.11.2026); mortgage series 11.11.2026; CBS input index 104.4 (+0.4%, Oct 2026) | official | fact | Not mortgage rates or forecasts. |

## 2. What changed in the engine

1. **Unsupported prices never decide the verdict.** Every route that depends on an unverified price is excluded from
   the ranking and reported with the price it would need: sale to a developer (₪6,900 hypothetical), sale after
   approval (₪7,100 block statistic), sale today (₪1,916 historical), revenue share (45%), cash buy-back of a fraction
   (80%), complementary purchase.
2. **No factual "vs selling today".** The ₪1,916 fallback no longer creates a "gain". A land-value reference table
   shows dated history (latest deal, median), the allocation value (₪714,371) and the allocation value less the levy
   proxy (₪457,431) — and marks the current market price and any developer offer as **unknown**.
3. **Apartment types priced from comparables, not by area.** A 3-room apartment is valued at 87.39% of a 4-room one
   (mean of 0.868 and 0.880 across the two projects), a 5-room at 111.23%. The 4-room standard stays the ₪2.5M scenario.
   At 35% / 2.25 rights the gap to a whole 3-room apartment is **≈ ₪215,950**, not the ₪31,250 of the former linear
   80 m² tier.
4. **Primary figures in today's prices.** 0% appreciation and 0% return in the comparison; the 10-year figure moved to
   an optional "תחזית כלכלית ארוכת טווח" section (2% / 4%, illustrative), itemised so every shekel reconciles.
5. **No phantom rent.** Rent is cash only when the apartment is actually rented; living in it is a non-cash benefit
   shown only in the projection.
6. **Betterment levy always visible:** total proxy (range across lots when the lot is unknown), owner / developer /
   buyer / deferred split, payment month, and the formula.
7. **Developer P&L** includes the lot's public-building obligation (lot share × 325 m² × ₪8,000).
8. **Defects fixed:** hard-coded ₪2.5M on the verdict; mixed combination display (now combination rights × rate);
   gross proceeds excluding released reserves; NPV on the actual horizon; stage peak funding gap; unknown lot flagged
   and invalid lot rejected.

## 3. Levy fixtures (independently computed in `tests/optimizer/iteration4.test.ts`)

| 167 m² | Lot 149/150 | Lot 153 |
|---|---:|---:|
| Incoming value | 200,491.91 | 200,491.91 |
| Outgoing allocation value | 714,370.80 | 714,466.50 |
| Levy proxy (50%) | 256,939.44 | 256,987.29 |
| Allocation less levy | 457,431.36 | 457,479.21 |

Payer allocation (lot 149): gross combination → owner ₪256,939; mixed / net → developer ₪256,939; S11 (35%, one
apartment) → owner ₪37,333, developer ₪219,606; sell 1.25 + build 1 → owner ₪142,744 (sold) + ₪114,195 (built);
pre-approval sale → buyer (future exposure). 83.5 m² = half, 334 m² = double.

## 4. Household matrix — before (`de1e4d7`)

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

## 5. Household matrix — after (headline: mixed deal)

| R | Cash | Repay | Goal | Decision | Status | Cash at signing | Tax reserve (owner) | Peak debt | Monthly | Dev. margin | Adverse value | S06 / S11 / S05 peak / monthly |
|---|---:|---:|---|---|---|---:|---:|---:|---:|---:|---:|---|
| 2.25 | 300,000 | 5,000 | balanced | none | — | — | — | — | — | — | — | 531,250 / 3,106 · 545,293 / 3,188 · 1,118,686 / 6,540 |
| 2.25 | 0 | 0 | balanced | none | — | — | — | — | — | — | — | 531,250 / 3,106 · 545,293 / 3,188 · 1,418,686 / 8,293 |
| 2.25 | 800,000 | 5,000 | balanced | S13-3r | estimated_feasible/questionable | 0 | 322,746 | 0 | 0 | -7.6% | 1,310,872 | 96,496 / 564 · 58,477 / 342 · 618,686 / 3,617 |
| 1.125 | 300,000 | 5,000 | balanced | S02 | estimated_feasible/questionable | 0 | 161,373 | 0 | 0 | -7.6% | 497,317 | 1,498,248 / 8,759 · 1,389,783 / 8,125 · — |
| 1.5 | 300,000 | 5,000 | maximize_apartments | S02 | estimated_feasible/questionable | 0 | 215,164 | 0 | 0 | -7.6% | 663,089 | 1,187,500 / 6,942 · 1,112,681 / 6,505 · — |
| 3 | 600,000 | 8,000 | balanced | S02 | estimated_feasible/questionable | 0 | 430,328 | 0 | 0 | -7.6% | 1,746,178 | 2,375,000 / 13,884 · 2,225,362 / 13,009 · 600,607 / 3,511 |
| 3 | 300,000 | 5,000 | balanced | none | — | — | — | — | — | — | — | 2,375,000 / 13,884 · 2,437,780 / 14,251 · 900,607 / 5,265 |
| 4 | 3,000,000 | 20,000 | maximize_apartments | S13-3r | estimated_feasible/questionable | 0 | 573,771 | 0 | 0 | -7.6% | 2,276,626 | 0 / 0 · 0 / 0 · 0 / 0 |
| 2.25 | ? | ? | balanced | none | — | — | — | — | — | — | — | 531,250 / 3,106 · 545,293 / 3,188 · 1,418,686 / 8,293 |

## 6. Decision by tax arrangement, near-misses and required prices (after)

| R | Cash / monthly | Gross · Mixed · Net | Closest evidence-based routes (extra capital) | Required prices (₪ per original m² / share) |
|---|---|---|---|---|
| 2.25 | 300,000 / 5,000 | none · none · S13-3r | S11-1 +₪13,183 · S13-3r +₪40,020 · S06-1 +₪65,245 | S05-1 ₪10,760 (affordability only — nothing to beat) |
| 2.25 | 0 / 0 | none · none · S02 | S13-3r +₪555,956 (no borrowing) | S01 ≥ ₪1,570 to cover its own taxes |
| 2.25 | 800,000 / 5,000 | S13-3r · S13-3r · S13-3r | — | S01 ₪14,839 · S01M ₪13,269 · S04 39% · S05-1 ₪15,128 |
| 1.5 | 300,000 / 5,000 | none · S02 · S13-3r (₪641,961 mortgage) | — | S01 ₪11,772 · S01M ₪10,202 |
| 3 | 300,000 / 5,000 | none · none · S02 | S02 +₪130,327 | — |
| 3 | 600,000 / 8,000 | none · S02 · S02 | — | S01 ₪14,827 · S01M ₪13,257 |
| 4 | 3,000,000 / 20,000 | S13-3r · S13-3r · S13-3r | — | S01 ₪14,546 · S01M ₪12,976 · S04 38% |

Reading: for the representative household (167 m², ₪300K, ₪5K) no evidence-based route fits under a gross or mixed
deal, because the owner's capital-gains tax at approval exceeds the cash. Under a net deal: combination plus a whole
3-room apartment. The mixed construction-services deal (S11) is only ≈ ₪13K short. To prefer selling, a sale would
need roughly ₪13–15K per original m² for households with an evidence-based alternative — far above the dated parcel
history (₪1,018–₪2,395) and the allocation value (≈ ₪4,278).

## 7. The ₪4,182,622 figure

It came from the old "שווי מימוש נטו בעוד 10 שנים" metric: apartments at 2%/year appreciation + accumulated cash at
4% (including imputed rent) − debt − mortgage payments − deferred / unfunded − starting capital grown. The exact
profile was not provided, so it was **not reproduced** here. That figure is no longer shown on the verdict; the optional
projection itemises each component and a test asserts that the components sum to the total.

## 8. Still to verify (professional review)

Appraisal figures against the PDF; transaction records against Tax Authority data; the levy proxy against a formal
assessment; apartment types and inventory; developer offers; tax arrangement and timing; lending.
