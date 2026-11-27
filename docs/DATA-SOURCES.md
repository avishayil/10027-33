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
| Construction-services cap per lot / per owner | 25% (20–30%) / 1 apartment | — | assumed (owner’s assessment) | — |
| Developer direct cost / soft costs / target margin | ₪11,000 / 12% / 15% | — | assumed | — |

Review cadence is in `src/data/sources.ts`. Updates are made by editing the data files, bumping
`CONFIG_VERSION`, and opening a PR whose description lists old/new values and the changed recommendations for
the representative profiles in `tests/fixtures/profiles.ts`. Never publish unreviewed market estimates.
