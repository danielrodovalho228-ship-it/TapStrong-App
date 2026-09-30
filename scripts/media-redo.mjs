// Writes docs/media-redo.md: what Moacir redoes in Google Flow, one line per
// clip (slug | sex | reason). Sources: assets/prototype/qc.json (suspect and
// missing clips) and the final <slug>.<f|m>.mp4 files. An exercise with a
// usable clip for one sex only also lists the other sex. Order: exercises
// with no usable clip first, then those with one sex; seed order inside.
// Run after every batch: npm run media:redo
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'assets', 'prototype');
const qc = JSON.parse(readFileSync(join(dir, 'qc.json'), 'utf8'));
const suspect = qc.suspect ?? {};
const missing = qc.missing ?? {};
const seed = JSON.parse(
  readFileSync(join(root, 'supabase', 'seed', 'exercises.json'), 'utf8'),
).exercises.map((e) => e.slug);
const repairFile = join(root, 'supabase', 'seed', 'repair_tests.json');
if (existsSync(repairFile))
  for (const t of JSON.parse(readFileSync(repairFile, 'utf8')).tests ?? [])
    seed.push(t.slug ?? t.id);
const order = new Map(seed.map((s, i) => [s, i]));

const usable = new Set(
  readdirSync(dir)
    .map((f) => f.match(/^([a-z0-9_]+\.(f|m))\.mp4$/)?.[1])
    .filter((k) => k && !suspect[k]),
);
const keyOf = (k) => k.slice(0, -2);
const slugs = new Set([...usable, ...Object.keys(suspect), ...Object.keys(missing)].map(keyOf));
for (const slug of slugs)
  if (!order.has(slug)) throw new Error(`qc.json: unknown exercise "${slug}"`);

const rows = { none: [], one: [] };
for (const slug of [...slugs].sort((a, b) => order.get(a) - order.get(b))) {
  const ok = ['f', 'm'].filter((s) => usable.has(`${slug}.${s}`));
  if (ok.length === 2) continue;
  for (const sex of ['f', 'm']) {
    const key = `${slug}.${sex}`;
    if (usable.has(key)) continue;
    const reason = suspect[key]
      ? `suspeito: ${suspect[key]}`
      : (missing[key] ?? 'faltando: nunca foi gerado');
    rows[ok.length ? 'one' : 'none'].push(`| ${slug} | ${sex} | ${reason} |`);
  }
}
const table = (list) =>
  list.length ? ['| slug | sexo | motivo |', '|---|---|---|', ...list].join('\n') : 'Nada.';
writeFileSync(
  join(root, 'docs', 'media-redo.md'),
  [
    '# Vídeos para refazer no Flow',
    '',
    'Gerado por `npm run media:redo` a partir de `assets/prototype/qc.json` e dos clipes em',
    '`assets/prototype/`. Não edite à mão: atualizado a cada lote.',
    '',
    'Sexo: f = mulher, m = homem. Nome do arquivo no Flow: `<slug>.<f|m>` (o import',
    'aceita `_v2`, `_v3`… para refeitos).',
    '',
    `Total: ${rows.none.length + rows.one.length} clipes ` +
      `(${rows.none.length} de exercícios sem nenhum sexo, ${rows.one.length} de exercícios com só um).`,
    '',
    '## 1. Exercícios sem nenhum sexo no app (prioridade)',
    '',
    table(rows.none),
    '',
    '## 2. Exercícios com só um sexo no app',
    '',
    table(rows.one),
    '',
  ].join('\n'),
);
console.log(`docs/media-redo.md: ${rows.none.length} + ${rows.one.length} clips to redo`);
