/**
 * QA R8 P2: the reviewer sheet (docs/review/exercise-review.xlsx) must match
 * the seed. It went stale once (side_plank without High blood pressure):
 * rebuild it with `python3 scripts/build-review-sheet.py` after any library
 * change. The .xlsx is a zip; a tiny reader keeps the test dependency-free.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { inflateRawSync } from 'zlib';

import en from '../../i18n/locales/en.json';
import seed from '../../../supabase/seed/exercises.json';

const ROOT = join(__dirname, '..', '..', '..');

function unzip(buf: Buffer): Map<string, string> {
  const files = new Map<string, string>();
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + size);
    files.set(name, (method === 8 ? inflateRawSync(data) : data).toString('utf8'));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const unescape = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

/** Rows of the sheet whose A1 is "ID (slug)", as column letter → text. */
function exerciseRows(): Map<string, Record<string, string>> {
  const files = unzip(readFileSync(join(ROOT, 'docs/review/exercise-review.xlsx')));
  const shared = [
    ...(files.get('xl/sharedStrings.xml') ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g),
  ].map((m) => unescape([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')));
  for (const [name, xml] of files) {
    if (!/^xl\/worksheets\/sheet\d+\.xml$/.test(name)) continue;
    const rows = new Map<string, Record<string, string>>();
    for (const row of xml.matchAll(/<row [^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells: Record<string, string> = {};
      for (const c of row[2].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const [, col, attrs, inner = ''] = c;
        const v = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
        const inline = inner.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1];
        cells[col] =
          /t="s"/.test(attrs) && v != null ? shared[Number(v)] : unescape(inline ?? v ?? '');
      }
      rows.set(row[1], cells);
    }
    if (rows.get('1')?.A === 'ID (slug)') {
      const bySlug = new Map<string, Record<string, string>>();
      for (const [n, cells] of rows) if (n !== '1' && cells.A) bySlug.set(cells.A, cells);
      return bySlug;
    }
  }
  throw new Error('Exercises sheet not found');
}

const RISK = {
  ...(en.safety.painAreas as Record<string, string>),
  ...(en.safety.conditions as Record<string, string>),
};

it('every seed exercise is in the sheet with its current contraindications and name', () => {
  const rows = exerciseRows();
  const exercises = seed.exercises as { slug: string; contraindications: string[] }[];
  expect(rows.size).toBe(exercises.length);
  const stale: string[] = [];
  for (const e of exercises) {
    const row = rows.get(e.slug);
    const want = e.contraindications.map((c) => RISK[c]).join(', ') || 'None';
    const name = (en.exercises as Record<string, { name: string }>)[e.slug]?.name;
    if (!row || row.H?.split('\n')[0] !== want || row.B !== name) stale.push(e.slug);
  }
  expect(stale).toEqual([]);
});
