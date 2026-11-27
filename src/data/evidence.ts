/**
 * Evidence registry (iteration 4). Separates what was observed or appraised from what is assumed.
 *
 * Primary project source: Noy-Levi balance-and-allocation appraisal for plan 302-1306018, 23 Nov 2026
 * ("עקרונות לעריכת טבלת ההקצאה והאיזון וטבלאות", 106(ב) update), Mavat plan page. The figures below were
 * transcribed by the independent review (iteration 4) with page references; they have NOT yet been re-checked
 * against the document in this repository — verify before relying on them. No personal data is included.
 */

export type EvidenceLevel =
  | 'observedTransaction'
  | 'planningAppraisal'
  | 'confirmedOffer'
  | 'marketEstimate'
  | 'scenario'
  | 'unknown';

export const EVIDENCE_LABELS: Record<EvidenceLevel, string> = {
  observedTransaction: 'עסקה מדווחת',
  planningAppraisal: 'שמאות תכנונית',
  confirmedOffer: 'הצעה מאושרת',
  marketEstimate: 'אומדן שוק',
  scenario: 'תרחיש',
  unknown: 'לא ידוע',
};

export const APPRAISAL_SOURCE = {
  name: 'שמאות האיזון וההקצאה (נוי-לוי), תכנית 302-1306018, עדכון 106(ב)',
  date: '2026-11-23',
  url: 'https://mavat.iplan.gov.il/SV4/1/3005361928/310',
  note: 'נתונים הועתקו מסקירה בלתי תלויה עם הפניות לעמודים; טרם אומתו מול המסמך במאגר.',
};

export interface LandTransaction {
  parcel: number;
  date: string;
  areaSqm: number;
  price: number;
  source: string;
  page?: number;
  note?: string;
}

/**
 * Reported land transactions inside מתחם 13 (not individually reconciled with Tax Authority records).
 * Excluded pending verification: an 08/07/2025 deal with no reliable area, and two ₪235,000/167 m² rows on
 * p.63 dated 02/08/2024 and 02/08/2026 (possible duplicate / date error).
 */
export const LAND_TRANSACTIONS: LandTransaction[] = [
  { parcel: 33, date: '2026-04-16', areaSqm: 167, price: 300000, source: 'LandCheck; שמאות עמ׳ 63', page: 63 },
  { parcel: 33, date: '2025-11-19', areaSqm: 167, price: 400000, source: 'LandCheck; שמאות עמ׳ 63', page: 63 },
  { parcel: 33, date: '2025-06-23', areaSqm: 167, price: 320000, source: 'LandCheck; שמאות עמ׳ 63', page: 63 },
  { parcel: 33, date: '2025-04-27', areaSqm: 167, price: 340000, source: 'LandCheck; שמאות עמ׳ 63', page: 63 },
  { parcel: 33, date: '2025-04-10', areaSqm: 167, price: 320000, source: 'LandCheck; שמאות עמ׳ 63', page: 63 },
  { parcel: 33, date: '2025-04-10', areaSqm: 167, price: 305000, source: 'LandCheck; שמאות עמ׳ 63', page: 63 },
  { parcel: 33, date: '2024-10-01', areaSqm: 167, price: 275000, source: 'LandCheck; שמאות עמ׳ 63', page: 63 },
  { parcel: 33, date: '2024-08-26', areaSqm: 167, price: 230000, source: 'LandCheck; שמאות עמ׳ 63', page: 63 },
  { parcel: 33, date: '2024-08-20', areaSqm: 167, price: 170000, source: 'LandCheck; שמאות עמ׳ 63', page: 63 },
  { parcel: 33, date: '2024-07-07', areaSqm: 167, price: 250000, source: 'LandCheck; שמאות עמ׳ 63', page: 63 },
  { parcel: 33, date: '2024-06-27', areaSqm: 334, price: 450000, source: 'LandCheck; שמאות עמ׳ 63', page: 63 },
  { parcel: 32, date: '2026-05-24', areaSqm: 83, price: 566400, source: 'LandCheck / Zips', note: 'מקורות חלוקים על השטח (79/83 מ״ר)' },
  { parcel: 32, date: '2026-05-31', areaSqm: 83, price: 684400, source: 'LandCheck / Zips' },
  { parcel: 32, date: '2026-04-13', areaSqm: 79, price: 507400, source: 'LandCheck / Zips' },
  { parcel: 43, date: '2026-06-09', areaSqm: 72, price: 450000, source: 'LandCheck / Zips' },
  { parcel: 65, date: '2026-04-20', areaSqm: 143, price: 520200, source: 'LandCheck / Zips' },
  { parcel: 74, date: '2026-08-20', areaSqm: 70, price: 690000, source: 'LandCheck / Zips' },
];

export const TRANSACTION_SOURCES = [
  { name: 'LandCheck — מתחם 13', url: 'https://land-check.co.il/mitcham/hadera-mitcham-13' },
  { name: 'Zips — גוש 10027', url: 'https://zips.co.il/קרקעות/חדרה/גוש-10027' },
  { name: 'רשות המסים — מידע נדל״ן (לאימות)', url: 'https://www.gov.il/he/service/real_estate_information' },
];

export interface ApartmentComparable {
  rooms: number;
  areaSqm: number;
  averagePrice: number;
  count: number;
  project: string;
  page: number;
}

/** Comparable-project averages by apartment type (appraisal pp.69, 73). Averages, not individual sales. */
export const APARTMENT_COMPARABLES: ApartmentComparable[] = [
  { rooms: 3, areaSqm: 79, averagePrice: 2024309, count: 2, project: 'מגדלי החמש', page: 69 },
  { rooms: 4, areaSqm: 100, averagePrice: 2331841, count: 7, project: 'מגדלי החמש', page: 69 },
  { rooms: 5, areaSqm: 120, averagePrice: 2593285, count: 3, project: 'מגדלי החמש', page: 69 },
  { rooms: 3, areaSqm: 83, averagePrice: 2360282, count: 20, project: 'פרויקט השוואה נוסף', page: 73 },
  { rooms: 4, areaSqm: 103, averagePrice: 2683259, count: 23, project: 'פרויקט השוואה נוסף', page: 73 },
  { rooms: 5, areaSqm: 124, averagePrice: 2984968, count: 7, project: 'פרויקט השוואה נוסף', page: 73 },
];

/** Individual 4-room sales quoted in the appraisal (pp.69, 73). */
export const APARTMENT_SALES = [
  { date: '2026-01-06', project: 'מגדלי החמש', areaSqm: 99, price: 2352089, page: 69 },
  { date: '2026-04-30', project: 'מגדלי החמש', areaSqm: 99, price: 2356980, page: 69 },
  { date: '2026-05-18', project: 'מגדלי החמש', areaSqm: 100, price: 2256980, page: 69 },
  { date: '2026-07-29', project: 'מגדלי החמש', areaSqm: 100, price: 2366980, page: 69 },
  { date: '2026-06-29', project: 'גוש 10403 חלקה 262', areaSqm: 106, price: 2680000, page: 73 },
];

/**
 * Relative value of an apartment type vs the 4-room reference, per comparable project, averaged.
 * Smaller apartments cost MORE per m² — so a 3-room is ~87% of a 4-room's value, not 80%.
 */
export function relativeValueByRooms(rooms: number): { mean: number; low: number; high: number } | null {
  const projects = [...new Set(APARTMENT_COMPARABLES.map((c) => c.project))];
  const ratios = projects
    .map((p) => {
      const ref = APARTMENT_COMPARABLES.find((c) => c.project === p && c.rooms === 4);
      const t = APARTMENT_COMPARABLES.find((c) => c.project === p && c.rooms === rooms);
      return ref && t ? t.averagePrice / ref.averagePrice : null;
    })
    .filter((x): x is number => x !== null);
  if (!ratios.length) return null;
  return { mean: ratios.reduce((s, x) => s + x, 0) / ratios.length, low: Math.min(...ratios), high: Math.max(...ratios) };
}

/** Other appraisal figures (pp.95–97). Units matter: none of these is an apartment sale price. */
export const APPRAISAL_FIGURES = {
  equivalentBuiltRightValueResidentialD: { value: 4100, unit: '₪ למ״ר מבונה אקוויוולנטי (מגורים ד׳)', page: 96 },
  equivalentBuiltRightValueResidentialC: { value: 4800, unit: '₪ למ״ר מבונה אקוויוולנטי (מגורים ג׳)', page: 96 },
  publicShellConstructionPerSqm: { value: 8000, unit: '₪ למ״ר מבנה ציבור ברמת מעטפת, כולל מע״מ', page: 97 },
  serviceAreaPerUnit: { value: 30, unit: 'מ״ר שטחי שירות ליח״ד במגורים ד׳ (ללא ממ״ד)', page: 95 },
  publicBuildingPerLotSqm: { value: 325, unit: 'מ״ר מבני ציבור בכל אחד מהמגרשים 149/150/153', page: 0 },
};

/** Facts observed on official sites (not forecasts). */
export const OFFICIAL_FACTS = [
  { label: 'ריבית בנק ישראל (23.11.2026)', value: '3.25%', note: 'אינה ריבית משכנתא', url: 'https://www.boi.org.il/' },
  { label: 'נתוני ריביות משכנתאות — עדכון אחרון', value: '11.11.2026', note: 'ריבית אפקטיבית; 5% במחשבון הוא תרחיש', url: 'https://www.boi.org.il/information/interestrates/mortgage/' },
  { label: 'מדד תשומות הבנייה — אוקטובר 2026', value: '104.4 (+0.4%)', note: 'בסיס יולי 2025; 3% בשנה במחשבון הוא תרחיש', url: 'https://www.cbs.gov.il/' },
];
