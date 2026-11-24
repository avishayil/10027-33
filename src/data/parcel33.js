/**
 * נתוני גוש 10027 חלקה 33 מתוך טבלאות האיזון וההקצאה של תכנית 302-1306018 (מתחם 13, חדרה).
 *
 * הנתונים הוקלדו ידנית מהמסמכים הרשמיים, ללא שמות או מספרי זהות.
 * נתוני המגרשים זהים לטבלאות המגרשים שאומתו מול שורות הסיכום בפרויקט compound-13-tables
 * (public/data/v1|v2/plots.csv).
 */

/** מכנה "חלק שלם" בחלקה — 167/21258 הוא החלק הנפוץ בחלקה (55 שורות בטבלה). */
export const BASE_SHARE_AREA = 167;

export const PARCEL = {
  gush: 10027,
  parcel: 33,
  /** שטח רשום ונכלל באיחוד וחלוקה (מ״ר) — זהה בשתי הגרסאות. */
  area: 21258,
};

export const MAVAT_URL = 'https://mavat.iplan.gov.il/SV4/1/3005361928/310';

export const VERSIONS = {
  v1: {
    id: 'v1',
    label: 'מופקדת (יוני 2026)',
    shortLabel: 'מופקדת',
    date: '09/06/2026',
    /** שווי החלקה במצב הנכנס (₪) — עקרונות, עמ׳ 59. */
    incomingValue: 25389630,
    /** שווי למ״ר של מגורים בייעוד המגרשים המוקצים (₪ למ״ר מבונה אקוויוולנטי) — עקרונות, עמ׳ 66. */
    proposedValueNote: '₪4,500 למ״ר מבונה אקוויוולנטי (דירה של 110 מ״ר)',
    lots: [
      {
        id: '44',
        area: 4456,
        use: 'מגורים מסחר ותעסוקה',
        residentialArea: 17826,
        units: 160,
        value: 80810000,
        /** חלק במגרש עבור 167 מ״ר בחלקה (9/1000) — עקרונות, עמ׳ 69–70. */
        sharePer167: 9 / 1000,
        shareLabel: '9/1000',
      },
    ],
    sourceNote:
      'עקרונות לעריכת הטבלאות (חתום להפקדה), טבלת ההקצאה בעמ׳ 69–70, שורות 50–183.',
    lotsNote:
      'בגרסה המופקדת רוב בעלי החלקה קיבלו חלק במגרש 44. חלק מבעלי חצי-חלק (167/42516) קיבלו במקומו חלקים במגרשים 127 ו-152 — הסימולטור מציג את מגרש 44 כמייצג.',
  },
  v2: {
    id: 'v2',
    label: 'עדכון לפי סעיף 106(ב) (נובמבר 2026)',
    shortLabel: 'עדכון 106(ב)',
    date: '23/11/2026',
    /** שווי החלקה במצב הנכנס (₪) — עקרונות מעודכנים, עמ׳ 89 (מקדם שפ״פ עלה מ-0.25 ל-0.3). */
    incomingValue: 25521300,
    proposedValueNote: "₪4,100 למ״ר במגורים ד' (דירת 4 חדרים)",
    lots: [
      {
        id: '149',
        area: 2000,
        use: "מגורים ד'",
        residentialArea: 11209,
        units: 102,
        value: 30360000,
        sharePer167: 2353 / 100000,
        shareLabel: '2353/100000',
      },
      {
        id: '150',
        area: 2001,
        use: "מגורים ד'",
        residentialArea: 10541,
        units: 96,
        value: 30360000,
        sharePer167: 2353 / 100000,
        shareLabel: '2353/100000',
      },
      {
        id: '153',
        area: 2092,
        use: "מגורים ד'",
        residentialArea: 11045,
        units: 100,
        value: 30210000,
        sharePer167: 2365 / 100000,
        shareLabel: '2365/100000',
      },
    ],
    sourceNote:
      'טבלאות האיזון וההקצאה המעודכנות (23/11/2026, 12 עמ׳), עמ׳ 2–4, שורות 71–204.',
    lotsNote:
      'בעדכון כל בעל זכויות בחלקה קיבל מגרש אחד בלבד: 149, 150 או 153 (מגורים ד׳). בכל מגרש גם 325 מ״ר מבני ציבור שנבנים ומועברים לעירייה.',
  },
};

export const VERSION_IDS = ['v2', 'v1'];
export const DEFAULT_VERSION = 'v2';

export function getVersion(versionId) {
  const version = VERSIONS[versionId];
  if (!version) throw new Error(`גרסה לא מוכרת: ${versionId}`);
  return version;
}

export function getLot(versionId, lotId) {
  const version = getVersion(versionId);
  return version.lots.find((l) => l.id === lotId) ?? version.lots[0];
}
