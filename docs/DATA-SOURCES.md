# Data sources

Every external value is a `DataPoint` (`src/domain/types.ts`) with source type, URL, observed/retrieved dates,
range and verification level, shown in the app under “הנחות החישוב ומקורות המידע”. A test fails if any lacks them.

| Value | Base | Range | Verification | Source |
| --- | --- | --- | --- | --- |
| Rights per 167 m² | 2.25 | — | assumed (product spec) | — |
| Construction cost | ₪11,000/m² | +15% adverse | assumed | user spec |
| Apartment value | ₪25,000/m² | 21–28K | reported | Zips (₪24,300, 213 deals) |
| Rent (4 rooms) | ₪5,500 | 4.5–6.5K | reported | listings, Park neighbourhood |
| Developer price | ₪6,900/orig. m² | −25% / +10% | assumed, **not an offer** | earlier proposal |
| Immediate sale | **null** | ref. ₪1,647–2,395 | reported | LandCheck, parcel 33 deals (pre-106(b)) |
| Mortgage rate | 5% | 4–7% | reported | Bank of Israel (Oct 2026) |
| Betterment levy | 50% | proxy ±(−15%/+25%) | verified rate | Planning Administration |
| VAT | 18% | — | verified | Tax Authority |
| Capital gains | 25% of gain | basis range | assumed | Tax Authority |
| Purchase tax | 6% | — | reported | Tax Authority |
| Indexation | 3%/y | 1–5% | assumed | CBS input index (scenario, not forecast) |
| Post-approval land value | ₪7,100/m² | 5,325–7,810 | reported (other parcels) | Zips, block 10027 |
| Immediate-sale scenarios | ₪1,916 | 1,647–2,739 | reported / derived | parcel 33 deals; table value − levy |
| Fraction illiquidity / cash settlement | 20% / 80% | — | assumed | — |
| Approval timing | 2 years | — | assumed | — |
| Combination tax borne by developer (net deal) | yes, grossed up | owner-pays as alternative | reported practice | law-firm tax guides (see below) |
| Construction-services cap per lot / per owner | 25% (20–30%) / 1 apartment | — | assumed (owner’s assessment) | — |
| Developer direct cost / soft costs / target margin | ₪11,000 / 12% / 15% | — | assumed | — |

Review cadence is in `src/data/sources.ts`. Updates are made by editing the data files, bumping
`CONFIG_VERSION`, and opening a PR whose description lists old/new values and the changed recommendations for
the representative profiles in `tests/fixtures/profiles.ts`. Never publish unreviewed market estimates.

## Combination taxation — sources consulted (2026-11-27)
Secondary sources (law-firm guides, not rulings); verify with a tax lawyer before signing:
* [TASA — מיסוי עסקת קומבינציה](https://tasalaw.co.il/%D7%9E%D7%99%D7%A1%D7%95%D7%99-%D7%A2%D7%A1%D7%A7%D7%AA-%D7%A7%D7%95%D7%9E%D7%91%D7%99%D7%A0%D7%A6%D7%99%D7%94-%D7%94%D7%9E%D7%93%D7%A8%D7%99%D7%9A/) — many deals are “net”, the developer pays the owner’s capital-gains tax.
* [גבאי עמיאל — מס שבח על מגרש בעסקת קומבינציה](https://www.gatax.co.il/%D7%9E%D7%A1-%D7%A9%D7%91%D7%97-%D7%A2%D7%9C-%D7%9E%D7%92%D7%A8%D7%A9-%D7%91%D7%A2%D7%A1%D7%A7%D7%AA-%D7%A7%D7%95%D7%9E%D7%91%D7%99%D7%A0%D7%A6%D7%99%D7%94/) — tax only on the share sold.
* [Taxo — מחשבון קומבינציה](https://www.taxo.co.il/realestate/LandValueMrCombination.asp) — legal liability stays with the owner; full gross-up when the developer pays.
* [יגאל גולד — מיסוי עסקת קומבינציה](https://ygoldlaw.co.il/real-estate-lawyer/tax/combination/) — consideration = construction services incl. developer profit and VAT (Kamhi).
* [יוני לוי — הסכם קומבינציה](https://yonilevy.co.il/combination-agreement-landowners-advantages/) — developers commonly bear the levy, sometimes split.
* [אהרון צ׳יסמדיה — סעיף 91א](https://www.atz-law.co.il/%D7%93%D7%97%D7%99%D7%99%D7%AA-%D7%AA%D7%A9%D7%9C%D7%95%D7%9D-%D7%94%D7%9E%D7%A1-%D7%9C%D7%A4%D7%99-%D7%A1%D7%A2%D7%99%D7%A3-91%D7%90-%D7%9C%D7%97%D7%95%D7%A7-%D7%9E%D7%99%D7%A1%D7%95%D7%99-%D7%9E/) and [כל זכות — דחיית תשלום מס שבח](https://www.kolzchut.org.il/he/%D7%93%D7%97%D7%99%D7%99%D7%AA_%D7%AA%D7%A9%D7%9C%D7%95%D7%9D_%D7%9E%D7%A1_%D7%A9%D7%91%D7%97) — administrative deferral for owners without cash.

## Iteration 3 additions (2026-11-27)

| Value | Base | Range | Status | Source |
|---|---|---|---|---|
| Contractor profit in services value | 17.5% | 15–20% | court_ruling / reported | [EA 6672/19](https://www.gov.il/BlobFolder/legalinfo/law6672-19/he/LegalInformation_kesher_6672-19.pdf); instruction 23/98 (via [Nadlan Center](https://www.nadlancenter.co.il/article/4756)) |
| Combination sale date | plan approval (§19(3א)) | signing | official_rule (secondary report) | [position 06/26](https://www.gov.il/he/pages/procedures-260726-1); [Gelberg](https://gelberglaw.co.il/combination-net-sale-date-section-19-3a/) |
| Tax arrangement headline | mixed | gross / net | reported | law-firm guides; [MoC study](https://www.gov.il/BlobFolder/reports/r1060_moch/he/r1060.pdf) |
| Completion purchase tax | 8% (unknown status) | 0–8% | official_rule (range) | [purchase-tax simulator](https://www.gov.il/he/service/real_eatate_taxsimulator) |
| Developer payment for rights | at approval (year 2) | — | planning assumption | — |
| Work-in-progress recognised as collateral | 80% | — | planning assumption | — |
| Policy reference combination | 35% | — | project assumption | owner's input |
| Apartment tiers | 80/90/100/110 m² | — | illustrative | — |

New source-status values: `official_rule`, `court_ruling`, `offer_confirmed`, `unknown`. Nothing is fetched at
runtime; the market figures (₪25,000/m², ₪5,500 rent, 5% nominal) remain scenarios, and ₪6,900 / ₪7,100 / ₪1,916
remain unverified references — not quotes.

## Reported combination deals and the tax loan (2026-11-27)

| Value | Base | Range | Status | Source |
|---|---|---|---|---|
| Services VAT payer | owner (gross, mixed) / developer (net) | — | reported practice | Rothstein 2024 periodic report, note 10 (owners paid VAT in all three deals) |
| Tax-loan rate | prime + 2% = 6.75% | 4.75–8.75% | reported | Rothstein (prime + 2%); prime 4.75% after the BoI decision of 23.11.2026 (secondary sources — BoI site blocked automated access; verify) |
| Combination range (slider) | 35% | 25–45% | scenario | covers net offers (lower) and reported gross deals (40–47%) |

Reported deals (`COMBINATION_DEALS` in `src/data/evidence.ts`, shown in the assumptions panel), as transcribed in
the owner's research — not yet re-checked against the filings on [mayafiles.tase.co.il](https://mayafiles.tase.co.il):
Rothstein Rehovot 05/2022 (40%), Holon 03/2022 (47%, developer pays the new-plan levy up to ₪7.5M), Netanya 04/2022
(43%), Karden Be'er Ya'akov 05/2009 (19%, developer pays the levy; owner credit guaranteed). Different land, years
and rights — evidence of how deals split the taxes, not a % to expect here.

## Iteration 6 — financing and lot-model assumptions (2026-11-27)

| Value | Base | Range | Status | Source |
|---|---|---|---|---|
| Tax-loan rate (developer) | prime + 2% + VAT on interest = 7.965% | 4.75–8.75% before VAT | reported | Rothstein 2024 periodic report, note 10 ([PDF](https://mayafiles.tase.co.il/rpdf/1653001-1654000/P1653109-00.pdf)); prime 4.75% (BoI 23.11.2026, confirmed by the review) |
| Tax-loan cap | 50% of the apartment entitlement | — | planning assumption | per-owner facility sizes not published |
| Developer equity | 20% of costs | 15–25% | planning assumption | — |
| Escort loan | prime + 1.5% = 6.25% | 5.25–7.75% | planning assumption | — |
| Presales during construction | 15% of developer sales | 10–40% | planning assumption | — |
| Timeline | approval 24, permit +0, construction 36 months | see scenarios | planning assumption | permit lag 0 is optimistic |

Other reported Rothstein arrangements (per the independent review of the 2024 report): 32.5% residential / 45%
commercial with a ₪46M advance whose interest the joint venture bears; ₪27M owner tax loans at prime + 1.9%.

## Iteration 7 assumptions (2026-11-27)

| Value | Base | Range | Status | Source |
|---|---|---|---|---|
| Real discount rate (comparison) | 3% | 0–5% | owner decision / planning assumption | ≈ mortgage rate − inflation |
| Mortgage LTV on delivered homes | 75% sole / 50% additional / 50% unknown | — | statutory | [BoI directive 329](https://boi.org.il/roles/supervisionregulation/nbt/nbt329/) |

## Iteration 8 — developer budget evidence (2026-11-27)

| Value | Base | Range | Status | Source |
|---|---|---|---|---|
| Plan built areas per lot | lot 149: 14,269 / 4,770 / 1,530 m² (above / below / balconies); 20 floors, 72 m | — | official (plan provisions Table 5) | appraisal pp.30–32 (local PDF, `to-review/`) |
| Saleable area per lot | 11,209 / 10,541 / 11,045 m² | — | planning appraisal | `parcel33.js` (door-to-door area) |
| Construction cost, tower, Sharon | ₪6,600 / licensed m² | ±10% | reported (survey) | [לשכת שמאי מקרקעין — אומדן עלויות בנייה, יוני 2026](https://landvalue.org.il/index2.php?id=20313) |
| Underground, Sharon | ₪3,400 / m² | ±10% | reported (survey) | same |
| Balconies | 40% of the main rate | 30–50% | reported (survey) | same |
| Indirect costs (sensitivity) | 27% | — | planning appraisal | appraisal (public-building shell) |
| Inflation (deflating nominal flows) | 2% | 1–3% | official target | Bank of Israel |

The survey excludes VAT, planning and consultants, supervision, fees and levies, overhead, financing, development and
infrastructure connections. Development levies and permit fees are not modelled.

## Iteration 4 — evidence registry

See `src/data/evidence.ts` and `docs/validation/market-evidence-2026-11-27.md`. The developer price (₪6,900),
post-approval land value (₪7,100), sale-today reference (₪1,916), revenue share (45%) and buy-back (80%) are now
**hypothetical scenario values only**: they never decide the verdict; the engine reports the price each route needs.

## Iteration 10 — entitlement basis and typed evidence (2026-11-28)

| Value | Base | Status | Source |
|---|---|---|---|
| Owner entitlement | the holding's share of the lot's residential area ÷ 100 m² (167 m²: 2.64 / 2.48 / 2.61 in lots 149 / 150 / 153) | official (allocation table, 106(ב)) | `parcel33.js` (`sharePer167` × door-to-door area); owner decision (DECISIONS #122) |
| Simulation basis (fixtures only) | 2.25 per 167 m² | assumption | kept as `rights.entitlementBasis: 'simulation'` for legacy and golden tests |
| Combination slider step | 0.5 point | UI fact | `commercial.combination.step` (the bilateral search tests at least this resolution) |

`config.evidence` types every price-dependent term: developer price, post-approval price, revenue share and the
complementary price are **hypothetical**, the immediate sale price **unknown**, the buy-back factor **assumed**. Changing a
term to `confirmed_offer` (with its source) is the only way it is evaluated as fact. No market values changed in this
iteration; `CONFIG_VERSION` 2026-11-28.14 records the entitlement basis and the slider step.
