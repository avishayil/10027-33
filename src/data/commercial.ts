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
