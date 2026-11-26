import { computeSimulationTracks, computeTableRights } from '../../utils/simulationMath';
import { formatCurrency, formatNumber } from '../../utils/format';

const EXAMPLE_AREA = 167;

function ProsCons({ pros, cons }) {
  return (
    <div className="guide-cols">
      <div>
        <h4 className="pos">יתרונות</h4>
        <ul>
          {pros.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
      <div>
        <h4 className="neg">חסרונות</h4>
        <ul>
          {cons.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Example({ rows }) {
  return (
    <table className="kv-table">
      <tbody>
        {rows.map(([label, value, cls]) => (
          <tr key={label} className={cls}>
            <th scope="row">{label}</th>
            <td>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** מדריך המסלולים. הדוגמאות מחושבות חי לפי הגרסה, המגרש וההגדרות הנוכחיים. */
export function Guide({ version, lotId, config }) {
  const rights = computeTableRights(EXAMPLE_AREA, version.id, lotId, config.bettermentLevyPct);
  const t = computeSimulationTracks(EXAMPLE_AREA, rights, { ...config, sqmPerUnitOverride: null });
  const soldPct = Math.round(t.combination.soldPortion * 100);
  const exampleTitle = `דוגמה: ${EXAMPLE_AREA} מ״ר, מגרש ${rights.lot.id} (${version.shortLabel}) — ${formatNumber(t.units, 2)} יח״ד`;

  return (
    <details className="card guide">
      <summary>
        <span>
          מדריך: איך קוראים את הטבלה ואיך עובד כל מסלול
          <span className="summary-sub">מושגים, יתרונות וחסרונות, ודוגמה מחושבת ל-167 מ״ר</span>
        </span>
      </summary>

      <section>
        <h3>טבלת האיזון וההקצאה</h3>
        <p>
          בתכנית איחוד וחלוקה כל החלקות מאוחדות ומחולקות מחדש למגרשים. השמאי מעריך את שווי החלקה{' '}
          <strong>במצב הנכנס</strong> (לפני התכנית), וכל בעל זכויות מקבל במצב היוצא חלק במגרש בשווי יחסי
          זהה. בחלקה 33 כל 167 מ״ר מקבלים {rights.lot.shareLabel} ממגרש {rights.lot.id}, שבו{' '}
          {formatNumber(rights.lot.units, 0)} יח״ד — כלומר {formatNumber(rights.units, 2)} זכויות רעיוניות לדירה.
        </p>
        <p>
          שווי השמאי ({version.proposedValueNote}) משמש רק לאיזון בין הבעלים. הוא נמוך ממחיר השוק כי הוא
          שווי קרקע, אחרי מקדמי מושע ומיקום, ולא שווי דירה גמורה.
        </p>
      </section>

      <section>
        <h3>מושגי יסוד</h3>
        <div className="guide-cols">
          <div>
            <h4>היטל השבחה</h4>
            <p>
              50% מעליית שווי הקרקע בעקבות התכנית. בסימולטור: {config.bettermentLevyPct}% × (שווי הזכויות − שווי
              במצב הנכנס). בקומבינציה ובתמורות היזם משלם; בעלות+ אתם; במזומן מנוכה מהמחיר.
            </p>
          </div>
          <div>
            <h4>מס שבח</h4>
            <p>
              מס על מכירת זכויות. חל על החלק שנמכר ליזם בקומבינציה ({soldPct}%) ועל כל המכירה במזומן. אין
              מכר בעלות+ ובתמורות. ברירת מחדל {config.capitalGainsTax}%.
            </p>
          </div>
          <div>
            <h4>מע״מ</h4>
            <p>
              בשירותי בנייה משלמים מע״מ ({config.vatRate}%) על עלות הבנייה והעמלה. בקומבינציה ובתמורות אין
              תשלום מע״מ מצד הבעלים.
            </p>
          </div>
          <div>
            <h4>מושע</h4>
            <p>
              בעלות משותפת בדירה אחת. קורה כשמספר הדירות שמגיע לכם אינו שלם — למשל{' '}
              {formatNumber(t.combination.finishedUnits, 2)} דירות בקומבינציה.
            </p>
          </div>
        </div>
      </section>

      <section>
        <h3>קומבינציה ({config.combinationPct}%)</h3>
        <p>
          מוכרים ליזם {soldPct}% מהזכויות, והוא בונה ומוסר לכם {config.combinationPct}% מהן כדירות מוגמרות.
          אחוז הקומבינציה נקבע בהסכם עם היזם. ההצעות הקיימות ניתנו לפי הגרסה המופקדת (מגרש 44, כ-1.5 יח״ד
          לכל 167 מ״ר); בעדכון 106(ב) קיבלה חלקה 33 מגרשים אחרים בתמורה — 149, 150 ו-153 — עם כ-2.4 יח״ד
          לכל 167 מ״ר, ולכן ייתכן שהאחוז יתעדכן.
        </p>
        <ProsCons
          pros={['אין צורך בהון עצמי', 'היזם משלם את היטל ההשבחה', 'דירה מוגמרת ללא ניהול בנייה']}
          cons={['מס שבח על החלק שנמכר', 'סכנת מושע', `מקבלים רק ${config.combinationPct}% מהזכויות`]}
        />
        <Example
          rows={[
            [exampleTitle, ''],
            ['דירות מוגמרות', formatNumber(t.combination.finishedUnits, 2)],
            ['שווי הדירות', formatCurrency(t.combination.totalValue)],
            [`מס שבח (${config.capitalGainsTax}%)`, `−${formatCurrency(t.combination.capitalGainsTax)}`],
            ['שווי נטו', formatCurrency(t.combination.profit), 'row-total'],
          ]}
        />
      </section>

      <section>
        <h3>שירותי בנייה (עלות+)</h3>
        <p>
          מתקשרים עם יזם שבונה בעבורכם תמורת עמלה ({config.entrepreneurMarkup}% מעלות הבנייה) ומקבלים את כל
          הדירות. עלות הבנייה ({formatCurrency(config.costPerSqm)} למ״ר) היא לפני מע״מ.
        </p>
        <ProsCons
          pros={['100% מהזכויות נשארות שלכם', 'אין מס שבח (אין מכר)', 'נהנים מכל עליית הערך של הדירות']}
          cons={['הון עצמי ומימון בנקאי', 'חשיפה לעלויות הבנייה ולוחות הזמנים', 'משלמים מע״מ והיטל השבחה']}
        />
        <Example
          rows={[
            [exampleTitle, ''],
            ['עלות ליח״ד (כולל מע״מ וחלק בהיטל)', formatCurrency(t.costPlus.costPerUnit)],
            ['השקעה כוללת', `−${formatCurrency(t.costPlus.totalEquityRequired)}`],
            ['שווי שוק של הדירות', formatCurrency(t.costPlus.totalMarketValue)],
            ['רווח נטו', formatCurrency(t.costPlus.profit), 'row-total'],
          ]}
        />
      </section>

      <section>
        <h3>תמורות ({config.revenueSharePct}%)</h3>
        <p>היזם בונה ומממן, ואתם מקבלים אחוז מהכנסות המכירה של היחידות שנבנו על הזכויות שלכם.</p>
        <ProsCons
          pros={['אין הון עצמי', 'משתתפים בעליית מחירים', 'אין מושע']}
          cons={['תלוי במחירי המכירה בפועל', 'מקבלים כסף ולא דירה', 'צריך פיקוח על דיווחי המכירות']}
        />
        <Example
          rows={[
            [exampleTitle, ''],
            ['שווי מכירה כולל', formatCurrency(t.revenueSharing.totalMarketValue)],
            ['תמורה נטו', formatCurrency(t.revenueSharing.profit), 'row-total'],
          ]}
        />
      </section>

      <section>
        <h3>מכירה במזומן</h3>
        <p>
          מוכרים את כל הזכויות. המחיר מחושב לפי מ״ר קרקע בחלקה ({formatCurrency(config.landValuePerSqm)}) ולא לפי
          מספר היחידות, כך שהוא לא משתנה בעקבות שינוי היחידות בטבלה. מנכים היטל השבחה, רווח יזמי ומס שבח.
        </p>
        <ProsCons
          pros={['כסף מיידי וללא סיכון בנייה', 'אין מושע', 'פשוט לביצוע']}
          cons={['התמורה הנמוכה ביותר לרוב', 'מס שבח על כל הסכום', 'לא נהנים מעליית ערך']}
        />
        <Example
          rows={[
            [exampleTitle, ''],
            ['שווי קרקע ברוטו', formatCurrency(t.cashExit.grossLandValue)],
            ['היטל השבחה', `−${formatCurrency(t.cashExit.bettermentLevy)}`],
            [`רווח יזמי (${config.entrepreneurProfitMargin}%)`, `−${formatCurrency(t.cashExit.entrepreneurProfit)}`],
            [`מס שבח (${config.capitalGainsTax}%)`, `−${formatCurrency(t.cashExit.capitalGainsTax)}`],
            ['מזומן נטו', formatCurrency(t.cashExit.netCashAmount), 'row-total'],
          ]}
        />
      </section>

      <section>
        <h3>בקצרה</h3>
        <table className="compare-table">
          <thead>
            <tr>
              <th></th>
              <th>קומבינציה</th>
              <th>עלות+</th>
              <th>תמורות</th>
              <th>מזומן</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>הון עצמי</td>
              <td>מס שבח בלבד</td>
              <td>גבוה</td>
              <td>אין</td>
              <td>אין</td>
            </tr>
            <tr>
              <td>היטל השבחה</td>
              <td>היזם</td>
              <td>אתם</td>
              <td>היזם</td>
              <td>מנוכה</td>
            </tr>
            <tr>
              <td>מקבלים</td>
              <td>דירות</td>
              <td>דירות</td>
              <td>כסף</td>
              <td>כסף</td>
            </tr>
            <tr>
              <td>סיכון</td>
              <td>בינוני</td>
              <td>נמוך</td>
              <td>בינוני</td>
              <td>אפס</td>
            </tr>
          </tbody>
        </table>
      </section>
    </details>
  );
}
