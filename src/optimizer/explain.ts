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
  balanced: 'הכי משתלם, בסיכון סביר',
  maximize_apartments: 'לסיים עם דירה שלמה',
  passive_income: 'הכנסה חודשית משכירות',
  immediate_cash: 'לקבל כסף בהקדם האפשרי',
  minimize_risk: 'בלי חובות ובלי סיכון',
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
    S02P: 'קומבינציה מלאה וצירוף חלק הדירה ליחידת סל',
    S13: `קומבינציה ודירת ${r.plan.apartmentRooms[r.plan.apartmentRooms.length - 1] ?? ''} חדרים שלמה`,
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
  S13: 'קומבינציה, ובמקום חלק מדירה של 100 מ״ר — דירה שלמה בגודל אחר לפי שווי: משלמים את ההפרש אם היא גדולה יותר, או מקבלים איזון אם קטנה יותר. גדלי הדירות להמחשה בלבד — אין עדיין מלאי דירות מאושר.',
  S02P: 'קומבינציה רגילה; חלקי הדירות של כמה בעלים מאוחדים ל״יחידת סל״ שנמכרת, והתמורה מתחלקת ביניהם. דורש הסכם שיתוף.',
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
  REVENUE_SHARE_UNVERIFIED: 'אחוז התמורות (45%) — הנחה לא מאומתת, לא הצעה קיימת.',
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
  SALE_DATE_DEFERRAL:
    'דחיית יום המכירה לצורכי מס לאישור התכנית (סעיף 19(3א), עמדה 06/26) — מותנית בתנאי הסעיף ובניסוח העסקה. בלי זה המס בעסקת ברוטו/מעורבת חל כבר בחתימה.',
  COMPLETION_CLASSIFICATION:
    'סיווג ההשלמה (דירה / קרקע / שירותים) ושיעור מס הרכישה — תלוי בחוזה ובשאלה אם זו תהיה הדירה היחידה שלכם (0% עד כ-8%).',
  NET_TAX_TERMS:
    'שהיזם מתחייב בחוזה לשלם את מס השבח שלכם (בגילום), עם ביטחונות — החבות כלפי רשות המסים נשארת עליכם.',
  LEVY_TERMS: 'שהיזם נושא בהיטל ההשבחה, עם ביטחונות.',
  SECURED_LOAN_OTHER_PROPERTY:
    'הלוואה בשעבוד הדירה הקיימת שלכם (״משכנתא לכל מטרה״) למימון מס השבח וההיטל — בכפוף לאישור הבנק ולשווי הדירה. מימון בנייה רגיל לא מממן מסים.',
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
    'מחוץ למדיניות המשוערת — ניתן לבדוק במשא ומתן: הקומבינציה (לפי שיעור הייחוס של הפרויקט) כבר נותנת לכם דירה שלמה, ולכן צפוי שיוצע לכם קומבינציה מלאה ולא שירותי בנייה.',
  DEVELOPER_POLICY_PER_OWNER_CAP:
    'מחוץ למדיניות המשוערת — ניתן לבדוק במשא ומתן: צפוי שהיזם יגביל שירותי בנייה לדירה אחת לבעל זכויות (המקומות במגרש מוגבלים).',
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
  NEGOTIATION_RANGE: 'טווח משא ומתן: המינימום שלכם מול המקסימום הסביר של היזם',
};

export const AFFORDABILITY_LABELS = {
  fits: 'מתאים',
  fits_with_financing: 'מתאים עם מימון',
  does_not_fit: 'לא מתאים',
  unknown: 'חסר מידע',
} as const;

export const RESILIENCE_LABELS = { robust: 'עומד בתרחיש שמרני', fragile: 'נכשל בתרחיש שמרני' } as const;

export const COMMERCIAL_LABELS = {
  not_required: 'לא תלוי ביזם',
  unverified: 'טרם אומת',
  questionable: 'מוטל בספק',
  negotiable: 'מחוץ למדיניות המשוערת',
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

export type RiskLevel = 'low' | 'medium' | 'high';
export const RISK_LABELS: Record<RiskLevel, string> = { low: 'סיכון נמוך', medium: 'סיכון בינוני', high: 'סיכון גבוה' };

/**
 * One plain risk level for the summary, from three sources: needing a mortgage (+1), failing the conservative
 * scenario (+2), and developer terms in doubt (+1). 0 → low, 1–2 → medium, 3+ → high. An unknown price is not a
 * risk score here — it is stated on the card as "depends on a price".
 */
export function riskLevel(r: StrategyResult): { level: RiskLevel; reasons: string[] } {
  const reasons: string[] = [];
  let points = 0;
  if (r.mortgageRequired > 1) {
    points += 1;
    reasons.push('נדרשת משכנתא');
  }
  if (r.assessment.resilience === 'fragile') {
    points += 2;
    reasons.push('לא עומד בתרחיש שמרני (מחירים נמוכים / ריבית גבוהה / עיכוב)');
  }
  if (r.assessment.commercial === 'questionable') {
    points += 1;
    reasons.push('תלוי בתנאים שהיזם לא בטוח שיסכים להם');
  }
  return { level: points === 0 ? 'low' : points <= 2 ? 'medium' : 'high', reasons };
}

const n2 = (x: number) => new Intl.NumberFormat('he-IL', { maximumFractionDigits: 2 }).format(x);
const apts = (x: number) => (Math.abs(x - 1) < 1e-9 ? 'דירה אחת' : `${n2(x)} דירות`);

/** Two or three lines that say what actually happens in this route, with the owner's own numbers. */
export function plainExplanation(r: StrategyResult, R: number, combinationPct: number): string {
  const p = r.plan;
  const fromComb = p.rightsInCombination * combinationPct;
  const whole = Math.floor(fromComb + 1e-6);
  const frac = Math.max(0, fromComb - whole);
  const k = r.candidate.targetApartments;
  const built = p.apartmentsBuilt;
  const combLine = `בקומבינציה היזם בונה ומוסר לכם ${n2(combinationPct * 100)}% מהזכויות כדירות: ${apts(fromComb)}`;
  switch (r.strategyType) {
    case 'S01':
      return `מוכרים ליזם את כל ${n2(R)} הזכויות ומקבלים כסף. אין דירה ואין משכנתא — הסכום תלוי במחיר שהיזם יציע.`;
    case 'S01M':
      return `מוכרים היום את הקרקע לקונה פרטי. אין דירה ואין משכנתא — המחיר לא ידוע וצריך שומה עדכנית.`;
    case 'S09':
      return `לא חותמים עכשיו. מחכים כשנתיים לאישור התכנית ומוכרים בשוק — בתקווה למחיר גבוה יותר, בסיכון של עיכוב.`;
    case 'S04':
      return `היזם בונה ומוכר את כל הדירות, ואתם מקבלים אחוז מהכנסות המכירה בסוף. אין דירה — הסכום תלוי באחוז שיסוכם ובמחירי המכירה.`;
    case 'S02':
      return `${combLine}.${frac > 0 ? ` ${whole > 0 ? `${apts(whole)} שלמה, ו-` : ''}${n2(frac)} מדירה נשאר כבעלות משותפת — בלי שכירות ובשווי מופחת.` : ''}`;
    case 'S02C':
      return `${combLine}. את החלק שאינו דירה שלמה (${n2(frac)}) היזם קונה מכם בכסף במסירה.`;
    case 'S02P':
      return `${combLine}. את החלק שאינו דירה שלמה (${n2(frac)}) מצרפים לחלקים של בעלים אחרים ל״יחידת סל״ שנמכרת, והכסף מתחלק.`;
    case 'S06':
      return `${combLine}. משלמים ליזם על עוד ${n2(Math.max(0, k - fromComb))} דירה במחיר שוק, ומקבלים ${k === 1 ? 'דירה אחת שלמה' : `${k} דירות שלמות`}.`;
    case 'S11':
      return `${n2(p.rightsInCombination)} זכויות הולכות לקומבינציה, ועל השאר משלמים ליזם רק עלות בנייה ורווח יזמי. כך מגיעים ל${apts(k)} שלמה — זול מקנייה במחיר שוק.`;
    case 'S05':
      return `מוכרים ליזם ${n2(p.rightsSold)} זכויות, ומשלמים לו על בניית ${apts(built)} על הזכויות שנשארות לכם (עלות בנייה ורווח יזמי). התמורה מהמכירה — במחיר שעוד לא ידוע — אמורה לממן את הבנייה.`;
    case 'S03':
      return `משלמים ליזם על בניית ${apts(built)} על הזכויות שלכם (עלות בנייה ורווח יזמי)${p.rightsSold > 1e-6 ? `, ומוכרים לו את היתרה (${n2(p.rightsSold)} זכויות)` : ''}.`;
    case 'S07':
      return `משלמים ליזם על בניית ${apts(built)} על הזכויות שלכם, ובמסירה מוכרים אחת כדי להחזיר את רוב החוב.`;
    case 'S08':
      return `משלמים ליזם על בניית ${apts(built)} ומשכירים. שכר הדירה עוזר להחזיר את המשכנתא.`;
    case 'S10':
      return `קונים ${n2(p.rightsPurchased)} זכויות מבעלים אחרים, ומשלמים ליזם על בניית ${apts(built)}.`;
    default:
      return STRATEGY_DESCRIPTIONS[r.strategyType];
  }
}
