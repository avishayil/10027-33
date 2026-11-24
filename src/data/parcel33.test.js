import { describe, expect, it } from 'vitest';
import { PARCEL, VERSIONS, VERSION_IDS, DEFAULT_VERSION, BASE_SHARE_AREA, getLot } from './parcel33';

describe('parcel33 data', () => {
  it('has both versions with v2 as default', () => {
    expect(VERSION_IDS).toEqual(['v2', 'v1']);
    expect(DEFAULT_VERSION).toBe('v2');
  });

  it('v2 lots 149/150/153 together absorb the whole parcel (±0.1%)', () => {
    // השטח בחלקה שמקנה 100% ממגרש = 167 / חלק-ל-167
    const absorbed = VERSIONS.v2.lots.reduce((s, l) => s + BASE_SHARE_AREA / l.sharePer167, 0);
    expect(Math.abs(absorbed - PARCEL.area) / PARCEL.area).toBeLessThan(0.001);
  });

  it('v2 lot values sum to the parcel allocation (₪90.93M)', () => {
    expect(VERSIONS.v2.lots.reduce((s, l) => s + l.value, 0)).toBe(90930000);
  });

  it('getLot falls back to the first lot of the version', () => {
    expect(getLot('v1', '149').id).toBe('44');
    expect(getLot('v2', '153').id).toBe('153');
  });
});
