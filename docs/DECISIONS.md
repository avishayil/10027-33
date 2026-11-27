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
