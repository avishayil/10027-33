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
    value: 2,
    label: 'מועד תשלום היזם על זכויות שנמכרו לו',
    sourceType: 'planning_assumption',
    retrievedAt: RETRIEVED_AT,
    verification: 'assumed',
    notes: 'הסכם מותנה באישור התכנית: התשלום, ההיטל ומס השבח — במועד האישור (כשנתיים). המערכת מחשבת גם את המועד המאוחר ביותר שעדיין מתאים לכם.',
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
  workInProgressRecognition: {
    value: 0.8,
    label: 'הכרת הבנק בסכומים ששולמו לבנייה כבטוחה (לפני מסירה)',
    sourceType: 'planning_assumption',
    retrievedAt: RETRIEVED_AT,
    verification: 'assumed',
    notes: 'סכומים ששולמו אינם שווי שמאי אוטומטי; מניחים הכרה חלקית. בפועל לפי שמאות הבנק ושלב הבנייה.',
  },
  noServicesWhenCombinationYieldsWhole: {
    value: 1,
    label: 'אין שירותי בנייה למי שהקומבינציה כבר נותנת לו דירה שלמה',
    sourceType: 'planning_assumption',
    retrievedAt: RETRIEVED_AT,
    verification: 'assumed',
    notes: 'זכויות × אחוז קומבינציה ≥ 1 (כ-2.86 זכויות ב-35%, כ-3 זכויות לבעלים של כ-220 מ״ר) → צפויה קומבינציה מלאה.',
  },
  taxArrangementHeadline: {
    value: 'mixed',
    label: 'הסדר המסים בקומבינציה שעליו מבוססת ההמלצה הראשית',
    sourceType: 'secondary_market',
    sourceName: 'מדריכי מיסוי של משרדי עו״ד; סקר משרד הבינוי',
    sourceUrl: 'https://www.gov.il/BlobFolder/reports/r1060_moch/he/r1060.pdf',
    retrievedAt: '2026-11-27',
    verification: 'reported',
    notes:
      'שלושה הסדרים קיימים: ברוטו (הבעלים משלמים היטל ומס שבח), מעורב (היזם משלם את ההיטל), נטו (היזם משלם את שניהם, בגילום). אין מקור שמראה שנטו הוא הנוהג הגובר; ״מעורב״ נבחר כבסיס כי נשיאת היזם בהיטל מדווחת כנפוצה. המערכת מחשבת את שלושתם ומציגה מה משתנה בכל אחד.',
  },
  contractorProfitRate: {
    value: 0.175,
    label: 'רווח קבלני רגיל בשווי שירותי הבנייה לצורכי מס',
    sourceType: 'court_ruling',
    sourceName: 'ע״א 6672/19 יקותיאלי (2021); הוראת ביצוע 23/98',
    sourceUrl: 'https://www.gov.il/BlobFolder/legalinfo/law6672-19/he/LegalInformation_kesher_6672-19.pdf',
    retrievedAt: '2026-11-27',
    range: { low: 0.15, high: 0.2 },
    verification: 'reported',
    notes:
      'העליון קבע שאין לכלול רווח יזמי (ממכירת הדירות) בשווי המכירה; הוראת ביצוע 23/98 כוללת רווח קבלני מקובל של 15%–20% בעלויות הבנייה. נפרד מהסליידר (המחיר המסחרי) ומרווחיות הפרויקט. דורש אימות של יועץ מס.',
  },
  combinationSaleDate: {
    value: 'approval',
    label: 'יום המכירה לצורכי מס בקומבינציה לפני אישור התכנית',
    sourceType: 'official_rule',
    sourceName: 'סעיף 19(3א) לחוק מיסוי מקרקעין; עמדה מקצועית 06/26 (26.7.2026)',
    sourceUrl: 'https://www.gov.il/he/pages/procedures-260726-1',
    retrievedAt: '2026-11-27',
    verification: 'reported',
    notes:
      'בעסקה שנחתמת לפני אישור התכנית ועומדת בתנאי הסעיף, יום המכירה הוא יום אישור התכנית — ומועדי ההצהרה והתשלום נדחים איתו. לפי עמדה 06/26 (כפי שדווחה במקורות משניים) הדבר חל גם כשהיזם נושא במסי הבעלים. מותנה; הנוסח המלא לא אומת.',
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
} satisfies Record<string, DataPoint<number | string>>;

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
