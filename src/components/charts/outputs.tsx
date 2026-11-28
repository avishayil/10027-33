/**
 * Visuals for each output (V1). Every chart sits beside the table or list that holds the same numbers (its table
 * view), reads the same result object, and uses the chart kit's rules. Owner = blue, developer = orange.
 */
import { PROJECT_CONFIG } from '../../data/config';
import { rightsAllocation, type RightsDestination } from '../../domain/rightsAllocation';
import type { DecisionResult, StrategyResult } from '../../domain/types';
import type { JointResult } from '../../optimizer/joint/search';
import type { DiffLine } from '../../optimizer/offer';
import type { RequestItem } from '../../optimizer/negotiation';
import type { ConcessionRow } from '../../optimizer/concessions';
import { formatCompactCurrency, formatNumber } from '../../utils/format';
import { BarList, C, DotRange, Figure, LineChart, Meter, PairedBars, RangeAxis, SegmentedBar, SERIES, Waterfall, type BarRow } from './Charts';

const money = (x: number) => formatCompactCurrency(x);
const signed = (x: number) => (x < 0 ? `−${money(-x)}` : money(x));
const rights = (x: number) => `${formatNumber(x, 2)} זכויות`;

/** Fixed colour per destination (the validated categorical order), never by rank. */
export const DEST_COLORS: Record<RightsDestination, string> = {
  combination: SERIES[0],
  sold_developer: SERIES[1],
  sold_open_market: SERIES[2],
  sold_after_approval: SERIES[3],
  built: SERIES[4],
  revenue_share: SERIES[5],
  held: SERIES[6],
};

/** Where every land right of the route goes — the parts add up to the entitlement (+ rights bought). */
export function RightsFlow({ r, entitlement, tall = true, title = 'לאן הולכות הזכויות שלכם' }: { r: StrategyResult; entitlement: number; tall?: boolean; title?: string }) {
  const a = rightsAllocation(r, entitlement);
  return (
    <Figure
      title={title}
      sub={`כל ${formatNumber(a.total, 2)} הזכויות${a.bought > 1e-9 ? ` (${formatNumber(entitlement, 2)} שלכם + ${formatNumber(a.bought, 2)} שנקנות מבעלים אחרים במגרש)` : ''} מחולקות — שום זכות לא נשארת בלי ייעוד`}
    >
      <SegmentedBar tall={tall} parts={a.parts.map((p) => ({ key: p.kind, label: p.label, value: p.rights, color: DEST_COLORS[p.kind], text: rights(p.rights) }))} />
    </Figure>
  );
}

/** Where the money comes from: your own capital vs loans (and the developer's share of taxes). */
export function MoneySources({ r }: { r: StrategyResult }) {
  const own = r.personalCapitalRequired;
  const loans = r.mortgageRequired + r.simulation.taxLoanDrawn;
  if (own + loans < 1000) return null;
  return (
    <Figure title="מאיפה הכסף" label="מימון המסלול: כסף שלכם מול הלוואות">
      <SegmentedBar
        parts={[
          { key: 'own', label: 'כסף שלכם', value: own, color: C.owner, text: money(own) },
          { key: 'loan', label: 'הלוואות', value: loans, color: C.developer, text: money(loans) },
        ]}
      />
    </Figure>
  );
}

/** The goal's own measure across the summary's routes (the direction emphasised). */
export function GoalCompare({
  items,
  label,
  lowerIsBetter,
  sub,
}: {
  items: { id: string; title: string; value: number; text: string; first: boolean }[];
  label: string;
  lowerIsBetter?: boolean;
  sub?: string;
}) {
  if (items.length < 2) return null;
  return (
    <Figure title={`השוואה: ${label}`} sub={[lowerIsBetter ? 'פחות = טוב יותר' : '', sub ?? ''].filter(Boolean).join(' · ') || undefined}>
      <BarList rows={items.map((x) => ({ id: x.id, label: x.title, value: x.value, text: x.text, emphasis: x.first }))} />
    </Figure>
  );
}

/** The position at delivery, built up step by step (today's prices). */
export function DeliveryBridge({ r }: { r: StrategyResult }) {
  const d = r.delivery;
  const steps = [
    { label: 'שווי הדירות שתקבלו', value: d.apartmentsValue },
    { label: 'חלק דירה (לא סחיר)', value: d.fractionValue },
    { label: 'כסף שתקבלו עד המסירה', value: d.ownerCashIn },
    { label: 'כסף שתשלמו עד המסירה', value: -d.ownerCashOut },
    { label: 'לקבל אחרי המסירה', value: d.receivablesAfterDelivery },
    { label: 'לשלם אחרי המסירה', value: -d.payablesAfterDelivery },
    { label: 'ריבית עד המסירה', value: -d.interestToDelivery },
  ].filter((s) => Math.abs(s.value) >= 1000);
  return (
    <Figure title="המצב שלכם במסירה — צעד אחר צעד" sub="במחירי היום; עולה בכחול, יורד באדום">
      <Waterfall steps={steps.map((s) => ({ ...s, text: signed(s.value) }))} total={{ label: 'מצב נטו במסירה', value: d.netPosition, text: signed(d.netPosition) }} />
    </Figure>
  );
}

const TAX_CATS: [string, string][] = [
  ['betterment_levy', 'היטל השבחה'],
  ['capital_gains_tax', 'מס שבח (רזרבה)'],
  ['services_vat', 'מע״מ על שירותי בנייה'],
  ['purchase_tax', 'מס רכישה'],
];

/** Each tax: what you pay vs what the developer pays for you. */
export function TaxesByPayer({ r }: { r: StrategyResult }) {
  const by = (payer: 'owner' | 'developer', cat: string) => r.ledger.filter((e) => e.payer === payer && e.direction === 'out' && e.category === cat && !e.deferred).reduce((s, e) => s + e.amount, 0);
  const rows = TAX_CATS.map(([cat, label]) => ({ id: cat, label, a: by('owner', cat), b: by('developer', cat) })).filter((x) => x.a + x.b >= 1000);
  if (!rows.length) return null;
  return (
    <Figure
      title="מי משלם כל מס"
      legend={[
        { label: 'אתם', color: C.owner },
        { label: 'היזם', color: C.developer },
      ]}
    >
      <PairedBars
        series={[
          { label: 'אתם', color: C.owner },
          { label: 'היזם', color: C.developer },
        ]}
        rows={rows.map((x) => ({ ...x, aText: money(x.a), bText: money(x.b) }))}
      />
    </Figure>
  );
}

/** Cash and debt year by year. */
export function CashDebtLine({ r }: { r: StrategyResult }) {
  const y = r.simulation.yearly;
  if (y.length < 2) return null;
  return (
    <Figure
      title="מזומן וחוב לאורך השנים"
      legend={[
        { label: 'מזומן', color: C.owner, shape: 'line' },
        { label: 'חוב', color: C.developer, shape: 'line' },
      ]}
    >
      <LineChart
        xs={y.map((x) => x.year)}
        xLabel={(v) => `שנה ${v}`}
        yFormat={(v) => (Math.abs(v) >= 10_000 ? money(v).replace(' ₪', '') : formatNumber(v, 0))}
        series={[
          { label: 'מזומן', color: C.owner, ys: y.map((x) => x.cash) },
          { label: 'חוב', color: C.developer, ys: y.map((x) => x.debt) },
        ]}
      />
    </Figure>
  );
}

/** Each route's value in the three scenarios (favourable · base · adverse). */
export function ScenarioDots({ rows }: { rows: { id: string; title: string; values: (number | null)[]; emphasis?: boolean }[] }) {
  if (!rows.some((r) => r.values.some((v) => v !== null))) return null;
  const series = [
    { label: 'תרחיש טוב', color: C.third },
    { label: 'בסיס', color: C.owner },
    { label: 'תרחיש שמרני', color: C.developer },
  ];
  return (
    <Figure title="ערך עבורכם בכל תרחיש" sub="הנקודה האמצעית = בסיס; הקו = הטווח" legend={series}>
      <DotRange rows={rows.map((r) => ({ id: r.id, label: r.title, values: r.values, emphasis: r.emphasis }))} series={series} format={money} />
    </Figure>
  );
}

/** The developer's lot P&L with this route, and its margin against the assumed hurdle. */
export function DeveloperBridge({ r }: { r: StrategyResult }) {
  const lot = r.developerLot;
  if (!lot) return null;
  const hurdle = PROJECT_CONFIG.developer.targetMarginOnRevenue;
  return (
    <Figure title="רווח היזם במגרש עם המסלול שלכם" sub="לפי המודל — הכנסות פחות עלויות ומימון">
      <Waterfall
        steps={[
          { label: 'הכנסות (בלי מע״מ)', value: lot.revenue, text: money(lot.revenue) },
          { label: 'עלויות', value: -lot.costs, text: signed(-lot.costs) },
          { label: 'מימון', value: -lot.financingCost, text: signed(-lot.financingCost) },
        ]}
        total={{ label: 'רווח', value: lot.profit, text: signed(lot.profit) }}
      />
      <Meter
        value={Math.max(0, lot.margin)}
        max={Math.max(0.3, lot.margin)}
        text={`רווח ${formatNumber(lot.margin * 100, 1)}% מההכנסות ${lot.margin >= hurdle ? '▲ ביעד או מעליו' : '▼ מתחת ליעד'}`}
        marker={{ value: hurdle, label: `הקו = יעד משוער ${formatNumber(hurdle * 100, 0)}% (הנחה, לא כלל)` }}
        color={C.developer}
      />
    </Figure>
  );
}

/** Worth to you vs cost to the developer, per term or concession. */
export function GainVsCost({ rows }: { rows: { id: string; label: string; gain: number | null; cost: number | null; sub?: string }[] }) {
  const shown = rows.filter((r) => r.gain !== null || r.cost !== null);
  if (!shown.length) return null;
  const series: [{ label: string; color: string }, { label: string; color: string }] = [
    { label: 'שווה לכם', color: C.owner },
    { label: 'עולה ליזם', color: C.developer },
  ];
  return (
    <Figure title="שווה לכם מול עולה ליזם" legend={series}>
      <PairedBars series={series} rows={shown.map((r) => ({ id: r.id, label: r.label, sub: r.sub, a: r.gain, b: r.cost, aText: r.gain === null ? '—' : money(r.gain), bText: r.cost === null ? '—' : money(r.cost) }))} />
    </Figure>
  );
}

export const requestRows = (items: RequestItem[]) => items.map((x) => ({ id: x.id, label: x.ask, gain: x.ownerGain, cost: x.developerCost }));
export const concessionRows = (rows: ConcessionRow[]) => rows.filter((r) => r.applicable).map((r) => ({ id: r.id, label: r.label, gain: r.ownerGain, cost: r.developerCost, sub: r.efficiency !== null ? `יעילות ${formatNumber(r.efficiency, 2)}` : undefined }));

/** The combination % where each side accepts, per tax arrangement, on the slider's range. */
export function JointRanges({ res, labels, current }: { res: JointResult; labels: Record<string, string>; current: number }) {
  const { min, max } = PROJECT_CONFIG.commercial.combination;
  const series = [
    { label: 'מתאים לכם', color: C.owner },
    { label: 'מתאים ליזם', color: C.developer },
    { label: 'לשניכם', color: C.third },
  ];
  return (
    <Figure title="באיזה אחוז קומבינציה כל צד מסכים" sub="הקו השחור = האחוז שבחרתם" legend={series}>
      <RangeAxis
        min={min}
        max={max}
        ticks={[0.25, 0.3, 0.35, 0.4, 0.45]}
        format={(x) => `${formatNumber(x * 100, (x * 100) % 1 === 0 ? 0 : 1)}%`}
        marker={{ value: current, label: 'האחוז שבחרתם' }}
        rows={res.arrangements.map((a) => ({
          id: a.arrangement,
          label: labels[a.arrangement] ?? a.arrangement,
          ranges: [
            ...a.ownerOk.map(([f, t]) => ({ from: f, to: t, color: series[0].color, label: series[0].label, lane: 0 })),
            ...a.developerOk.map(([f, t]) => ({ from: f, to: t, color: series[1].color, label: series[1].label, lane: 1 })),
            ...a.both.map(([f, t]) => ({ from: f, to: t, color: series[2].color, label: series[2].label, lane: 2 })),
          ],
        }))}
      />
    </Figure>
  );
}

/** The offer against the base terms: the money changes, better vs worse marked with an arrow and a word. */
export function OfferDelta({ diff }: { diff: DiffLine[] }) {
  const rows: BarRow[] = diff
    .filter((d) => d.delta !== null && d.id !== 'apartments' && d.id !== 'margin' && Math.abs(d.delta) >= 1000)
    .map((d) => {
      const better = d.higherIsBetter === null ? null : d.delta! > 0 === d.higherIsBetter;
      return {
        id: d.id,
        label: d.label,
        value: d.delta!,
        text: `${signed(d.delta!)}${better === null ? '' : better ? ' ▲ טוב יותר' : ' ▼ פחות טוב'}`,
        color: better === null ? C.muted : better ? C.good : C.bad,
      };
    });
  if (!rows.length) return null;
  return (
    <Figure title="מה משתנה בהצעה לעומת התנאים המשוערים" sub="ירוק ▲ = טוב יותר לכם · אדום ▼ = פחות טוב · אפור = מידע">
      <BarList rows={rows} />
    </Figure>
  );
}

/** Group planner: slots used, and the pool's whole units vs the unsold residual. */
export function GroupVisuals({ used, available, pool }: { used: number; available: number; pool: { units: number; residualShares: number; shares: number } }) {
  return (
    <Figure title="משאבים משותפים בקבוצה">
      {available > 0 && <Meter value={used} max={available} text={`${used} מתוך ${available} מקומות לשירותי בנייה`} />}
      {pool.shares > 0 && (
        <SegmentedBar
          tall
          parts={[
            { key: 'sold', label: 'נמכר כיחידות שלמות', value: pool.units, color: C.owner, text: `${pool.units} דירות` },
            { key: 'left', label: 'לא נמכר (חלק לא סחיר)', value: pool.residualShares, color: C.muted, text: `${formatNumber(pool.residualShares, 2)} דירה` },
          ]}
        />
      )}
    </Figure>
  );
}

/** Land value references: the known amounts on one scale; unknown ones listed as unknown. */
export function LandBars({ result }: { result: DecisionResult }) {
  const known = result.landReferences.filter((l) => l.amount !== null);
  if (known.length < 2) return null;
  const unknown = result.landReferences.length - known.length;
  return (
    <Figure title="ערכי קרקע מוכרים — לא מחיר שוק היום" note={unknown > 0 ? `${unknown} ערכים לא ידועים — לא מוצגים בגרף` : undefined}>
      <BarList rows={known.map((l, i) => ({ id: `${i}`, label: l.label, sub: l.date, value: l.amount!, text: money(l.amount!) }))} />
    </Figure>
  );
}

/** The long-term projection as a bridge to its total (illustrative). */
export function ProjectionBridge({ result }: { result: DecisionResult }) {
  const p = result.projection;
  if (!p) return null;
  const steps = [
    { label: 'דירות ונכסים', value: p.assets },
    { label: 'מזומן', value: p.cash },
    { label: 'יתרת משכנתא', value: -p.debt },
    { label: 'החזרים ששולמו', value: -p.mortgagePaymentsFV },
    { label: 'התחייבויות נדחות', value: -p.deferredLiabilities },
    { label: 'בלי מימון', value: -p.unfunded },
    { label: 'הכסף שהיה צובר ממילא', value: -p.startingCapitalGrown },
  ].filter((s) => Math.abs(s.value) >= 1000);
  return (
    <Figure title="התחזית — איך מגיעים לתוצאה" sub="המחשה בלבד, בשקלים של שנת היעד">
      <Waterfall steps={steps.map((s) => ({ ...s, text: signed(s.value) }))} total={{ label: 'תוצאה משוערת', value: p.total, text: signed(p.total) }} />
    </Figure>
  );
}

/** Your entitlement on the official share vs the 2.25 simulation convention. */
export function EntitlementBars({ official, simulated }: { official: number; simulated: number }) {
  return (
    <Figure title="הזכאות שלכם בשני הבסיסים" sub="שוות-ערך לדירת 100 מ״ר">
      <BarList
        max={Math.max(official, simulated)}
        rows={[
          { id: 'official', label: 'לפי החלק הרשמי במגרש (בחישוב)', value: official, text: formatNumber(official, 2), emphasis: true },
          { id: 'sim', label: 'בסימולציה המקובלת (2.25 לכל 167 מ״ר)', value: simulated, text: formatNumber(simulated, 2) },
        ]}
      />
    </Figure>
  );
}

/** Price-dependent routes: the price each would need vs the hypothetical scenario price (₪ per original m² only). */
export function PriceNeeded({ rows }: { rows: { id: string; label: string; required: number | null; scenario: number; perSqm: boolean; direction: 'min' | 'max' }[] }) {
  const shown = rows.filter((r) => r.perSqm && r.required !== null && r.required > 0);
  if (!shown.length) return null;
  const series: [{ label: string; color: string }, { label: string; color: string }] = [
    { label: 'המחיר שתצטרכו', color: C.owner },
    { label: 'תרחיש היפותטי (לא מחיר אמיתי)', color: C.muted },
  ];
  const perSqm = (x: number) => `${formatNumber(x, 0)} ₪ למ״ר`;
  return (
    <Figure title="המחיר שצריך מול תרחיש היפותטי" sub="למ״ר קרקע מקורי · מכירה: לפחות · קנייה: לכל היותר" legend={series}>
      <PairedBars
        series={series}
        rows={shown.map((r) => ({ id: r.id, label: r.label, sub: r.direction === 'min' ? 'לפחות' : 'לכל היותר', a: r.required, b: r.scenario, aText: perSqm(r.required!), bText: perSqm(r.scenario) }))}
      />
    </Figure>
  );
}
