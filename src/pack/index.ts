/**
 * The Project Pack (V1 Milestone B2; docs/ECONOMIC-CONTRACT.md, spec §C): one versioned, validated, sanitised artifact
 * with everything project-specific the kernel needs — the parcel and lots (official allocation), the rights model (the
 * official share and the 2.25 simulation convention), the physical inventory (explicitly unknown), the model
 * assumptions and every piece of dated evidence with a canonical status. Manually curated here; bundled with the app
 * (no runtime network). It holds no personal data: no names, identifiers, private allocation records, household debts,
 * acquisition bases or offer details.
 */
import { COMMERCIAL } from '../data/commercial';
import { PROJECT_CONFIG } from '../data/config';
import { FINANCING, MARKET } from '../data/market';
import { REGULATION } from '../data/regulation';
import { APPRAISAL_SOURCE, LAND_TRANSACTIONS } from '../data/evidence';
import { PROJECT, RETRIEVED_AT } from '../data/project';
import { PARCEL, VERSIONS } from '../data/parcel33';
import { nonFinitePath } from '../domain/validation';
import type { DataPoint, EvidenceScope, EvidenceStatus, ProjectConfig } from '../domain/types';
import { PACK_ID } from '../kernel/version';

export const PACK_SCHEMA = 'blro-pack/1';
export const SUPPORTED_PACK_SCHEMAS = [PACK_SCHEMA];
export const CANONICAL_STATUSES: EvidenceStatus[] = ['verified_fact', 'reported', 'appraisal_reference', 'confirmed_offer', 'assumption', 'scenario', 'unknown'];

export interface PackEvidence {
  /** Stable id: `<group>.<key>` for model assumptions, `price.<knob>`, `land_tx.<n>`, `allocation_tables_106b`. */
  id: string;
  title: string;
  status: EvidenceStatus;
  source: string;
  url?: string;
  /** Page / row / transaction locator in the source. */
  locator?: string;
  observedAt?: string;
  retrievedAt: string;
  unit?: string;
  scope?: EvidenceScope;
  /** Professional reviewer and version — none yet (release gate). */
  reviewer: string | null;
  caveat?: string;
}

export interface PackLot {
  id: string;
  areaSqm: number;
  units: number;
  residentialAreaSqm: number;
  sharePer167: number;
  allocationValue: number;
}

export interface ProjectPack {
  schemaVersion: string;
  id: string;
  /** = the model's data version. */
  version: string;
  projectId: string;
  jurisdiction: 'IL';
  effectiveDate: string;
  planVersion: string;
  allocationVersion: string;
  parcel: { gush: number; parcel: number; areaSqm: number };
  lots: PackLot[];
  rightsModel: {
    entitlementBasis: ProjectConfig['rights']['entitlementBasis'];
    originalAreaSqm: number;
    /** The simulation convention (167 m² = 2.25 standard-apartment rights), kept beside the official share. */
    simulationRightsPer167: number;
    standardUnitSqm: number;
  };
  /** Physical apartment inventory: not known for this project. */
  inventory: { status: 'unknown'; units: null; note: string };
  evidence: PackEvidence[];
  /** The assumptions the kernel runs on. */
  model: ProjectConfig;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const VERIFICATION: Record<DataPoint<unknown>['verification'], EvidenceStatus> = {
  verified: 'verified_fact',
  reported: 'reported',
  assumed: 'assumption',
  unknown: 'unknown',
};
const isoDate = (d: string | undefined): string | undefined => {
  if (!d) return undefined;
  if (ISO.test(d)) return d;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : undefined;
};

function evidence(): PackEvidence[] {
  const out: PackEvidence[] = [];
  const version = VERSIONS[PROJECT_CONFIG.rights.tableVersion as keyof typeof VERSIONS];
  out.push({
    id: 'allocation_tables_106b',
    title: 'טבלאות איזון והקצאה מעודכנות (106(ב))',
    status: 'verified_fact',
    source: version.sourceNote,
    observedAt: isoDate(version.date),
    retrievedAt: RETRIEVED_AT,
    reviewer: null,
    caveat: 'תכנית מוצעת — טרם אושרה',
  });
  // Model assumptions, keyed by their data object and field (stable ids).
  const groups: [string, Record<string, DataPoint<unknown>>][] = [
    ['project', PROJECT as unknown as Record<string, DataPoint<unknown>>],
    ['commercial', COMMERCIAL as unknown as Record<string, DataPoint<unknown>>],
    ['market', MARKET as unknown as Record<string, DataPoint<unknown>>],
    ['financing', FINANCING as unknown as Record<string, DataPoint<unknown>>],
    ['regulation', REGULATION as unknown as Record<string, DataPoint<unknown>>],
  ];
  for (const [g, items] of groups)
    for (const [key, d] of Object.entries(items)) {
      if (!d || typeof d !== 'object' || !('verification' in d)) continue;
      out.push({
        id: `${g}.${key}`,
        title: d.label,
        status: d.sourceType === 'developer_offer' ? 'scenario' : d.sourceType === 'official_planning' && d.verification !== 'verified' ? 'appraisal_reference' : VERIFICATION[d.verification],
        source: d.sourceName ?? d.sourceType,
        url: d.sourceUrl,
        observedAt: isoDate(d.observedAt),
        retrievedAt: isoDate(d.retrievedAt) ?? RETRIEVED_AT,
        reviewer: null,
        caveat: d.notes,
      });
    }
  for (const [knob, e] of Object.entries(PROJECT_CONFIG.evidence))
    out.push({ id: `price.${knob}`, title: knob, status: e.status, source: e.source, retrievedAt: RETRIEVED_AT, scope: e.scope, reviewer: null });
  LAND_TRANSACTIONS.forEach((t, i) =>
    out.push({
      id: `land_tx.${i}`,
      title: `עסקה בחלקה ${t.parcel}: ${t.areaSqm} מ״ר`,
      status: 'reported',
      source: t.source,
      locator: t.page ? `עמ׳ ${t.page}` : undefined,
      observedAt: t.date,
      retrievedAt: RETRIEVED_AT,
      unit: '₪',
      reviewer: null,
      caveat: t.note ?? 'עסקה היסטורית — לא שומה עדכנית',
    }),
  );
  out.push({
    id: 'appraisal_allocation_2026_11',
    title: APPRAISAL_SOURCE.name,
    status: 'appraisal_reference',
    source: APPRAISAL_SOURCE.name,
    url: APPRAISAL_SOURCE.url,
    observedAt: APPRAISAL_SOURCE.date,
    retrievedAt: RETRIEVED_AT,
    reviewer: null,
    caveat: APPRAISAL_SOURCE.note,
  });
  return out;
}

function build(): ProjectPack {
  const version = VERSIONS[PROJECT_CONFIG.rights.tableVersion as keyof typeof VERSIONS];
  return {
    schemaVersion: PACK_SCHEMA,
    id: PACK_ID,
    version: PROJECT_CONFIG.version,
    projectId: 'hadera-compound-13',
    jurisdiction: 'IL',
    effectiveDate: PROJECT_CONFIG.analysis.valuationDate,
    planVersion: PROJECT_CONFIG.rights.planningVersion,
    allocationVersion: version.id,
    parcel: { gush: PARCEL.gush, parcel: PARCEL.parcel, areaSqm: PARCEL.area },
    lots: version.lots
      .filter((l) => PROJECT_CONFIG.rights.lotIds.includes(l.id))
      .map((l) => ({ id: l.id, areaSqm: l.area, units: l.units, residentialAreaSqm: l.residentialArea, sharePer167: l.sharePer167, allocationValue: l.value })),
    rightsModel: {
      entitlementBasis: PROJECT_CONFIG.rights.entitlementBasis,
      originalAreaSqm: PROJECT_CONFIG.rights.originalAreaSqm,
      simulationRightsPer167: PROJECT_CONFIG.rights.apartmentEquivalents,
      standardUnitSqm: PROJECT_CONFIG.construction.apartmentSizeSqm,
    },
    inventory: { status: 'unknown', units: null, note: 'תמהיל הדירות בפועל לא ידוע — מסלולי תמהיל מותנים באישור מלאי' },
    evidence: evidence(),
    model: PROJECT_CONFIG,
  };
}

/** Problems with a pack (plain Hebrew); empty when valid. */
export function validatePack(p: unknown): string[] {
  const errors: string[] = [];
  const x = p as Partial<ProjectPack> | null;
  if (!x || typeof x !== 'object') return ['חבילת פרויקט חסרה.'];
  if (!SUPPORTED_PACK_SCHEMAS.includes(String(x.schemaVersion))) errors.push(`גרסת סכמה לא נתמכת: ${String(x.schemaVersion)}`);
  if (!x.model) return [...errors, 'חסר מודל בחבילה.'];
  if (x.version !== x.model.version) errors.push('גרסת החבילה שונה מגרסת המודל.');
  if (!x.effectiveDate || !ISO.test(x.effectiveDate)) errors.push('תאריך תוקף חסר או לא תקין.');
  const broken = nonFinitePath(x.model, 'model');
  if (broken) errors.push(`ערך לא תקין: ${broken}`);
  const lotIds = (x.lots ?? []).map((l) => l.id);
  if (lotIds.join(',') !== x.model.rights.lotIds.join(',')) errors.push('המגרשים בחבילה אינם תואמים את המודל.');
  for (const l of x.lots ?? []) if (!(l.units > 0 && l.residentialAreaSqm > 0 && l.sharePer167 > 0)) errors.push(`נתוני מגרש לא תקינים: ${l.id}`);
  const ids = new Set<string>();
  for (const e of x.evidence ?? []) {
    if (ids.has(e.id)) errors.push(`ראיה כפולה: ${e.id}`);
    ids.add(e.id);
    if (!CANONICAL_STATUSES.includes(e.status)) errors.push(`סטטוס ראיה לא מוכר: ${e.id} (${String(e.status)})`);
    if (!ISO.test(e.retrievedAt)) errors.push(`תאריך אחזור חסר: ${e.id}`);
  }
  if (x.inventory && x.inventory.status === 'unknown' && x.inventory.units !== null) errors.push('מלאי לא ידוע חייב להישאר ריק.');
  return errors;
}

/** Validates a pack and returns it; refuses unsupported versions and invalid data. */
export function loadPack(p: unknown): ProjectPack {
  const errors = validatePack(p);
  if (errors.length) throw new Error(errors.join(' '));
  return p as ProjectPack;
}

/** The bundled pack for parcel 10027/33 (validated on load). */
export const HADERA_PACK: ProjectPack = loadPack(build());
