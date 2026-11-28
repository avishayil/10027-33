# Decisions

1. **Inverse simulator.** Besides forward evaluation, the engine solves for the terms that would make a blocked strategy fit.
2. **Separate land prices.** Immediate sale (null — no current valuation), historical reference, and developer scenario (₪6,900, unconfirmed) are distinct values.
3. **2.25 is a simulation unit**, kept separate from the official table (~2.4 units per 167 m²).
4. **Contingency vs overrun** use `max()`, never sum.
5. **Whole retained apartments earn net rent (or rent saved)** in the wealth comparison, so selling and keeping compare fairly; fractional shares earn nothing (iteration 2). S08 differs only in that rent counts toward repayment capacity; when its build-and-hold twin is eligible the duplicate is hidden from ranking.
6. ~~Combination capital-gains tax is paid by the owner at signing~~ — superseded by #29 (net deal).
7. **Developer purchases are assumed post-approval** (seller pays the levy). Open-market sales now are pre-approval (levy priced in for the buyer).
8. **Unknown inputs never become zero silently**: unknown capital → “חסר מידע”, unknown repayment → conditional. Reverse targets treat unknowns as zero and say so.
9. ~~Whole-unit targets make a strategy conditional~~ — superseded in iteration 2 by the three-part assessment: commercial dependencies affect *commercial certainty*, not affordability.
10. **No Web Worker** — analysis is fast enough.
11. **CSP only in production builds** — Vite dev needs inline scripts and a websocket.
12. **Finding:** under the base assumptions, ₪6,900/m² for surplus rights is below what the land yields in a 35% combination, so hybrid “sell surplus + build” strategies rank below combination unless the developer pays substantially more (the app computes the minimum price per user).

## Iteration 2 (review of 925bdcf)

13. **₪202K was a reporting error.** It came from the e2e test inputs (₪350K, ₪6K/month, 40%). The moderate
    fixture needs ₪515,041 (₪3,011/month); a golden fixture now reconciles every line from first principles.
14. **Taxes, levy and transaction costs are never financed.** They create unfunded obligations, which are infeasible.
15. **Financing is staged** (bridge / construction / mortgage) with stage-specific collateral; sold rights excluded.
16. **Fractional entitlements are unresolved assets** (no rent, 20% illiquidity discount) unless a settlement is modelled.
17. **S11 added** with the analytical split. In the base case it is within ~3% of paid completion (S06); S06 still
    edges it because completion is priced at today’s value with no contingency or indexation, while construction
    carries both. That is sensitive to how the completion price is actually set.
18. **Developer economics is informational.** Under the user’s own assumptions (₪11,000/m² direct, ₪25,000/m²
    value) a 35% combination leaves the developer ≈ −3%, consistent with a cash price of ≈ ₪11,760/m²; ₪6,900
    leaves ≈ 16%. Either the assumed costs overstate a developer’s costs, or ₪6,900 understates the land. Real 35%
    offers existed, so the engine flags “מוטל בספק” instead of excluding combination strategies.
19. **Waiting is valued independently** of the developer price (post-approval market reference ₪7,100/m²).
20. **Stable normalisation** with fixed reference scales; explicit goal constraints.
21. **Follow-up questions are sensitivity-driven**: asked only if plausible answers change the recommendation
    (capital is always asked when missing).
22. New assumptions (all documented as planning assumptions): approval in 2 years, post-approval land value,
    20% fraction discount, 80% fraction cash settlement, developer soft costs 12%, target margin 15%,
    revenue-share tax at signing.

## UX iteration

23. **Onboarding wizard** so every user sees the key assumptions (2.25 rights, ₪25,000/m², ₪11,000/m², ₪6,900
    unverified, levy 50%, 5% interest, plan not yet approved) and explicitly acknowledges them before the first result.
24. **Answers are saved locally after explicit consent** (checked by default on the summary screen, clearly
    worded, with a one-click delete). This replaces the earlier “memory-only” default at the owner’s request.
25. **Free capital is a required answer** in the wizard (0 is allowed): the engine never assumes the user has money.
26. **Review findings fixed:** results no longer below 1,700 px of form on phones; money inputs formatted with
    separators and ₪; headline numbers compact; rights kept/transferred split into two rows; jargon (“שווי נטו
    שנוצר”) renamed to “רווח כלכלי משוער” with an explanation; follow-up questions link to the relevant step;
    comparison table becomes stacked cards on phones; 44 px touch targets, visible focus, skip link, focus moved to
    each wizard step heading, labelled inputs and `aria-invalid` / `role="alert"` errors.

## Developer policy for construction services

27. **Lot-level policy** (owner’s domain input): ~100 units per lot; the developer releases 20–30% for construction
    services, one apartment per owner, none for owners whose full combination already gives a whole apartment
    (≈ 3 rights). Out-of-policy strategies are shown as “לא צפוי שיוצע” and excluded from ranking. All three
    parameters are configurable planning assumptions (`developerPolicy`).
28. ~~Open point: who pays the combination tax~~ — resolved by research, see #29.

## Who pays the capital-gains tax in a combination (researched 2026-11-27)

29. ~~Base case: a "net" combination~~ — superseded by #30 (iteration 3). By law the landowner owes the capital-gains tax on the share sold
    (and the levy, and VAT on the services), assessed around signing. In practice many combination deals are
    "net": the developer undertakes in the contract to pay the owner’s capital-gains tax — grossed up, since the
    payment is itself consideration — and often the levy too; some deals split them. The engine therefore:
    * charges the grossed-up tax `T = t / (1 − 25%)` to the developer in combination legs (≈ ₪340,725 for 167 m² at 35%);
    * adds `T` to the developer-side P&L (35% combination margin ≈ −14%; consistent cash price ≈ ₪13,680/m²;
      max combination at a 15% margin ≈ 19%);
    * adds a commercial condition: confirm the net term **with security** in the contract — the legal liability
      stays with the owner; otherwise an administrative deferral under section 91א may be requested (discretionary,
      with interest and indexation, typically up to ~3 years);
    * keeps owner-paid taxes for sales, revenue sharing, fraction cash settlement and completion purchases;
    * keeps the owner-pays path available (`combinationTaxBorneByDeveloper: false`) with its own golden fixture
      (₪515,041 / ₪3,011 for the moderate household). The net-deal fixture: no construction-stage debt, a
      ₪235,276 mortgage at completion.
    Effect on the owner’s examples: 3 rights → full combination for every household tested; 4 rights → full
    combination or combination + paid completion; 1–2.86 rights → depends on finances and goal.

## Iteration 3 (review of 1a0d80e)

30. **No global tax-arrangement default.** Gross, mixed and net are evaluated for every household; the headline uses
    *mixed* (developer pays the levy — reported as common), and the result states the decision under each
    arrangement plus a fallback. Rationale: no reliable evidence that net deals dominate.
31. **Contractor profit is part of the taxable services value** (instruction 23/98; entrepreneurial profit excluded
    per EA 6672/19). Separate parameter from the markup slider and from project profitability.
32. **Pre-approval combination taxed at approval** (§19(3א), position 06/26) — modelled as a condition; the signing
    date remains available as a configuration and in the legacy fixtures.
33. **Developer purchases are conditional on approval**; payment/levy/tax at approval (removes the month-6 vs
    month-24 contradiction).
34. **Unfunded ≠ debt.** Taxes the household cannot pay are reported as unfunded, never turned into a loan.
35. **Contingency = liquidity reserve**, released at completion; consumed only by an actual overrun.
36. **Per-candidate developer P&L** replaces the per-family margin; commercial risk (ordinal 1 / 0.6 / 0.2 / 0) is a
    10% ranking dimension; a questionable winner always comes with a fallback.
37. **Policy reference rate**: service-slot eligibility uses the project reference combination (35%), not the slider;
    out-of-policy routes are "negotiable" (listed, not ranked) unless the policy is confirmed; integer capacity.
38. **Apartment value tiers and balancing pool** are illustrative scenarios, not inventory or project terms.
39. **Local saving is opt-in, unchecked by default** (review requirement), with migration of older saves.
40. **Verdict changes** (see VALIDATION-REPORT §4–5): the representative household moves from
    "combination + paid completion" to "wait for approval and sell" under the mixed headline, and to
    "combination + compact 80 m² apartment, no mortgage" if a net deal is obtained.

## Tables version

41. **Only the updated 106(b) tables (23/11/2026) are used.** The deposited version (lot 44) was removed from the data,
    the advanced calculator and all texts. Areas in m² (167, 334 …) are only a familiar way to describe a share of the
    original parcel; every calculation and consideration follows the updated tables (lots 149/150/153).

## Iteration 4 — evidence first (review of de1e4d7)

42. **Unknown prices are never invented.** Routes that depend on an unverified price or term (developer purchase,
    post-approval sale, sale today, revenue share, cash buy-back, complementary purchase) are excluded from the ranking
    and reported with the price they would need. If nothing evidence-based fits, the verdict says so and shows the
    closest routes with the extra capital they need, the decision under each tax arrangement, and the price thresholds.
43. **Apartment types are priced from the appraisal's comparables by room count**, relative to the 4-room ₪2.5M
    scenario (3-room 87.39%, 5-room 111.23%); the linear area tiers (80/90/110 m²) were removed.
44. **Primary comparison in today's prices** (0% appreciation, 0% return); the 10-year view is optional and itemised.
45. **Rent is cash only when rented**; owner-occupation is a non-cash benefit.
46. **Betterment levy is a headline figure** with payer split, timing and formula; unknown lot → range.
47. **Developer P&L includes the lot's public-building obligation** (appraisal ₪8,000/m² × 325 m² × lot share).
48. The appraisal PDF was not available in the session; its figures come from the review's transcription and are
    flagged for verification.

## Reported scenario — no free cash, monthly capacity, another property (2026-11-27)

49. **Taxes can be financed by a loan secured on another property** the household owns (answer "לא, יש לנו דירה
    נוספת") when borrowing was not ruled out. Construction finance still never funds taxes; this is a separate,
    conditional loan (bank approval, value of the existing home) shown as a condition. Without another property,
    taxes the cash cannot cover remain unfunded.
50. **The verdict always gives a direction.** If nothing fits under the headline (mixed) terms but a route fits under
    other terms, it is shown as a conditional recommendation: "X — on condition the developer bears the taxes", with
    the near-misses as the fallback.
51. **Selling the fractional share (pool / buy-back / smaller-apartment excess) is a disposal of retained property**:
    capital gains are on the proceeds minus its basis (the services value already taxed when received + the retained
    land basis), not on the gross amount.
52. **A tax loan secured on another property does not count against the project's LTV.** Project LTV uses only the
    debt secured on the project; repayments are attributed to the secured tax loan first (conservative for the
    project). In the reported scenario this makes "combination + whole 3-room apartment" (₪651K total loans,
    ₪3,806/month) the recommendation for the balanced goal.
53. **The wizard offers three goals and preset amounts.** Goals: "הכי משתלם, בסיכון סביר" (balanced), "לסיים עם דירה
    שלמה" (maximize_apartments — under the one-apartment-per-owner policy "most apartments" means one whole
    apartment; rent follows from keeping it), "בלי חובות ובלי סיכון" (minimize_risk — favours combination or a sale,
    which also covers "cash soon"). The engine keeps the two retired goals; saved answers migrate passive_income →
    maximize_apartments and immediate_cash → minimize_risk. Presets come from an engine sweep at 167 m²: free cash
    ₪0 / ₪250K / ₪500K (₪0 → combination only; ₪250K → whole 3-room apartment with ~₪306K loan; ₪500K → small
    or no loan) and monthly ₪2,500 / ₪4,000 / ₪6,000 (₪2,500 is below the ~₪3,250 a whole apartment needs with no
    cash; ₪4,000 covers it; ₪6,000 leaves headroom or suits 334 m²). Extended on request with ₪750K / ₪1M and
    ₪8,000 / ₪10,000 for larger holdings and households. Free entry remains.
54. **Simple view by default: three ranked priorities.** The result screen shows first, second and third priority
    (recommendation or conditional recommendation, then alternatives, fallback and near-misses — distinct route
    types), each with whole apartments, own cash and mortgage. Everything else (full verdict, levy, taxes,
    arrangements, comparisons, financing, scenarios, developer, assumptions, the manual calculator) appears only when
    "תצוגה מתקדמת" is switched on; that display preference is remembered in the browser. The wizard asks for square
    metres only (with 167 / 334 / 500 presets); answers saved as a registry fraction are converted to m² on load.
55. **Purchase tax on a completion payment stays — and only there.** Checked on request. The owner pays no purchase
    tax on apartments received as combination consideration, and none on construction services paid for land the
    owner keeps (services are not a right in land). A completion payment (S06/S13, tier upgrades) buys from the
    developer a share of an apartment beyond the owner's consideration — a new acquisition of a right in land, so
    purchase tax applies to that price; tax paid when the land was originally bought covered the land bought then,
    not this. Rates: 0% for a sole home within the exemption band, ~8% for an additional home, 8% while unknown. The
    same extra apartment structured as construction services on more retained land (sell less to the developer)
    carries no purchase tax — that is the mixed combination + services route. Label and source note clarified.
56. **"Sole home" applies to at most one apartment.** A completion that finishes a second apartment (the plan already
    has another whole apartment) is taxed at the additional-home rate (~8%) even when the household answered that
    the apartment will be its only home. Found while comparing two-apartment routes at 334 m²: with the sole-home
    answer the second apartment had been charged 0%.
57. **The summary shows one deal of each kind, without assumed apartment sizes.** Up to four priorities, at most one
    per family: combination (S02/S02C/S02P/S06), revenue share — עסקת תמורות (S04), cash (S01/S09/S01M) and
    construction services (S03/S05/S07/S08/S10/S11). Hybrids count once, in the family of their distinctive part
    (S06 → combination; S05/S11 → services). S13 (a whole apartment of a requested size) never appears in the
    summary; it stays in the advanced view. Per family the best option is chosen by: fits (rank order) → depends on
    an unverified price but affordable (with the price it needs) → short of capital (smallest gap; `capitalGaps`
    gives the gap for every evidence-based route type) → depends on a price and unaffordable → does not fit. With the
    "whole apartment" goal, non-fitting routes that leave no apartment come after those that would.
58. **The summary speaks in risk levels and plain explanations.** Each card shows affordability and one risk level —
    סיכון נמוך / בינוני / גבוה — from: mortgage needed (+1), fails the conservative scenario (+2), developer terms in
    doubt (+1); 0 low, 1–2 medium, 3+ high, with the reasons listed. An unknown price is stated in the card's note,
    not scored. The description is two or three lines with the owner's own numbers (rights sold, apartments from
    combination, what is paid for), plus one line on what the out-of-pocket money pays for. Developer-policy notes
    say why in one sentence. In the advanced view the resilience chip reads "עומד / נכשל בתרחיש שמרני".
59. **Summary families follow what the owner decides, not the contract mechanics.** Four cards: "קומבינציה + תשלום
    ליזם" (any route that ends with whole apartments by paying the developer — completion at market price S06,
    construction services on land kept out of the combination S11, or selling part and paying for building
    S03/S05/S07/S08/S10), "קומבינציה בלבד, בלי תשלום" (S02/S02C/S02P), cash (S01/S09/S01M) and revenue share (S04).
    The ways to pay for the same apartments are shown on one card: the best as the main route, and up to two other
    payment methods with their mortgage, risk level and how much more or less they leave at the end (omitted when
    the comparison rests on an unverified price). Replaces the split in #57, which showed completion and construction
    services as two different deals when, for a small holding, both are "combination + a payment to the developer".

## Who really pays the taxes — gross / mixed / net, VAT and a tax loan (2026-11-27)

Prompted by the owner's research (TASE filings: Rothstein 2022 — 40%/43%/47% with the owners paying levy, capital
gains and VAT, plus a tax loan at prime + 2%; Karden 2009 — 19% with the developer paying the levy). The central
point: a developer that takes on the owner's taxes prices them into a lower combination %, so the legal liability
(owner), the contractual payer and the economic burden must not be confused.

60. **VAT on the construction services received in a combination has a payer.** Gross and mixed: the owner (a private
    owner cannot reclaim it) — ~₪183K for 167 m² at 35%, at the permit; net: the developer. Previously no one paid
    it on the owner side and the developer P&L always absorbed it. When the owner pays the VAT, the capital-gains
    consideration is the services value ex VAT (the owner is not taxed on VAT it paid itself — to be confirmed by a
    tax adviser), and the developer's barter-VAT cost is zero (collected and remitted). One payer table
    (`domain/arrangements.ts`) drives levy, capital-gains tax and VAT. Legacy/golden fixtures keep the old rule
    (`servicesVatOnOwner: false`).
61. **Arrangements are compared at their developer-equivalent %, never at the same %.** The % that leaves the
    developer the same profit (`optimizer/arrangementEquivalence.ts`): at 35% mixed ≈ 25.7% net ≈ 40.5% gross. The
    owner's break-even (apartments today minus owner-paid taxes carried to delivery at the tax-loan rate) is shown
    next to it: ≈ 25.0% net, ≈ 40.9% gross. A "fits on condition the developer bears the taxes" direction now states
    the lower % it assumes. Result under base terms: taking on the taxes costs the developer about what it saves the
    owner; with financing counted, a net deal at the expected % is roughly neutral to slightly better for the owner.
    The equivalents agree with the reported 40%–47% gross deals.
62. **Paying ≠ lending: a developer/bank tax loan.** Combination taxes the household cannot pay in cash (owner
    capital-gains tax, levy in gross, services VAT) may be covered by a tax loan at prime + 2% (6.75%; prime 4.75%
    per the Bank of Israel decision of 23.11.2026 — secondary sources, the BoI site blocked automated access).
    Interest is capitalised to delivery (no payments before it), then the balance is repaid from cash or refinanced
    as a mortgage on the delivered apartment, with the usual repayment and LTV checks. A loan secured on another
    property (#49, 5%) is used first. Not offered when the household ruled out borrowing. Condition `TAX_LOAN`.
    **Deviation from the plan:** the loan is tested against the delivered apartment, not the pre-delivery land
    (₪6,900/m² understates the entitlement a lender underwrites; counting it there failed every case at ~139% LTV).
    Effect: the ₪300K / ₪5K household (2.25 rights) moves from "nothing fits" to combination + pool sale with a ₪195K
    tax loan repaid at delivery; 3 rights / ₪300K to full combination with a ₪384K loan (₪2,243/month).
63. **The offer states what it includes.** Next to the % slider: "מה היזם משלם באחוז הזה?" — nothing (gross) / the levy
    (mixed, default) / everything (net). It sets the headline arrangement, so an offer entered as net is never taxed
    again; a hint shows the equivalent % in the other arrangements. The slider range widens from 30–40% to 25–45%
    so net and gross offers can be entered. Saved answers without it load as mixed.
64. **Kept simple on purpose (non-goals).** No per-tax payer/date/cap/provenance model, no levy cap or hybrid split
    input (Holon's ₪7.5M cap is documented only), no change to the today's-prices primary comparison (#44), no
    project-specific deal % or levy entered as fact. The reported deals are shown as evidence, never as inputs.
65. **Build version in the footer**: the short commit id (`GITHUB_SHA` in CI, `git rev-parse` locally), injected at
    build time.

## Iteration 6 — review of c482315 (2026-11-27)

66. **Tax-loan cost and exposure.** The delivery value deducts the capitalised tax-loan interest (it was omitted); the
    balance due at delivery and peak exposure are measured before same-month repayment (₪160,155 → ₪195,992 at 6.75%,
    ₪203,223 at 7.965%).
67. **Developer barter VAT = the ledger's services VAT** (services incl. contractor profit), not direct cost × VAT.
68. **Fallbacks keep their own terms.** The gross fallback is the gross run's result, labelled with its arrangement and
    equivalent %; never a same-id result from the headline run.
69. **Thresholds have a direction.** Prices you receive: the lowest acceptable; prices you pay (complementary rights,
    own knob): the highest affordable. Revenue share follows the arrangement's capital-gains payer.
70. **No unverified price in collateral.** Pre-delivery collateral uses the appraisal allocation value per right; a
    property test checks that the hypothetical developer price changes no evidence-based result.
71. **Funding is conditional, not assumed** (amends #49, #62). The headline assumes no tax financing. A developer/bank tax
    loan (prime + 2% + VAT on interest = 7.965%, capped at 50% of the apartment entitlement) is evaluated automatically,
    with its interest, balance at delivery, the saving if the developer bears the interest, and the highest rate that
    still fits. A loan on another property is assumed only up to a limit the household states. When nothing fits, the
    direction is financing under the offer's own terms first, then other tax terms. New conditions: refinancing at
    delivery needs a mortgage commitment; repayment from the pool / buy-back sale. §91א: subject to approval, with
    interest and indexation.
72. **Per-tax contract terms** behind the gross / mixed / net templates: developer share and cap per tax; the
    developer's share of capital-gains tax is grossed up (x = s·t₀ / (1 − s·r)). An actual offer can cap the levy
    contribution (Rothstein Holon) and put the tax-loan interest on the developer (optional advanced inputs).
73. **Explicit milestone timeline**: approval → permit → construction → delivery; the permit never precedes approval
    (favourable previously had it at month 14 against approval at 24). Base unchanged (24 / 24 / 60). Adverse: approval
    36, permit 48, delivery 96, tax-loan rate +2%, pool sale a year after delivery. Owner money paid before approval is
    reported as at risk if the plan is not approved and raises the risk level.
74. **Ranking on delivery economics** (amends #44): position at delivery (today's prices, after financing to delivery)
    minus interest after delivery within the horizon. Resilience, reverse benchmarks and best-route picks use the same
    value; the 10-year wealth stays in the optional projection.
75. **Lot-level developer P&L**, monthly: services quota (25%), owners' combination units, developer units (15%
    presales, rest at delivery), direct + soft costs, the lot's public buildings, developer-borne taxes on their dates,
    20% equity then an escort loan at prime + 1.5%. It drives the equivalent % (renamed "אחוז שקול לפי המודל הכלכלי" —
    same modelled developer result, not "what the developer will offer"), a new viable % at the 15% target margin
    (≈ 16% mixed / 23% gross / 11% net under the base costs — the tension of #18), the developer panel, and commercial
    certainty (a route's margin is the lot with this owner on that route).
76. **A smaller whole apartment on the summary card** (amends #57): S13 joins the combination + payment card, always
    marked "תלוי במלאי הדירות ובהקצאה". A "מה כדאי לבקש מהיזם?" card appears when the direction depends on terms.
77. **Slider stays 25–45%** (owner decision, against the review's suggestion to restore 30–40%).
78. **Evidence provenance**: each transaction row names its own source; the appraisal p.63 lists only the 2024
    parcel-33 deals (checked against the local PDF). Further Rothstein variants recorded (₪46M advance with JV-borne
    interest; ₪27M owner tax loans at prime + 1.9%).
79. **CI** on current action majors (checkout v7, setup-node v7, upload-pages-artifact v5, deploy-pages v5) — removes
    the Node 20 deprecation warnings.

## Iteration 7 — review of c32bb73 (2026-11-27)

80. **Developer cash is conserved.** The lot model carries a cash balance month to month; receipts fund later costs
    before equity or the escort loan (financing at 35% mixed ₪5.69M → ₪4.52M). Invariant tested: ending cash − equity
    = Σ flows − financing.
81. **The lot does not depend on one user.** It is built from a typical 167 m² holding (unknown basis, template
    terms), scaled by ownership shares (2353/100000 per holding in lot 149). Physical units drive revenue and
    construction, ownership shares drive taxes, simulation rights only translate the user's route. A personal levy
    cap or basis changes only the user's own delta.
82. **A route is a delta with its own financing**: the typical slice for the user's share is replaced by the route and
    the financing is recomputed. Purchased rights replace the seller's slice — no new apartments. The selected markup
    reaches the services fees; services participation = expected demand capped at the quota (sensitivity 0/50/100%).
83. **Developer-borne tax-loan interest is a developer cost** (simple interest as it accrues); the owner's saving stays
    the avoided capitalised interest.
84. **Developer thresholds, not new defaults**: the 2-D matrix (developer direct cost ₪8–11K × apartment ₪23–32K →
    viable %), and at the offer's % the highest developer cost (≈ ₪8,870/m²) and lowest apartment price (≈ ₪32,106/m²)
    for a 15% margin on revenue (= 17.6% on cost). The ₪11,000/m² owners' construction price is unchanged; the
    developer's own direct cost is a separate quantity. Project total over the three lots (−4.0% at 35% mixed).
85. **Ranking on present value** (owner decision: 3% real; amends #74): every owner flow at its month and the apartments
    at delivery, discounted to signing, less the present value of all interest. The position at delivery counts only
    what happened by delivery; later receipts / payments are receivables / payables.
86. **Owner break-even** carries taxes paid from the household's cash at the discount rate, the borrowed part at the
    tax-loan rate.
87. **Mortgage limits by status** (owner decision; Bank of Israel directive 329): a delivered sole home 75%, an
    additional home 50%, unknown status 50% until answered; two apartments value-weighted.
88. **Apartment mixes**: for an entitlement of at least one standard apartment, mixes of 3/4/5-room apartments within one
    standard apartment of its value are candidates (e.g. two 3-room apartments), the gap paid or received. Inventory is
    not established.
89. **No approval**: conditional contracts lapse, no apartments, the land stays with the owner; the possible loss is the
    advances paid before approval plus interest to then (bought rights credited at the incoming value). Drives the risk
    level; shown with the questions to ask (guarantees, conditions precedent, approval deadline, liens, trust).
90. **Consistent hints**: the 3-room hint uses the same funding run as the direction; for the no-risk / cash goal a sale
    is named as a possible direction with the price to ask for, measured against the conditional direction.

## Iteration 8 — review of cffb86d: calibration and release validation (2026-11-27)

91. **Evidence-based developer budget** (owner decision). The developer model prices the plan's built areas per lot
    (provisions Table 5, appraisal pp.30–32: lot 149 14,269 m² above ground, 4,770 m² underground, 1,530 m² balconies,
    20 floors / 72 m; lots 150 and 153 likewise) at the June 2026 appraisers' construction-cost survey (Sharon,
    "רב קומות" ₪6,600, underground ₪3,400 per licensed m², balconies 40% within 30–50%). Lot 149: ₪114.4M direct
    ≈ ₪10,209 per saleable m² — about the old ₪11,000 × 100 m² per unit, so the construction-cost definition was *not*
    the cause of the negative margin. Soft costs stay 12%; the survey's ±10% and the appraisal's 27% indirect rate
    (public-building shells) are sensitivities. The owners' ₪11,000/m² services price is unchanged.
92. **Revenue on saleable area.** The lot's door-to-door residential area (11,209 m², 110 m² a unit) is sold, not
    100 m² × units; that understatement was the real source of the gap. Result at 35% mixed: developer margin ≈ +4.2%,
    viable ≈ 24.7% (gross 30.8%, net 17.5%); for a 15% margin the direct cost would need to fall to ≈ ₪8,979 per
    saleable m², or apartments sell at ≈ ₪29,105/m². The appraisal's comparables (₪19,000–24,000/m² nearby) are below
    the ₪25,000 scenario — worth knowing before negotiating at 35%.
93. **Physical inventory vs value.** The lot's unit mix is fixed, so the developer gives up the market value of what it
    delivers (value-equivalents); the physical apartments a user receives are counted separately. A user on
    construction services takes quota slots from typical participants, never beyond the quota.
94. **Value to you** (owner decision; amends #85): the ranking is an equity NPV — the transaction value plus loan
    proceeds, debt service (interest and principal) and the debt left at the horizon; nominal flows (indexed
    construction, loans) deflated by 2% inflation, discounted at 3% real. The transaction value (before personal
    financing) is reported alongside; the old horizon-based netPresentValue is removed.
95. **Facilities kept apart**: project loan (construction → mortgage), the loan on another property ("any purpose": own
    rate and term, amortising from the draw) and the tax loan (bullet at delivery). Refinancing a tax loan on the
    delivered apartment is capped at the any-purpose 50%. Replacement home: 70% (new optional answer).
96. **Bounded mix search**: one apartment fewer to one more than the entitlement, incl. a single non-standard apartment;
    the closest six per count. **S14**: renting out the apartments of a combination route — rent supports repayment,
    not value; not shown as a payment method.
97. **Cancellation scenarios**: protected / partially protected / unprotected (the maximum modelled exposure); bought
    rights are not credited at an unestablished value. A tax loan due before its repayment source (a delayed pool sale)
    with no whole apartment to refinance on is an explicit gap (extension or guarantee needed).
98. **Sale target and negotiation range** worded as calculated targets, with what they are measured against.
99. **Release validation matrix**: the review's twelve scenarios plus a property test across lots, households, goals,
    slider ranges and arrangements (`tests/validation/release.test.ts`).
100. **Consideration reconciled, owner decision (a).** The owner keeps 2.25 rights per 167 m² and 100 m² apartments; the
     developer gives up the official share (≈ 117.22 m² per simulation right on lot 149). The difference (₪339,043 at 35%
     full combination) is an explicit line, never folded into either side; every route satisfies owner value + not
     credited = developer forgone value.
101. **Construction-services quota in whole slots on both sides** (⌊25% × 102⌋ = 25). A partial apartment takes a slot; a
     full quota displaces one typical participant into combination. Developer margin at 35% mixed moves 4.2% → 4.1%.
102. **Tax-loan maturity: cash, then a capped refinance facility, then a reported gap.** Replaces the automatic
     conversion into a mortgage and the "extension needed whenever the pool sale is later" rule: a cash-covered maturity
     passes; an uncovered remainder fails.
103. **One money basis.** Today's-price amounts become nominal shekels on their date in the cash-flow simulation (2%
     inflation); valuation deflates once. Completion mortgages are therefore shown in the shekels of delivery (e.g.
     ₪531,250 today ≈ ₪569,628 then). No price growth is added in the base case.
104. **Levy on rights bought before approval is the buyer's by default** (range down to zero if the contract puts it on
     the seller); charged once per right held at approval.
105. **No hypothetical price in the ranking scale**: the appraisal allocation value replaces the ₪6,900 scenario.
106. **The old calculator is labelled outdated** (tab "מחשבון ישן (להשוואה)") instead of being an equal view.
107. **CI** runs the browser privacy test on a production build and runs all checks on pull requests; deployment only on
     `main`. Pinning actions to commit SHAs is left open (the SHAs could not be verified from this environment).
     **Kept (owner)**: the any-purpose loan stays at the 50% base — the BOI "min(70%, 50% + ₪200K)" upper bound is not
     modelled.
108. **Developer stresses, joint and single** (phase C): cost +10%, apartment price −10%, saleable area −10%, approval
     delayed 12 months, escort rate +2%, public buildings inside the plan areas, and all adverse ones combined. Each
     row: margin, profit on cost, equity IRR, peak loan. Calculated sensitivities, not forecasts.
109. **Developer returns beyond margin**: profit on cost, peak equity, peak loan and an indicative equity IRR (from the
     monthly equity flows of the escort-loan model). IRR is computed only where shown (it is a solver; in every lot
     P&L it made an analysis ~21× slower).
110. **Unknown costs as headroom, not invented values**: development levies, infrastructure and fees beyond the 12% soft
     costs are not in the budget; the panel shows how much per saleable m² the lot can absorb before the target margin
     and before a loss. The 12% soft costs are described without financing (financing is modelled separately).
111. **Area basis and public buildings stay unverified and visible**: not established that 11,209 m² uses the same area
     definition as the ₪/m² sales evidence, nor that the 325 m² public buildings are outside the 14,269 m² above-ground
     area — both are stress rows. Public shell cost stays VAT-inclusive (₪8,000/m², appraisal p.97): input VAT recovery
     on buildings handed to the municipality is not established.
112. **Evidence labels**: the immediate-sale range is reported transactions only (₪1,647–2,395/m², seven deals
     10/2024–04/2026, median ₪1,916); the appraisal's allocation value (≈ ₪2,739) is no longer mixed into it nor used as
     the favourable sale scenario. The block-wide post-approval value is labelled an assumption (its source is a
     reported statistic; its use for parcel 33 is not).
113. **Apartment-mix search keeps the extremes** (phase D): per apartment count, the cheapest mix (most balancing money
     back), the most valuable one and the most valuable mix needing no payment are always evaluated, then the closest to
     the entitlement, up to seven; counts up to two above the whole entitlement. Replaces "the closest six".
114. **Rent**: a lender counts 80% of net rent toward repayment capacity (assumption, range 50–100%, to verify with the
     bank); rent starts at delivery in the base case and three months later in the adverse scenario (a 3-month base delay
     flipped the reported no-cash household's whole-apartment route on a ₪133/month excess — an assumption should not
     decide that). Rental variants are kept when the goal is rental income. A fraction earns no rent.
115. **Contract states**: besides "plan not approved", every route shows "developer fails half-way through construction"
     (paid to the developer for building/completion, interest, debt left; protected = interest only, unprotected =
     payments + interest), and the routes shown add "approval two years late" (still fits?, value change, extra
     interest). States, not probabilities; land and what was built stay the owner's at unknown value.
116. **Domain validation**: the engine refuses areas that are zero, negative, non-finite, larger than the parcel
     (21,258 m²) or than one lot (167 ÷ lot share, e.g. ≈ 7,097 m² on lot 149 — multi-lot holdings are not supported),
     unknown lots, negative money and percentages outside 0–100%. Unknown (null) stays distinct from zero. A saved
     unknown lot is dropped; a saved fraction converts to m² without rounding; a retired goal is mapped and said once.
117. **Responsiveness**: measured at a 4× CPU slowdown (a mid-range phone): one analysis ≈ 300 ms. Analysis now runs 250 ms
     after inputs settle, on a deferred render, with the previous result dimmed — a slider step paints in ≈ 40 ms
     (was ≈ 300 ms). A Web Worker is not needed at this size.
118. **The old four-track calculator is gone from the app.** The advanced view shows any route's full ledger (all payers)
     and the holding in the official allocation table. The old math stays as `simulationMath.test.js` regression fixture.
119. **Bilateral contract search, first version** (phase E, `src/optimizer/joint/search.ts`). A contract is
     (combination %, tax arrangement) on a 2-point grid over the slider range × gross/mixed/net; markup and offer terms
     stay as entered. Owner accepts: an evidence-based route this household can fund (no price-dependent legs, within the
     developer policy, no assumed apartment sizes; for the whole-apartment goal, ending with a whole apartment); value =
     the route's equity NPV. Developer accepts: lot margin ≥ the target (15%, an assumption) — equal profit below the
     target is not viable. Output: ranges per side and their overlap (read from the grid, no monotonicity assumed), the
     non-dominated feasible contracts, or a gap certificate per arrangement — the owner's lowest %, the developer's
     highest % (exact, may lie below the slider), and single levers: the margin the developer would have to accept, the
     direct-cost ceiling or apartment-price floor that restores its target, and the extra own capital the owner needs at
     the developer's maximum. On demand in the advanced view (≈ 20–60 ms on a laptop). Each lever is computed alone;
     joint levers and more contract variables (completion price, payment dates, loan terms) are the next step.
120. **Group planner, first version** (phase F, `src/optimizer/group/collective.ts`). Up to eight anonymous owners typed
     in the advanced view (m², free cash, monthly, goal) — never inferred from the allocation table, never saved or sent.
     Each owner's options: their own ranked routes (no assumed sizes, no duplicate rental variants), or their conditional
     direction when nothing fits on base terms (marked with its condition). Shared resources: construction-services
     slots available to the group (an input) and balancing pools (shares must reach one apartment; any remainder is
     reported). No owner is placed below their own baseline (best option needing no shared resource). Among such plans:
     most first choices, then most total value; the uncoordinated choices are shown with their clashes. Bounded search.
     Rights transfers between owners are not proposed (price unknown); any arrangement needs a sharing agreement.
121. **Contract with an option, first version** (phase F, `src/optimizer/contingent.ts`). States: plan not approved
     (maximum exposure), approved with financing, approved without any financing (no mortgage, other-property loan or tax
     loan). Fixed routes fall back to the full combination where they cannot be carried out; "combination now, switch to
     X after approval if financed" takes X's value when financed and the combination's otherwise. Regret per state =
     best available − this choice; rows ordered by largest regret. No probabilities; the option's price and the
     developer's agreement are not assumed.

## Iteration 10 — review of c689d0b: one executable contract for both sides (2026-11-28)

Review brief: `iteration-9-comprehensive-review.md` (§A–§H, acceptance J1–J5, G1–G6, C1–C4, F1–F7, UX1, PRIV1).
Owner decisions this iteration: the entitlement is the official allocation share; deliver straight to `main`.

122. **Owner entitlement = the official allocation share** (owner decision; amends the 2.25/167 basis). Apartment
     equivalents = the holding's share of the lot's residential (door-to-door) area ÷ 100 m²: 167 m² ≈ 2.64 (lot 149),
     2.48 (150), 2.61 (153). `rights.entitlementBasis: 'simulation'` keeps 2.25/167 for the legacy and golden fixtures
     (`C_SIM`). On the official basis what the owner is credited equals what the developer gives up (₪2,307,793 at 35%);
     the simulation basis keeps its ₪339,043 residual as an explicit, material "unallocated" claim.
123. **Consideration ledger**: per-asset claims (recipient owner / pool / unallocated, quantity, physical area, value,
     price basis, valuation source); physical apartments and area kept apart from value; a residual above
     max(₪10K, 1%) is flagged material.
124. **Accounting (§D)**: the facility report counts external project draws only, with a separate transfer row for a tax
     loan refinanced into the mortgage; an overdue tax loan is part of the debt at delivery and its accrual after delivery
     is not "interest to delivery"; the refinance ceiling is in nominal shekels at maturity and limited by what the
     status mortgage limit leaves after the project mortgage; delivery, no-approval and failure views are in today's
     prices (nominal events and interest deflated on their dates).
125. **Developer stresses and equivalence**: the cost stress also scales a direct-cost override; services volume,
     presales, owners' tax basis and an escort-loan cap added; headroom labelled static. The equivalence % uses the
     selected markup, and a diagnostic reports every root with unique / multiple / unbracketed.
126. **Typed evidence**: each price-dependent term has a status (observed, appraisal, confirmed offer, assumed,
     hypothetical, unknown). Only a confirmed offer or an observation is evaluated as fact; a scenario never becomes one.
127. **Interval solver**: thresholds are read from the feasible set on a grid with refined edges (disconnected sets
     handled: [2,3] ∪ [7,8] → max 8); solvers report their resolution and are never called complete.
128. **Contract snapshot** (`optimizer/contract.ts`): a contract = arrangement, %, markup, offer terms and the funding the
     household relies on. Every route is evaluated once under it and both sides read the same snapshot (stable id, input
     fingerprint, lot). Owner acceptance = fundable (unknown capital is not), no unverified price, no unconfirmed
     apartment inventory (by legs — tiers, mixes and rentals derived from them — not by strategy id), not
     policy-blocked, and the goal (whole apartments: the most any fundable route reaches on these terms; no risk: no
     borrowing; cash soon: cash before the deadline; income: positive net income). Developer acceptance = the lot margin
     *with this route* ≥ the hurdle. Status: infeasible / modeled_conditional / terms_confirmed — never confirmed while
     the outside options (no current land price; the hurdle is an assumption) are unknown.
129. **Bilateral search, second version** (amends #119). Pairs (contract, route), feasible only when both sides accept the
     same snapshot — the household's best route is never set against a baseline developer. Funding variants: none, the
     developer's tax loan, another property's loan (when relevant). Grid with both endpoints at the slider step (0.5
     point, `commercial.combination.step`), a coarse pass every 1 point refined wherever any route's acceptance changes;
     an invalid step throws; "not found in the tested scenarios", never "none exists". Gap = minimum distance between
     the sides on the same route; levers (the developer's margin there, an apartment-price floor, a direct-cost
     ceiling) re-evaluated on both sides; the capital lever examines every funding-only candidate. The frontier is
     deduplicated (an unused tax loan is the same deal).
130. **Group planner, second version** (amends #120). One common contract for all members (the selected arrangement and %,
     one funding facility for all); options are contract snapshots — conditional deals under other terms are never
     summed. The lot is the user's selected lot. Validated: aggregate area ≤ the lot, slots an integer ≤ the lot quota,
     ≤ 8 members, every member's inputs. Pool conserved: ⌊S⌋ whole units sold, each owner credited only units ÷ S of their
     share (`balancing_pool.soldFraction`) and re-evaluated (taxes, cash flow, financing); the rest stays an illiquid
     fractional share. Policy-blocked routes are not options (never a free slot). One lot P&L for the group (route deltas
     summed against one baseline); below the hurdle the plan is infeasible. Lexicographic branch-and-bound: fewest owners
     left on the outside option (no agreement, value unknown), reservations respected, first choices, value. Statuses:
     at/above reservation, no reservation option, outside option; "nobody is worse off" is claimed only when it holds for
     everyone. Search bounds reported.
131. **Contracts with an option, second version** (amends #121). No implicit fallback: a fixed contract that cannot be
     carried out in a state is "not executable" there. Option rows state their terms — plain combination (S02) as the
     agreed fallback, exercise at approval, financing condition, fee unknown, same arrangement and %. The switched plan
     keeps the fallback's events before the exercise date (common prefix) and moves the target's earlier obligations to
     that date (₪100K at signing → month 24, PV ≈ ₪94,259 at 3%); both sides recomputed on it. Financed branch: only the
     contract's facilities; no-financing: none. Utilities relative to "keep the land, no deal": approved states use the
     ranking value, no approval minus the maximum modelled loss; minimax regret over all three states (A = 100/100/−100 →
     100, B = 95/95/0 → 5). Premium interval: the owner's gain if financed vs the developer's cost.
132. **Concessions and feasibility explanations** (`optimizer/concessions.ts`). Levy, all taxes, tax-loan interest,
     +1 point, payment timing — each the same route re-evaluated under the changed contract. Owner gain = Δ ranking value;
     developer cost = Δ PV of its lot equity flows at the same real rate. Lot-wide terms are attributed to this owner's
     share of the lot (the lot-wide figure kept alongside); owner-only terms are costed alone. Only executable
     concessions on the frontier. Typical result (167 m², gross): tax concessions ≈ 0.84 per ₪ of developer cost (purchase
     tax, gross-up and financing), the interest subsidy ≈ 2.6, deferring the owner's payments ≈ 1.06. The explanation names
     what binds (financing gap, missing information, market evidence, developer hurdle, policy, physical, goal) and the
     single concessions that close it, tested on both sides; bounded, not a proof.
133. **Inputs and stale results**: `validateInputs` also checks the other-property limit, the liquidity deadline, the goal,
     the levy cap, upper bounds on amounts and that every configuration number is finite; the joint search, group
     planner, contingent plan and concessions validate on entry. The engine returns its result with the exact inputs it
     used; ContingentCard and ConcessionsCard use those. JointSearch and GroupPlanner tie results to an input fingerprint,
     drop runs started on older inputs and hide stale results. Print is disabled while a newer analysis computes.
134. **CI and performance**: actions pinned to release commit SHAs; `permissions: {}` by default, build `contents: read`,
     deploy `pages: write` + `id-token: write`; Playwright 1.63.0 from the lockfile; the e2e check runs on the deployed
     build under the repository base path and covers the advanced features and localStorage; public PDFs are a reviewed
     allow-list. Benchmarks (`tests/perf`): group of 8 ≤ 90 ms, joint search 0.4–0.5 s (≈ 2 s for a whole-lot holding).
     No Web Worker: typical runs are well under a second and stale runs are already discarded; revisit if phones show
     long freezes on large holdings.

## V1.0 — product specification (2026-11-28)

135. **The product specification governs V1.0** (`docs/PRODUCT-SPEC.md`). The review-and-feature cycle ends; V1.0 is
     reached by closing the finite backlog (`docs/BACKLOG-V1.md`) through milestones A–E (`docs/RELEASE-CRITERIA.md`).
     Shared semantics with LandLens are documented in `docs/ECONOMIC-CONTRACT.md`; no shared package or runtime link.
136. **Approved deviations** (owner, 2026-11-28): D-1 — the official allocation share stays the default entitlement (#122);
     the 2.25 simulation convention is shown beside it and remains the basis of the shared fixtures. D-2 — amends #53:
     the wizard keeps three goals, the advanced view offers all five, and saved goals are no longer migrated.
137. **Prototype treatment** (owner, 2026-11-28): the group planner stays in the advanced view labelled illustrative and
     limited; the option-contract card becomes protections and negotiation questions, ranking an option only when its
     terms are entered in the actual-offer panel.
138. **Contract snapshot v1 and bilateral events** (Milestone B1, MH-01/MH-05). Every non-zero ledger amount is a
     transfer source → destination; the party legally liable is kept apart from the contractual payer (levy and capital
     gains are always the owner's liability; VAT is modelled as the payer's, to confirm with an adviser). Facilities
     keep an account each — drawn + transfers in (+ capitalised interest) − repayments − transfers out = terminal
     balance — tested for every snapshot. Dated facility flows are recorded only on request (the solvers run thousands
     of simulations; recording them always cost ≈ 35% of the joint search) and re-run from the stored input when a
     snapshot's events are read. The input hash covers the profile, the whole configuration and the terms.
139. **Project Pack v1 and canonical evidence** (B2, spec §C). One validated, versioned, bundled pack per project;
     statuses `verified_fact`, `reported`, `appraisal_reference`, `confirmed_offer`, `assumption`, `scenario`,
     `unknown` (config.evidence migrated: hypothetical → scenario, assumed → assumption). Historical land transactions
     are dated `reported` evidence, never a current valuation; inventory is explicitly unknown.
140. **Common comparison date and scoped offers** (B4, MH-09). `analysis.valuationDate` (2026-11-28) is "today" of the
     prices and the date offers are checked on. A confirmed term counts as fact only for the lots it was offered for and
     within its validity window; outside it the route stays price-conditional.
141. **No-approval split** (B3, MH-13). Payments before approval = advances to the developer (back only under a
     guarantee or refund clause) + taxes (refund only by claim) + non-refundable costs + rights bought; the reserve is
     reported apart and never a loss. Rights bought are shown as an asset kept, but the maximum exposure still values
     them at zero (resale value unknown — #97 kept).
142. **Print binds to the analysed snapshot** (B5, MH-08). The printed header shows the snapshot id, time, data and
     build versions and the inputs and terms the result was computed from — never the newer inputs being analysed; a
     printout made while recalculating says so. "Forget" removes every key the app stored.
143. **Summary: one direction and two alternatives** (C2). The simple view shows at most three cards (one per deal
     family, so the alternatives are materially different), the goal's own measure, the signing / delivery /
     projection distinction on the direction, and — when nothing fits — what blocks it instead of a forced winner.
144. **Goal guidance** (C3, `optimizer/guidance.ts`): value (balanced), whole apartments, net monthly income after
     debt service (passive income), cash by the deadline (cash soon), borrowing (no risk); cash soon and no risk also
     get the sale price per original m² to ask for. Saved goals are kept as they are (#136).
145. **Actual-offer check** (C1, `optimizer/offer.ts`). Optional fields; entered terms are used as written, empty ones
     stay unknown (model scenario) and become questions. Who pays which tax maps onto the arrangement templates (levy on
     the owner with capital gains on the developer = net with a ₪0 levy cap); a VAT payer the template does not match is
     flagged. A licensed-area construction price is converted to door-to-door with the lot's areas. The comparison is
     the same route on the base terms, on the common date, line by line. The offer is session-only.
146. **Terms to request** (C4, `optimizer/negotiation.ts`): one list with value to the owner, cost to the developer and
     plausibility from the lot margin with that route; a minimum % only within the approved 25–45% range.
147. **Prototypes** (C5): the group planner is labelled illustrative and limited; the option card shows protections and
     questions, and compares options only when an option fee is entered (#137).
148. **Print report and storage warning** (C6): a print-only report from the analysed snapshot (direction, taxes by
     payer, dependencies, offer comparison, questions, key assumptions with source dates); the save box warns about
     shared devices and the limits of browser storage.
149. **Professional review is external and blocking** (Milestone D). Review packets for an appraiser, a tax adviser
     and a real-estate lawyer (`docs/review/`) list fixtures with independent expected numbers and explicit questions;
     the sign-off table is open. Until it is signed the app footer, the printout and the docs say "not professionally
     validated". Sources were refreshed where automated access allows; the ones that could not be re-verified are
     listed, not assumed current.
150. **Release candidate, not 1.0.0** (Milestone E). Every automated gate passes; the professional sign-off is blocking
     in the definition of done, so the version is 1.0.0-rc.1 and becomes 1.0.0 when the three reviews are recorded.
151. **Accessibility and browser gates** (E): axe WCAG 2 A/AA with no serious or critical violations on the settled
     wizard, summary and advanced view (the dimmed, aria-busy recalculating state is transient); the muted text colour
     darkened for 4.5:1. Timings at 4× CPU slowdown are checked against budgets (fail only beyond 3×, so CI noise does
     not block); no Web Worker needed.
152. **Every output is visual** (rc.2). A small chart kit (`src/components/charts`) — no library, inline SVG/HTML, CSP
     unchanged — following the data-viz rules: thin marks, one baseline, fixed label/value columns so bars share one
     scale, hairline axes, a legend for ≥ 2 series, text never in the series colour, tooltips on hover and keyboard
     focus that only enhance (each chart sits beside the table with the same numbers), right-to-left bars, time left
     to right. Colours: the validated reference categorical order (owner blue, developer orange, third aqua; ≥ 4.5:1
     inside-label ink chosen by contrast); green / red only for better / worse, always with ▲/▼ and a word.
153. **All land rights accounted for on every route** (`domain/rightsAllocation.ts`): entitlement + rights bought =
     combination + sold to the developer + sold on the open market (now / after approval) + built + revenue share +
     kept as land, exactly (tested on fixed holdings on both bases and by a property test). Shown on every route card,
     the recommendation, the alternatives, every row of the route table, the offer check and the printout. Selling
     rights to other owners in the lot is not modelled as a route (only buying from them) — an open product question.
154. **The offer's route** (offer check): the owner's best acceptable route; if none, the best route that needs no
     unknown price and no unconfirmed inventory — never a price-dependent route because its scenario value is highest.
