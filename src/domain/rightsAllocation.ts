/**
 * Where every land right of a route goes (V1: "all the land rights are used"). The entitlement plus any rights bought
 * from other owners in the lot is split across destinations — combination with the developer, sold to the developer,
 * sold on the open market now or after approval, built with construction services, revenue share, kept as land — and
 * must add up exactly. A remainder would be reported as `unaccounted` (tests require it to be zero).
 */
import type { StrategyResult } from './types';

export type RightsDestination =
  | 'combination'
  | 'sold_developer'
  | 'sold_open_market'
  | 'sold_after_approval'
  | 'built'
  | 'revenue_share'
  | 'held';

export const DESTINATION_LABELS: Record<RightsDestination, string> = {
  combination: 'ליזם בקומבינציה (תמורת דירות)',
  sold_developer: 'נמכרות ליזם',
  sold_open_market: 'נמכרות בשוק החופשי עכשיו',
  sold_after_approval: 'נמכרות בשוק אחרי אישור התכנית',
  built: 'נבנות לכם בשירותי בנייה',
  revenue_share: 'בעסקת תמורות',
  held: 'נשארות שלכם כקרקע',
};

export interface RightsAllocation {
  /** Entitlement + rights bought. */
  total: number;
  /** Rights bought from other owners in the lot (coming in). */
  bought: number;
  parts: { kind: RightsDestination; label: string; rights: number }[];
  /** total − Σ parts (zero when every right is accounted for). */
  unaccounted: number;
}

const EPS = 1e-9;

export function rightsAllocation(r: StrategyResult, entitlement: number): RightsAllocation {
  const plan = r.plan;
  const sold: Record<'developer' | 'open_market' | 'post_approval', number> = { developer: 0, open_market: 0, post_approval: 0 };
  for (const l of r.candidate.legs) if (l.kind === 'sell_rights') sold[l.market] += l.rights;
  // Scale the leg split to the plan's rights sold (the plan is the accounting truth).
  const legSold = sold.developer + sold.open_market + sold.post_approval;
  const k = legSold > EPS ? plan.rightsSold / legSold : 0;
  const raw: [RightsDestination, number][] = [
    ['combination', plan.rightsInCombination],
    ['sold_developer', sold.developer * k],
    ['sold_open_market', sold.open_market * k],
    ['sold_after_approval', sold.post_approval * k],
    ['built', plan.rightsBuilt],
    ['revenue_share', plan.rightsInRevenueShare],
    ['held', plan.rightsHeld],
  ];
  const parts = raw.filter(([, x]) => x > EPS).map(([kind, rights]) => ({ kind, label: DESTINATION_LABELS[kind], rights }));
  const total = entitlement + plan.rightsPurchased;
  return { total, bought: plan.rightsPurchased, parts, unaccounted: total - parts.reduce((s, p) => s + p.rights, 0) };
}
