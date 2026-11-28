/**
 * Planning and rights assumptions for מתחם 13 (תכנית 302-1306018), parcel 10027/33.
 * The official allocation-table data stays in parcel33.js; the 2.25 conversion here is a
 * separate, versioned simulation assumption.
 */
import type { DataPoint } from '../domain/types';
import { MAVAT_URL } from './parcel33';

export const RETRIEVED_AT = '2026-11-26';

export const PROJECT = {
  originalAreaSqm: {
    value: 167,
    label: 'בלוק זכויות מקורי בחלקה',
    sourceType: 'official_planning',
    sourceUrl: MAVAT_URL,
    sourceName: 'טבלאות האיזון וההקצאה (106(ב), 23/11/2026)',
    retrievedAt: RETRIEVED_AT,
    verification: 'verified',
    notes: '167/21258 הוא החלק הנפוץ בחלקה 33.',
  },
  apartmentEquivalentsPerBlock: {
    value: 2.25,
    label: 'זכויות לדירה לכל 167 מ״ר',
    sourceType: 'user_assumption',
    retrievedAt: RETRIEVED_AT,
    verification: 'assumed',
    notes:
      'הנחת הסימולציה של איטרציות 1–9. מאיטרציה 10 (החלטת הבעלים) הזכאות היא החלק הרשמי בטבלת ההקצאה: חלקכם בשטח המגורים של המגרש ÷ 100 מ״ר (כ-2.64 ל-167 מ״ר במגרש 149). 2.25 נשמר לבדיקות ההיסטוריות בלבד.',
  },
  apartmentSizeSqm: {
    value: 100,
    label: 'גודל דירה טיפוסית',
    sourceType: 'planning_assumption',
    retrievedAt: RETRIEVED_AT,
    verification: 'assumed',
    notes: 'דירת 4 חדרים. הנחה שמחיר הבנייה חל על מ״ר דירה (כולל חלק יחסי בשטחים משותפים).',
  },
  planningStatus: {
    value: 'עדכון לפי סעיף 106(ב) — טרם אישור סופי',
    label: 'סטטוס תכנוני',
    sourceType: 'official_planning',
    sourceUrl: MAVAT_URL,
    retrievedAt: RETRIEVED_AT,
    verification: 'reported',
    notes: 'הזכויות מוצעות ואינן מוקנות. מימון בנייה אינו זמין בהכרח כעת.',
  },
  horizonYears: {
    value: 10,
    label: 'אופק השוואה',
    sourceType: 'planning_assumption',
    retrievedAt: RETRIEVED_AT,
    verification: 'assumed',
    notes: 'כל המסלולים מושווים לאותה נקודת זמן: 10 שנים מהחתימה.',
  },
} satisfies Record<string, DataPoint<number | string>>;

export const TARGET_LOT_IDS = ['149', '150', '153'];
export const DEFAULT_LOT_ID = '149';
export const PLANNING_VERSION = '106b-2026-11';
