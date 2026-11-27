/**
 * נתוני גוש 10027 חלקה 33 מתוך טבלאות האיזון וההקצאה של תכנית 302-1306018 (מתחם 13, חדרה).
 *
 * הנתונים הוקלדו ידנית מהמסמכים הרשמיים, ללא שמות או מספרי זהות.
 * נתוני המגרשים זהים לטבלאות המגרשים שאומתו מול שורות הסיכום בפרויקט compound-13-tables
 * (public/data/v2/plots.csv).
 *
 * רק הטבלאות המעודכנות (עדכון לפי סעיף 106(ב), 23/11/2026) בלבד.
 */

/** מכנה "חלק שלם" בחלקה — 167/21258 הוא החלק הנפוץ בחלקה (55 שורות בטבלה). */
export const BASE_SHARE_AREA = 167;

export const PARCEL = {
  gush: 10027,
  parcel: 33,
  /** שטח רשום ונכלל באיחוד וחלוקה (מ״ר). */
  area: 21258,
};

export const MAVAT_URL = 'https://mavat.iplan.gov.il/SV4/1/3005361928/310';

export const VERSIONS = {
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
        // Plan provisions Table 5 (appraisal pp.30–32): built areas above / below the determining entrance, extra
        // balcony area, floors above ground, height (m).
        aboveGroundArea: 14269,
        undergroundArea: 4770,
        balconyArea: 1530,
        floors: 20,
        heightM: 72,
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
        aboveGroundArea: 13421,
        undergroundArea: 4500,
        balconyArea: 1440,
        floors: 20,
        heightM: 72,
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
        aboveGroundArea: 14045,
        undergroundArea: 4680,
        balconyArea: 1500,
        floors: 20,
        heightM: 72,
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

export const VERSION_IDS = ['v2'];
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
