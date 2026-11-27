/**
 * Defaults of the retired four-track calculator (iteration 9 / D6). Kept only as the regression fixture for
 * `simulationMath.test.js` — not used by the app and not a current assumption.
 */
/*
 * הנחות ברירת מחדל. היחידות, שווי הזכויות והיטל ההשבחה נגזרים מטבלת האיזון;
 * כאן רק הנחות שוק ועסקה שניתנות לשינוי בהגדרות המתקדמות.
 */
export const DEFAULT_CONFIG = {
  combinationPct: 35,
  /** ריק = לפי טבלת האיזון. מספר = דריסה ידנית של מ״ר קרקע ליח״ד. */
  sqmPerUnitOverride: null,

  costPerSqm: 11000,
  apartmentSizeSqm: 100,
  entrepreneurMarkup: 14.5,

  vatRate: 18,
  requiredEquityPct: 25,

  marketValueSqm: 25000,
  /** מחיר קרקע ברוטו למ״ר בחלקה — בסיס למסלול מזומן. תרחיש לא מאומת, לא הצעה קיימת. */
  landValuePerSqm: 6900,
  entrepreneurProfitMargin: 18,

  /** שיעור היטל ההשבחה מעליית השווי בין המצב הנכנס למצב היוצא. */
  bettermentLevyPct: 50,
  capitalGainsTax: 25,

  revenueSharePct: 45,
};
