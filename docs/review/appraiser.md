# Review packet — real-estate appraiser

Expected numbers are typed from the formulas (tests in brackets), not read from the engine.

| # | Fixture | Expected | Question |
|---|---|---|---|
| A1 | 167 m² in lot 149, official share 2,353/100,000 of 11,209 m² residential area | 263.75 m² ÷ 100 = 2.6375 standard-apartment equivalents (`consideration.test.ts`) | Is the share × residential (door-to-door) area the right physical basis for an owner's entitlement? |
| A2 | Same holding on the simulation convention 2.25 / 167 m² | 0.7875 equivalents at 35% = ₪1,968,750 at ₪2.5M per unit; official share ₪2,307,793; difference ₪339,043 (`golden.test.ts`) | Which basis should owners rely on before final allocation? |
| A3 | Levy proxy, 167 m² | incoming ≈ ₪200,492, outgoing ≈ ₪714,371, 50% × difference ≈ ₪256,939 (`iteration4.test.ts`) | Is the allocation-table difference a reasonable proxy for the local committee's assessment, and which exemptions may apply? |
| A4 | Bought 0.75 right before approval | buyer levy ≈ ₪85,646 (0.75 × ₪256,939 / 2.25) (`sharedFixtures.test.ts`) | Does the levy on purchased rights fall on the buyer, once? |
| A5 | Apartment value ₪25,000/m², rent ₪5,500/month | scenario values, not sales or leases | Current value range for new 4-room units in the compound; rent by type? |
| A6 | Developer direct cost per saleable m² ≈ ₪10,209 (lot 149, survey rates + 10%) | from survey rates × plan areas (`developerBudget.test.ts`) | Area definitions (licensed vs saleable), balcony share 40%, public buildings, indirect costs |
| A7 | Historical 167 m² land deals 2024–26 (₪170K–₪400K) | dated `reported` evidence, never a current valuation | Is there a current land value or developer buy-out price you would support? |

Sign-off: name, licence no., date, data version reviewed, items accepted / changed.
