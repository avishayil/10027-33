# סימולטור חלקה 33 - ניתוח זכויות בעלי קרקע

## תיאור הפרויקט

אפליקציית React אינטראקטיבית לניתוח וסימולציה של זכויות קרקע בחלקה 33 (מתחם 13, חדרה). בממשק מוצג גם תב״ע 10027 וגם התייחסות לתכנית מפורטת 302-1306018 — יש לאמת מול מקורות רשמיים (ממשל תכנון / ועדה מקומית). המערכת מאפשרת לבעלי קרקע להזין את שטח האדמה שלהם ולקבל ניתוח משוער של 4 מסלולים אפשריים:

1. **שילוב (35%)** - קבלת דירות מוגמרות בשיעור 35% מהזכויות
2. **עלות+ (Cost Plus)** - מימון עצמי של הבנייה מול שמירה על 100% מהזכויות
3. **תמורות (Revenue Sharing)** - שיתוף הכנסות עם היזם
4. **יציאה במזומן** - מכירה מיידית של הזכויות

## תכונות עיקריות

### תכונות בסיסיות
- 🧮 חישוב מדויק של זכויות לפי שטח קרקע
- 📊 השוואה ויזואלית בין 4 מסלולים
- ⚠️ אזהרות על בעיות "מושע" (שותפות בדירה) בקומבינציה
- 📈 גרפים אינטראקטיביים להשוואת רווחיות
- 🎯 תמיכה מלאה בעברית וכיוון RTL
- 📱 עיצוב רספונסיבי לכל המכשירים

### תכונות מתקדמות
- ⚙️ **פאנל הגדרות מתקדמות** - התאמת פרמטרים; כל הכרטיסים והגרף מתעדכנים בזמן אמת
- 🔄 **איפוס להגדרות מקור** - חזרה לפרמטרים ההתחלתיים
- 💡 **נקודת איזון** - מחיר מינימלי למ״ר במסלול שירותי בנייה (לפי המודל)

## טכנולוגיות

- **React 18** - ספריית UI
- **Vite** - Build Tool מהיר
- **Tailwind CSS** - עיצוב וסטיילינג
- **Recharts** - ויזואליזציה של נתונים
- **Lucide React** - אייקונים

## קבועים עסקיים

החישובים הפעילים באפליקציה מרוכזים ב-[`src/utils/simulationMath.js`](src/utils/simulationMath.js) וברירות המחדל ב-[`DEFAULT_CONFIG`](src/hooks/useSimulation.js) בתוך `useSimulation`. שווי דירה מוגמרת נגזר כ־`marketValueSqm × apartmentSizeSqm` (ברירת מחדל: 25,000 × 100 = 2,500,000 ₪).

קובץ [`src/utils/calculations.js`](src/utils/calculations.js) משמש רק את `Simulator.jsx` (לא מחובר ל־`App`) ונשאר לצורך ייחוס היסטורי.

## התקנה והרצה

### דרישות מקדימות

- Node.js (גרסה 18 או גבוהה יותר)
- npm או yarn

### התקנת התלויות

```bash
npm install
```

### הרצה במצב פיתוח

```bash
npm run dev
```

האפליקציה תרוץ בכתובת: http://localhost:5173/

### בנייה לפרודקשן

```bash
npm run build
```

הקבצים המובנים יופיעו בתיקיית `dist/`.

### תצוגה מקדימה של ה-Build

```bash
npm run preview
```

לבדיקת נתיבי נכסים כמו ב-GitHub Pages (אתר פרויקט תחת `/<שם-הריפו>/`):

```bash
VITE_BASE=/plot33-simulator/ npm run build
npm run preview
```

## פרסום ב-GitHub Pages

1. הפוך את הריפו לציבורי (או השתמש ב-GitHub Enterprise עם Pages לפי המדיניות שלך).
2. ב-GitHub: **Settings → Pages → Build and deployment**: מקור **GitHub Actions**.
3. בדחיפה לענף `main` או `master`, ה-workflow [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) מריץ `npm ci` / `npm run build` עם `VITE_BASE=/<repository.name>/` ומעלה את `dist` ל-Pages.
4. לאחר הרצה ראשונה, כתובת האתר תופיע תחת **Settings → Pages** (למשל `https://<user>.github.io/<repo>/`).

## מבנה הפרויקט

```
plot33-simulator/
├── src/
│   ├── components/
│   │   ├── Card.jsx                    # קומפוננטת כרטיס UI
│   │   ├── Progress.jsx                # קומפוננטת פס התקדמות
│   │   ├── Slider.jsx                  # קומפוננטת סליידר מותאמת אישית
│   │   ├── Tooltip.jsx                 # קומפוננטת tooltip
│   │   ├── AdvancedSettings.jsx        # פאנל הגדרות מתקדמות
│   │   ├── Simulator.jsx               # גרסה ישנה (לא בשימוש ב-App)
│   │   └── SimulatorV2.jsx             # סימולטור פעיל
│   ├── content/
│   │   ├── sourcesAndDisclaimer.js     # טקסטים: מקורות, אזהרות
│   │   └── tooltips.js                 # תוכן עזר ל-tooltips
│   ├── hooks/
│   │   └── useSimulation.js            # state + עטיפה על simulationMath
│   ├── utils/
│   │   ├── simulationMath.js           # לוגיקת חישוב מרכזית
│   │   ├── calculations.js             # פורמט + פונקציות legacy
│   │   └── cn.js                       # כלי עזר לעיצוב
│   ├── App.jsx                         # קומפוננטת האפליקציה הראשית
│   ├── App.css                         # סגנונות אפליקציה
│   ├── index.css                       # סגנונות גלובליים + Tailwind
│   └── main.jsx                        # נקודת כניסה
├── index.html                          # HTML ראשי
├── tailwind.config.js                  # הגדרות Tailwind
├── postcss.config.js                   # הגדרות PostCSS
└── package.json                        # תלויות ופקודות
```

## ארכיטקטורה

### useSimulation Hook

הלב של המערכת החדשה הוא custom hook בשם `useSimulation` שמנהל את כל ה-state והחישובים:

```javascript
const simulation = useSimulation(initialLandArea);

// State Management
const { landArea, setLandArea, config, updateConfig } = simulation;

// Calculated Results
const { units, combination, costPlus, revenueSharing, cashExit } = simulation;

// Actions
const { resetToDefaults } = simulation;
```

**יתרונות הגישה:**
- ✅ **Separation of Concerns**: הלוגיקה העסקית מופרדת מה-UI
- ✅ **Real-time Recalculation**: כל שינוי בפרמטר מחשב מחדש את כל התוצאות
- ✅ **Reusability**: ניתן להשתמש ב-hook בכל קומפוננטה
- ✅ **Testability**: קל לבדוק את הלוגיקה העסקית בנפרד
- ✅ **Performance**: שימוש ב-useMemo למניעת חישובים מיותרים

### פרמטרים דינמיים

כל הקבועים הפכו לפרמטרים דינמיים ב-config:

```javascript
{
  combinationPct: 35,
  sqmPerUnit: 110,
  costPerSqm: 11000,
  apartmentSizeSqm: 100,
  entrepreneurMarkup: 14.5,
  vatRate: 18,
  requiredEquityPct: 25,       // אחוז מסך עלות שירותי בנייה כסף עצמי נדרש (בנקאי)
  marketValueSqm: 25000,       // שווי למ״ר; שווי דירה = × apartmentSizeSqm
  landValuePerUnit: 760000,    // ברוטו ליחידת זכות במסלול מזומן; היטל מנוכה בנפרד
  entrepreneurProfitMargin: 18,
  bettermentLevyPerUnit: 160000,
  capitalGainsTax: 25,
  revenueSharePct: 45,
}
```

## תכונות מתקדמות

### אזהרת מושע

המערכת מזהה אוטומטית מצבים שבהם בעל הקרקע יהיה שותף לדירה (מושע) ומציגה אזהרה ברורה.

### ניתוח מס

המערכת כוללת הסברים על:
- מס רווח הון (מס שבח)
- היטל השבחה
- הבדלים בין המסלולים במיסוי

## שימוש

### שימוש בסיסי
1. הזן את שטח הקרקע שלך במ"ר
2. לחץ על אחד מהכפתורים המהירים (167, 334, 501) או הזן ערך ידנית
3. צפה בניתוח המפורט של כל ארבעת המסלולים
4. השווה בין המסלולים באמצעות הגרפים והכרטיסים

### שימוש מתקדם - פאנל ההגדרות

1. **פתיחת הפאנל**: לחץ על כפתור ההגדרות (⚙️) בפינה השמאלית העליונה
2. **שינוי פרמטרים**: התאם את הפרמטרים לפי הצורך:
   - **קבועי פרויקט**: אחוז שילוב, מ"ר ליחידה, היטל השבחה
   - **בנייה**: עלות בנייה למ"ר, דמי יזם
   - **מימון**: אחוז הון עצמי נדרש (מוצג בכרטיס שירותי בנייה כסף עצמי משוער לעומת סך עלות)
   - **שוק**: שווי שוק למ"ר, רווח יזמי, אחוז תמורות
   - **מיסוי**: מס רווח הון
3. **צפייה בשינויים**: כל השינויים מתעדכנים בזמן אמת
4. **איפוס**: לחץ על "איפוס להגדרות מקוריות" לחזרה לפרמטרים ההתחלתיים

## התאמה אישית

### עדכון קבועים

ניתן לעדכן את ברירות המחדל ב־`DEFAULT_CONFIG` בקובץ [`src/hooks/useSimulation.js`](src/hooks/useSimulation.js) או להוסיף לוגיקה ב־[`src/utils/simulationMath.js`](src/utils/simulationMath.js).

### שינוי צבעים ועיצוב

עדכן את הצבעים ב-`tailwind.config.js`:

```javascript
theme: {
  extend: {
    colors: {
      primary: { /* צבעים */ },
      gold: { /* צבעים */ },
    },
  },
}
```

## אזהרות חשובות

> ⚠️ **שים לב**: הנתונים המוצגים הם אומדנים בלבד ואינם מהווים ייעוץ משפטי או פיננסי. יש להתייעץ עם יועץ מקצועי לפני קבלת החלטות.

## רישיון

MIT License - ראה קובץ LICENSE לפרטים נוספים.

## תמיכה

לשאלות או בעיות, אנא פתח Issue בגיטהאב.
