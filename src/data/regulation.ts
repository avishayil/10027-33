/** Statutory parameters. Rates only — never an individual tax assessment. */
import type { DataPoint } from '../domain/types';
import { RETRIEVED_AT } from './project';

export const REGULATION = {
  bettermentLevyRate: {
    value: 0.5,
    label: 'היטל השבחה',
    sourceType: 'statutory',
    sourceName: 'מינהל התכנון — מדריך היטל השבחה',
    sourceUrl: 'https://www.gov.il/he/pages/bidguide?chapterIndex=2',
    retrievedAt: RETRIEVED_AT,
    verification: 'verified',
    notes: 'מחושב כאן על עליית השווי בטבלת האיזון (קירוב). השומה בפועל של הוועדה המקומית עשויה להיות שונה.',
  },
  vatRate: {
    value: 0.18,
    label: 'מע״מ',
    sourceType: 'statutory',
    sourceName: 'רשות המסים',
    sourceUrl: 'https://www.gov.il/he/pages/vat-history',
    retrievedAt: RETRIEVED_AT,
    verification: 'verified',
  },
  indicativeCapitalGainsRate: {
    value: 0.25,
    label: 'מס שבח (שיעור אינדיקטיבי על הרווח)',
    sourceType: 'statutory',
    sourceUrl: 'https://www.gov.il/he/service/real_eatate_taxsimulator',
    retrievedAt: RETRIEVED_AT,
    verification: 'assumed',
    notes: 'מוחל על הרווח החייב בלבד, לא על התמורה ברוטו. תלוי במועד רכישה, פטורים וניכויים.',
  },
  landPurchaseTaxRate: {
    value: 0.06,
    label: 'מס רכישה על זכויות נוספות',
    sourceType: 'statutory',
    sourceUrl: 'https://www.gov.il/he/service/real_eatate_taxsimulator',
    retrievedAt: RETRIEVED_AT,
    verification: 'reported',
    notes: 'בדרך כלל 6% לקרקע; משתנה לפי זכאות וסוג הנכס.',
  },
  rentalTaxReserve: {
    value: 0.1,
    label: 'רזרבת מס על שכר דירה',
    sourceType: 'statutory',
    sourceName: 'רשות המסים — מסלולי מיסוי שכירות',
    sourceUrl: 'https://www.gov.il/he/pages/detail-tracks-payment-tax-relief-rental-apartments',
    retrievedAt: RETRIEVED_AT,
    verification: 'assumed',
    notes: 'רזרבה שמרנית לפי מסלול 10% מההכנסה ברוטו, עד לבדיקת המסלול המתאים לכם.',
  },
  completionPurchaseTaxAdditional: {
    value: 0.08,
    label: 'מס רכישה על השלמה לדירה — דירה נוספת',
    sourceType: 'official_rule',
    sourceName: 'סימולטור מס רכישה, רשות המסים',
    sourceUrl: 'https://www.gov.il/he/service/real_eatate_taxsimulator',
    retrievedAt: '2026-11-27',
    range: { low: 0, high: 0.08 },
    verification: 'reported',
    notes:
      'חל רק על מה שאתם קונים מהיזם מעבר לתמורה על הקרקע שלכם (השלמה לדירה שלמה / לדירה גדולה יותר) — רכישה חדשה של זכות במקרקעין; מס הרכישה ששולם בעבר על הקרקע לא חל עליה. על הדירות שמתקבלות כתמורה בקומבינציה אין מס רכישה, ועל תשלום שירותי בנייה על קרקע שנשארת שלכם אין מס רכישה. לדירה יחידה בתוך מדרגת הפטור — 0%; לדירה נוספת — כ-8%. כל עוד לא ידוע אם זו דירה יחידה, מחושב 8% שמרני.',
  },
  saleTransactionCostRate: {
    value: 0.02,
    label: 'עלויות עסקה במכירה (עו״ד ותיווך)',
    sourceType: 'planning_assumption',
    retrievedAt: RETRIEVED_AT,
    verification: 'assumed',
  },
} satisfies Record<string, DataPoint<number>>;
