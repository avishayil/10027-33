/** Plain-Hebrew explanation templates. No financial jargon where a simple word works. */
import type {
  ConditionCode,
  Feasibility,
  Goal,
  NegotiationCode,
  ReasonCode,
  StrategyResult,
  StrategyType,
} from '../domain/types';

export const GOAL_LABELS: Record<Goal, string> = {
  balanced: 'כדאיות כלכלית תוך שמירה על סיכון סביר',
  maximize_apartments: 'לקבל כמה שיותר דירות',
  passive_income: 'הכנסה חודשית משכירות',
  immediate_cash: 'לקבל כסף בהקדם האפשרי',
  minimize_risk: 'מינימום סיכון והתחייבויות',
};

export const FEASIBILITY_LABELS: Record<Feasibility, string> = {
  estimated_feasible: 'מתאים לפי האומדן',
  conditional: 'מתאים בתנאים מסוימים',
  fragile: 'גבולי',
  infeasible: 'לא מתאים',
  unknown: 'חסר מידע',
};

export const FEASIBILITY_HINTS: Record<Feasibility, string> = {
  estimated_feasible: 'מתאים ליכולת הכלכלית שהזנתם. אומדן — לא אישור בנק או ייעוץ משפטי.',
  conditional: 'מתאים אם יתקיימו תנאים שעדיין צריך לברר (הצעת יזם, מימון וכו׳).',
  fragile: 'מתאים בתרחיש הבסיס, אבל לא עומד בתרחיש השמרני.',
  infeasible: 'חורג מהיכולת הכלכלית או ממגבלות המימון.',
  unknown: 'אי אפשר להעריך בלי מידע נוסף.',
};

const fmtN = (n: number) => new Intl.NumberFormat('he-IL', { maximumFractionDigits: 2 }).format(n);

export function strategyTitle(r: StrategyResult): string {
  const k = r.candidate.targetApartments;
  const built = r.plan.apartmentsBuilt;
  const titles: Record<StrategyType, string> = {
    S01: 'מכירת כל הזכויות ליזם',
    S01M: 'מכירה מיידית בשוק הפתוח',
    S02: 'קומבינציה מלאה',
    S02C: 'קומבינציה מלאה ופיצוי כספי על חלק הדירה',
    S11: `קומבינציה על חלק מהזכויות ושירותי בנייה על השאר — ${k === 1 ? 'דירה שלמה' : `${k} דירות שלמות`}`,
    S03: `שירותי בנייה ל-${built} דירות ומכירת היתרה`,
    S04: 'עסקת תמורות (חלק מהכנסות המכירה)',
    S05: `מכירה חלקית ושירותי בנייה ${built === 1 ? 'לדירה אחת' : `ל-${built} דירות`}`,
    S06: `קומבינציה והשלמה בתשלום ${k === 1 ? 'לדירה שלמה' : `ל-${k} דירות שלמות`}`,
    S07: `בניית ${built} דירות ומכירת אחת במסירה`,
    S08: `בניית ${built === 1 ? 'דירה' : `${built} דירות`} והשכרה`,
    S09: 'להמתין לאישור התכנית ולמכור בשוק',
    S10: `רכישת זכויות משלימות ובניית ${built} דירות`,
  };
  return titles[r.strategyType];
}

export const STRATEGY_DESCRIPTIONS: Record<StrategyType, string> = {
  S01: 'מוכרים את כל הזכויות ליזם ומקבלים כסף. פשוט, בלי משכנתא — אבל בלי דירה.',
  S01M: 'מכירה היום לקונה פרטי. המחיר מבוסס על עסקאות עבר בחלקה לפני העדכון — דרושה שומה עדכנית.',
  S02: 'היזם מקבל את רוב הזכויות, בונה, ומוסר לכם חלק מהדירות. החלק שאינו דירה שלמה נשאר בעלות משותפת — בלי שכירות ובשווי מופחת.',
  S02C: 'קומבינציה רגילה, והיזם קונה מכם במסירה את החלק שאינו דירה שלמה, בכסף.',
  S11: 'חלק מהזכויות בקומבינציה, ועל השאר משלמים ליזם רק את עלות הבנייה ורווח יזמי — כדי להגיע בדיוק לדירה שלמה בלי למכור זכויות ובלי לקנות השלמה במחיר שוק.',
  S03: 'בונים בעצמכם (דרך יזם בשירותי בנייה) את כל הדירות השלמות, ומוכרים רק את השארית.',
  S04: 'היזם בונה ומממן, ואתם מקבלים אחוז מהכנסות המכירה בסוף הפרויקט.',
  S05: 'מוכרים חלק מהזכויות ליזם, ובכסף מממנים בנייה של פחות דירות — אבל שלמות.',
  S06: 'קומבינציה רגילה, ובנוסף משלמים ליזם על החלק החסר כדי לקבל דירה שלמה.',
  S07: 'בונים כמה דירות, ובמסירה מוכרים אחת כדי להחזיר את רוב החוב.',
  S08: 'בונים, שומרים ומשכירים. שכר הדירה עוזר להחזיר את המשכנתא אחרי המסירה.',
  S09: 'לא מתחייבים עכשיו. מחכים לאישור התכנית (כשנתיים) ומוכרים בשוק — בסיכון שהאישור יתעכב.',
  S10: 'קונים את החלק החסר מבעלים אחרים כדי להגיע לדירה שלמה נוספת, ובונים.',
};

export const CONDITION_TEXT: Record<ConditionCode, string> = {
  DEVELOPER_PRICE_UNVERIFIED: 'מחיר שהיזם ישלם על הזכויות — ההנחה (₪6,900 למ״ר) אינה הצעה מאומתת.',
  PARTIAL_RIGHTS_PURCHASE: 'שהיזם מוכן לקנות רק חלק מהזכויות שלכם.',
  REVENUE_SHARE_UNVERIFIED: 'אחוז התמורות (45%) — הנחה מהצעה קודמת, לא מאומתת.',
  COMPLETION_PRICE: 'המחיר שהיזם יגבה על השלמת החלק החסר לדירה שלמה.',
  COMPLEMENTARY_SELLER: 'שיש מוכר לזכויות המשלימות, ובאיזה מחיר.',
  LENDER_CONFIRMATION: 'שבנק יממן — כולל הכרה בזכויות בקרקע כבטוחה. מימון בנייה אינו זמין בהכרח לפני אישור התכנית.',
  MORTGAGE_CAPACITY_UNKNOWN: 'כמה תוכלו להחזיר בחודש — לא הוזן.',
  LTV_ABOVE_COMFORT: 'שיעור מימון מעל 50% — תלוי בסיווג אצל הבנק.',
  WHOLE_UNIT_ALLOCATION: 'שהזכויות יתורגמו בהסכם לדירה שלמה ומסוימת.',
  TAX_ALLOCATION:
    'שהעסקה ״נטו״: היזם מתחייב בחוזה לשלם את מס השבח (בגילום) ואת היטל ההשבחה, עם ביטחונות — החבות כלפי רשות המסים נשארת עליכם. אם לא, אפשר לבקש דחיית תשלום לפי סעיף 91א (לא מובטח).',
  CURRENT_APPRAISAL: 'שומה עדכנית לשווי הזכויות היום.',
  BRIDGE_FINANCING: 'הלוואת גישור לפני היתר הבנייה — לא מובטחת.',
  CONSTRUCTION_FINANCING: 'מימון בנייה בשלבים מבנק (ליווי) — לפי התקדמות הבנייה ובכפוף להסכם.',
  MIXED_STRUCTURE: 'שהיזם מסכים לשלב קומבינציה ושירותי בנייה באותה עסקה.',
  FRACTION_SETTLEMENT: 'שהיזם מסכים לקנות מכם את חלק הדירה, ובאיזה מחיר.',
  PLANNING_APPROVAL: 'אישור סופי של התכנית — מועד וודאות.',
  SERVICES_CAPACITY: 'שיש מקום פנוי לשירותי בנייה במגרש — היזם צפוי להקצות רק 20%–30% מהדירות, וייתכן שיהיו יותר מבקשים ממקומות.',
};

export const REASON_TEXT: Record<ReasonCode, string> = {
  NO_BORROWING_CAPACITY: 'דורש משכנתא, וציינתם שלא תיקחו משכנתא.',
  REPAYMENT_EXCEEDED: 'ההחזר החודשי הנדרש גבוה ממה שציינתם שתוכלו לשלם.',
  LTV_EXCEEDED: 'המימון הנדרש גבוה מ-75% משווי הנכס — מעבר למגבלות הבנקים.',
  CAPITAL_UNKNOWN: 'צריך לדעת כמה כסף פנוי יש לכם.',
  IMMEDIATE_PRICE_UNKNOWN: 'אין שומה עדכנית לשווי הקרקע היום.',
  FRACTIONAL_UNIT: 'מתקבל חלק מדירה (בעלות משותפת), לא דירה שלמה.',
  ADVERSE_FAILS: 'בתרחיש השמרני המסלול חורג מהיכולת הכלכלית.',
  NO_DEBT: 'ללא משכנתא.',
  USES_MORTGAGE: 'נדרשת משכנתא.',
  RENT_SUPPORTS_REPAYMENT: 'שכר הדירה מסייע בהחזר המשכנתא אחרי המסירה.',
  COMBINATION_BELOW_WHOLE_UNIT: 'באחוז הקומבינציה הנוכחי לא מגיעים לדירה שלמה.',
  NOT_ENOUGH_RIGHTS: 'הזכויות שלכם קטנות מדירה אחת.',
  DEVELOPER_POLICY_WHOLE_FROM_COMBINATION:
    'הקומבינציה המלאה כבר נותנת לכם דירה שלמה — יזם צפוי להציע לכם קומבינציה מלאה, לא שירותי בנייה.',
  DEVELOPER_POLICY_PER_OWNER_CAP:
    'יזם צפוי להגביל שירותי בנייה לדירה אחת לבעל זכויות (המקומות במגרש מוגבלים).',
  UNFUNDED_OBLIGATION: 'יש תשלומים שבנק לא מממן (מסים, היטל, עלויות) ואין מספיק כסף פנוי לכסות אותם במועד.',
  FRACTION_UNRESOLVED: 'חלק הדירה שנשאר לא מוסדר — אין ממנו הכנסה.',
};

export const NEGOTIATION_LABELS: Record<NegotiationCode, string> = {
  MIN_SURPLUS_PRICE: 'מחיר מינימלי לזכויות העודפות',
  MAX_CONSTRUCTION_COST: 'עלות בנייה מקסימלית לדירה (כולל מע״מ ורווח יזמי)',
  MAX_DEVELOPER_MARKUP: 'רווח יזמי מקסימלי',
  MIN_COMBINATION_PCT: 'אחוז קומבינציה מינימלי לדירה שלמה נוספת',
  MAX_COMPLETION_PAYMENT: 'תשלום השלמה מקסימלי',
  REQUIRED_ADDITIONAL_CAPITAL: 'הון עצמי נוסף שנדרש',
  MAX_SUSTAINABLE_MORTGAGE: 'משכנתא מקסימלית לפי יכולת ההחזר',
  LATEST_SURPLUS_PAYMENT: 'המועד המאוחר ביותר לתשלום היזם על הזכויות',
  BREAKEVEN_SURPLUS_PRICE: 'מחיר איזון כלכלי מול המסלול המשתלם ללא מכירה',
  CONSERVATIVE_SURPLUS_PRICE: 'מחיר מומלץ למשא ומתן (עדיף גם בתרחיש השמרני)',
  IMMEDIATE_SALE_MIN_PRICE: 'מחיר מינימלי למכירה היום כדי שתשתלם',
  MAX_COMBINATION_AT_TARGET_MARGIN: 'אחוז קומבינציה מקסימלי שמשאיר ליזם רווח סביר',
  DEVELOPER_RESIDUAL_LAND_PRICE: 'מחיר קרקע מקסימלי שמשאיר ליזם רווח סביר',
  COMBINATION_CONSISTENT_PRICE: 'מחיר במזומן ששקול להצעת הקומבינציה מבחינת היזם',
};

export const AFFORDABILITY_LABELS = {
  fits: 'מתאים',
  fits_with_financing: 'מתאים עם מימון',
  does_not_fit: 'לא מתאים',
  unknown: 'חסר מידע',
} as const;

export const RESILIENCE_LABELS = { robust: 'עמיד', fragile: 'גבולי' } as const;

export const COMMERCIAL_LABELS = {
  not_required: 'לא תלוי ביזם',
  unverified: 'טרם אומת',
  questionable: 'מוטל בספק',
  not_offered: 'לא צפוי שיוצע',
} as const;

/** Personalised "why" bullets for a strategy. */
export function explainWhy(r: StrategyResult, goal: Goal, ranked: StrategyResult[]): string[] {
  const out: string[] = [];
  const m = r.metrics;
  const best = (f: (x: StrategyResult) => number) => ranked.every((o) => f(r) >= f(o) - 1e-6);
  if (best((x) => x.metrics.valueCreated)) out.push('הערך הכלכלי הגבוה ביותר מבין המסלולים שמתאימים לכם.');
  if (m.wholeApartments > 0) out.push(`נשארות לכם ${m.wholeApartments === 1 ? 'דירה שלמה אחת' : `${m.wholeApartments} דירות שלמות`}.`);
  if (r.assessment.commercial === 'questionable') {
    out.push('שימו לב: לפי מודל צד היזם, העסקה כמעט לא משאירה לו רווח בהנחות הנוכחיות — ייתכן שלא תוצע.');
  }
  if (r.mortgageRequired <= 1) out.push('לא נדרשת משכנתא.');
  else out.push(`נדרשת משכנתא של כ-${fmtN(Math.round(r.mortgageRequired / 1000))} אלף ₪.`);
  if (m.resilience >= 0.5) out.push('נשאר מתאים גם בתרחיש השמרני.');
  if (r.feasibility === 'fragile') out.push('שימו לב: בתרחיש השמרני המסלול חורג מהיכולת שלכם.');
  if (goal === 'passive_income' && m.sustainableMonthlyIncome > 0) {
    out.push(`הכנסה חודשית משוערת אחרי החזר המשכנתא: כ-${fmtN(Math.round(m.sustainableMonthlyIncome))} ₪.`);
  }
  if (goal === 'immediate_cash' && m.liquidity > 0) {
    out.push(`כסף נטו בתוך תקופת היעד: כ-${fmtN(Math.round(m.liquidity / 1000))} אלף ₪.`);
  }
  if (r.reasonCodes.includes('COMBINATION_BELOW_WHOLE_UNIT')) out.push(REASON_TEXT.COMBINATION_BELOW_WHOLE_UNIT);
  if (r.reasonCodes.includes('RENT_SUPPORTS_REPAYMENT')) out.push(REASON_TEXT.RENT_SUPPORTS_REPAYMENT);
  return out;
}

export function formatRights(n: number): string {
  return fmtN(n);
}
