/** Commercial and construction assumptions. Developer-controlled terms are scenarios. */
import type { DataPoint, PaymentMilestone } from '../domain/types';
import { RETRIEVED_AT } from './project';

export const COMBINATION_RANGE = { min: 0.3, max: 0.4, default: 0.35 };
export const MARKUP_RANGE = { min: 0.15, max: 0.2, default: 0.175 };

export const COMMERCIAL = {
  constructionCostPerSqm: {
    value: 11000,
    label: 'עלות בנייה ישירה למ״ר (לפני מע״מ)',
    sourceType: 'user_assumption',
    retrievedAt: RETRIEVED_AT,
    verification: 'assumed',
    notes: 'מניחים שהמחיר חל על מ״ר דירה וכולל חלק יחסי בשטחים משותפים, חניה ומרתף. היקף הכיסוי טעון אישור.',
  },
  contingency: {
    value: 0.1,
    label: 'רזרבה לבלתי צפוי',
    sourceType: 'planning_assumption',
    retrievedAt: RETRIEVED_AT,
    verification: 'assumed',
    notes: 'בתרחיש החריגה (15%) הרזרבה נצרכת — לא נספרת פעמיים.',
  },
  annualIndexation: {
    value: 0.03,
    label: 'הצמדה שנתית למדד תשומות הבנייה',
    sourceType: 'planning_assumption',
    sourceName: 'הלמ״ס — מדד תשומות בבנייה למגורים',
    sourceUrl: 'https://www.cbs.gov.il',
    retrievedAt: RETRIEVED_AT,
    range: { low: 0.01, high: 0.05 },
    verification: 'assumed',
    notes: 'המדד עלה 0.4% באוקטובר 2026. 3% בשנה הוא תרחיש — לא תחזית הלמ״ס.',
  },
  durationYears: {
    value: 5,
    label: 'משך הפרויקט עד מסירה',
    sourceType: 'planning_assumption',
    retrievedAt: RETRIEVED_AT,
    range: { low: 3, high: 8 },
    verification: 'assumed',
  },
  revenueShare: {
    value: 0.45,
    label: 'אחוז תמורות מהכנסות המכירה',
    sourceType: 'developer_offer',
    retrievedAt: RETRIEVED_AT,
    verification: 'assumed',
    notes: 'הנחה לא מאומתת מהצעה קודמת (לפני עדכון 106(ב)).',
  },
  developerPaymentYear: {
    value: 0.5,
    label: 'מועד תשלום היזם על זכויות עודפות',
    sourceType: 'planning_assumption',
    retrievedAt: RETRIEVED_AT,
    verification: 'assumed',
    notes: 'חצי שנה מהחתימה. המערכת מחשבת גם את המועד המאוחר ביותר שעדיין מתאים לכם.',
  },
  completionPriceFactor: {
    value: 1,
    label: 'מחיר השלמה לדירה שלמה (ביחס לשווי שוק)',
    sourceType: 'planning_assumption',
    retrievedAt: RETRIEVED_AT,
    verification: 'assumed',
    notes: 'שמרני: היזם מוכר את החלק החסר במחיר שוק מלא. המערכת מחשבת את הסכום המקסימלי שתוכלו לשלם.',
  },
  servicesCapShareOfLot: {
    value: 0.25,
    label: 'תקרת שירותי בנייה במגרש (מתוך כ-100 יח״ד)',
    sourceType: 'planning_assumption',
    retrievedAt: RETRIEVED_AT,
    range: { low: 0.2, high: 0.3 },
    verification: 'assumed',
    notes:
      'הערכה: יזם יעדיף קומבינציה מלאה (הכי רווחית לו) ויקצה לשירותי בנייה רק 20%–30% מהדירות במגרש, כדי שכל בעל זכויות יוכל להגיע לדירה.',
  },
  maxServiceApartmentsPerOwner: {
    value: 1,
    label: 'מקסימום דירות בשירותי בנייה לבעל זכויות',
    sourceType: 'planning_assumption',
    retrievedAt: RETRIEVED_AT,
    verification: 'assumed',
    notes: 'עם מקומות מוגבלים, כל בעל זכויות יקבל לכל היותר דירה אחת בשירותי בנייה — בדרך כלל הדירה שלו.',
  },
  noServicesWhenCombinationYieldsWhole: {
    value: 1,
    label: 'אין שירותי בנייה למי שהקומבינציה כבר נותנת לו דירה שלמה',
    sourceType: 'planning_assumption',
    retrievedAt: RETRIEVED_AT,
    verification: 'assumed',
    notes: 'זכויות × אחוז קומבינציה ≥ 1 (כ-2.86 זכויות ב-35%, כ-3 זכויות לבעלים של כ-220 מ״ר) → צפויה קומבינציה מלאה.',
  },
  combinationTaxBorneByDeveloper: {
    value: 1,
    label: 'עסקת קומבינציה ״נטו״: היזם נושא במס השבח של הבעלים (כולל גילום)',
    sourceType: 'secondary_market',
    sourceName: 'מדריכי מיסוי של משרדי עו״ד (TASA, גבאי עמיאל, יוני לוי ואחרים)',
    sourceUrl: 'https://tasalaw.co.il/%D7%9E%D7%99%D7%A1%D7%95%D7%99-%D7%A2%D7%A1%D7%A7%D7%AA-%D7%A7%D7%95%D7%9E%D7%91%D7%99%D7%A0%D7%A6%D7%99%D7%94-%D7%94%D7%9E%D7%93%D7%A8%D7%99%D7%9A/',
    retrievedAt: '2026-11-27',
    verification: 'reported',
    notes:
      'לפי הדין החבות במס השבח היא של בעלי הקרקע, אבל בפרקטיקה עסקאות קומבינציה רבות מוגדרות ״נטו״ — היזם מתחייב בחוזה לשלם את מס השבח (בגילום) ולרוב גם את היטל ההשבחה. לא אחיד: יש עסקאות שבהן המסים מתחלקים. החבות כלפי רשות המסים נשארת אצלכם — דרשו ביטחונות בחוזה.',
  },
  approvalYears: {
    value: 2,
    label: 'זמן משוער עד אישור התכנית',
    sourceType: 'planning_assumption',
    retrievedAt: RETRIEVED_AT,
    verification: 'assumed',
    notes: 'אסטרטגיית ההמתנה מוכרת את הזכויות במועד זה בשווי השוק שאחרי האישור.',
  },
  fractionCashSettlementFactor: {
    value: 0.8,
    label: 'פיצוי כספי על חלק מדירה (ביחס לשווי שוק)',
    sourceType: 'planning_assumption',
    retrievedAt: RETRIEVED_AT,
    verification: 'assumed',
    notes: 'אם היזם קונה מכם את השבר במסירה. בפועל נקבע בהסכם.',
  },
  developerDirectCostPerSqm: {
    value: 11000,
    label: 'עלות בנייה ישירה ליזם (מודל צד היזם)',
    sourceType: 'planning_assumption',
    retrievedAt: RETRIEVED_AT,
    verification: 'assumed',
    notes: 'זהה לבסיס של ₪11,000. ייתכן שיזמים בונים בפחות — ואז הקומבינציה סבירה יותר מבחינתם.',
  },
  developerSoftCostRate: {
    value: 0.12,
    label: 'עלויות רכות של היזם (תכנון, אגרות, מימון, שיווק)',
    sourceType: 'planning_assumption',
    retrievedAt: RETRIEVED_AT,
    verification: 'assumed',
    notes: 'כאחוז מעלות הבנייה הישירה.',
  },
  developerTargetMargin: {
    value: 0.15,
    label: 'רווח יזמי נדרש (מההכנסות, ללא מע״מ)',
    sourceType: 'planning_assumption',
    retrievedAt: RETRIEVED_AT,
    verification: 'assumed',
    notes: 'שונה מ״רווח יזמי על הבנייה״ (הסליידר): זה הרווח על הפרויקט כולו.',
  },
} satisfies Record<string, DataPoint<number>>;

/** Illustrative construction payment schedule (planning placeholder, not contract terms). */
export const PAYMENT_SCHEDULE: PaymentMilestone[] = [
  { at: 0, share: 0.1, label: 'חתימת חוזה' },
  { at: 0.4, share: 0.15, label: 'היתר בנייה' },
  { at: 0.5, share: 0.2, label: 'שלד' },
  { at: 0.65, share: 0.2, label: 'שלד ומעטפת' },
  { at: 0.8, share: 0.2, label: 'גמרים' },
  { at: 1, share: 0.15, label: 'מסירה' },
];
export const PERMIT_AT = 0.4;
