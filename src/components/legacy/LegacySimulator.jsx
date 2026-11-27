import { AdvancedSettings } from './AdvancedSettings';
import { Guide } from './Guide';
import { LandInput } from './LandInput';
import { TableRights } from './TableRights';
import { TrackCards } from './TrackCards';
import { TracksCompare } from './TracksCompare';
import { MAVAT_URL, PARCEL, getVersion } from '../../data/parcel33';
import { useSimulation } from '../../hooks/useSimulation';

/** איפה מוצאים את חלקה 33 בטבלאות המעודכנות — הצעד הראשון בהוראות. */
function findYourselfStep() {
  return (
    <li>
      מצאו את עצמכם בטבלאות:{' '}
      <a href={MAVAT_URL} target="_blank" rel="noreferrer">
        פתחו את אתר התכנית הרשמי (מבא״ת)
      </a>{' '}
      ופתחו את <strong>טבלאות האיזון וההקצאה המעודכנות</strong> (עדכון לפי סעיף 106(ב), נובמבר 2026 — קובץ של 12
      עמודים). בעמודים 2–4 מופיעים בעלי חלקה {PARCEL.parcel}: השבר בחלקה, ובאיזה מגרש (149, 150 או 153) הוקצו לכם
      הזכויות.
    </li>
  );
}

export default function LegacySimulator() {
  const sim = useSimulation(167);
  const version = getVersion(sim.versionId);

  return (
    <div className="legacy">
      <div className="card legacy-intro">
        <h2>השוואה מתקדמת — המחשבון המקורי</h2>
        <p className="card-sub">
          ארבעת המסלולים הקלאסיים לפי טבלת האיזון, עם כל ההנחות לעריכה. החישובים כאן נפרדים ממנוע ״מימוש חכם״
          (למשל: יחידות לפי הטבלה ולא לפי 2.25, ומחיר קרקע מנוכה ברווח יזמי).
        </p>
      </div>
        <div className="card instructions">
          <h2>איך זה עובד? 🙂</h2>
          <ol>
            {findYourselfStep()}
            <li>
              הזינו את השטח שלכם בחלקה במ״ר, או בחרו <strong>״לפי שבר בחלקה״</strong> והקלידו את השבר
              כפי שמופיע בטבלה (למשל 167/21258).
            </li>
            <li>בחרו את המגרש שהוקצה לכם — נחשב את החלק במגרש, מספר היחידות ושווי הזכויות.</li>
            <li>
              למטה מוצגים ארבעה מסלולים (קומבינציה, עלות+, תמורות ומזומן). את הנחות השוק אפשר לשנות
              ב<strong>הגדרות המתקדמות</strong>.
            </li>
            <li>
              כל החישובים לפי הטבלאות המעודכנות (עדכון לפי סעיף 106(ב), נובמבר 2026). השטח במ״ר (למשל 167 מ״ר) הוא
              רק דרך נוחה לתאר את החלק שלכם בחלקה המקורית.
            </li>
          </ol>
        </div>

        <LandInput
          landArea={sim.landArea}
          onLandAreaChange={sim.setLandArea}
          version={version}
          lotId={sim.lotId}
          onLotChange={sim.setLotId}
        />

        <TableRights rights={sim.rights} version={version} tracks={sim.tracks} />

        <TrackCards tracks={sim.tracks} config={sim.config} landArea={sim.landArea} />

        <TracksCompare tracks={sim.tracks} />

        <AdvancedSettings
          config={sim.config}
          updateConfig={sim.updateConfig}
          resetToDefaults={sim.resetToDefaults}
          marketValuePerApartment={sim.tracks.marketValuePerApartment}
          tableSqmPerUnit={sim.rights.sqmPerUnit}
        />

        <Guide version={version} lotId={sim.lotId} config={sim.config} />
    </div>
  );
}
