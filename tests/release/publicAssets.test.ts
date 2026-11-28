/**
 * Iteration 10 / E3: everything in public/ is published as is. PDFs are an allow-list of reviewed public planning
 * documents (by SHA-256), and none may carry an Israeli ID number (valid check digit) in its text or an author field.
 * A new or changed file fails here until it is reviewed and added.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

const REVIEWED: Record<string, string> = {
  'maps/proposed-1.pdf': 'fceff21d22ad625360682e1ee71f31e2f69efb340741598f02e873261c2c0ab1',
  'maps/proposed-2.pdf': 'a8023181594822b4904063196ad3d13fcf51f72aeef43cbbd20409e1ca104ae9',
};
const ROOT = new URL('../../public/', import.meta.url).pathname;
const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
const files = walk(ROOT).map((f) => f.slice(ROOT.length));

/** Israeli ID check digit (Luhn variant). */
export function validIsraeliId(s: string): boolean {
  let t = 0;
  for (let i = 0; i < 9; i += 1) {
    const d = Number(s[i]) * (i % 2 === 0 ? 1 : 2);
    t += d > 9 ? d - 9 : d;
  }
  return t % 10 === 0;
}

describe('public assets', () => {
  it('the ID check digit is computed correctly', () => {
    expect(validIsraeliId('000000018')).toBe(true);
    expect(validIsraeliId('000000019')).toBe(false);
  });
  it('only reviewed PDFs, unchanged', () => {
    for (const f of files.filter((x) => x.endsWith('.pdf'))) {
      expect(REVIEWED[f], `${f} is not in the reviewed list`).toBeDefined();
      expect(createHash('sha256').update(readFileSync(join(ROOT, f))).digest('hex')).toBe(REVIEWED[f]);
    }
  });
  for (const f of Object.keys(REVIEWED)) {
    it(`${f}: no author metadata and no ID numbers in its text`, () => {
      const b = readFileSync(join(ROOT, f));
      const raw = b.toString('latin1');
      expect(raw).not.toMatch(/\/Author\s*\(\s*[^)\s]/);
      let text = raw;
      for (const m of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
        try {
          text += inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1');
        } catch {
          /* images and other non-deflate streams */
        }
      }
      const ids = [...text.matchAll(/(?<!\d)\d{9}(?!\d)/g)].map((x) => x[0]).filter(validIsraeliId);
      expect(ids).toEqual([]);
    });
  }
});
