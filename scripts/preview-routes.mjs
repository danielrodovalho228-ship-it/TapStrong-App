// Web preview on Vercel (vercel.json): the static export names dynamic pages
// with brackets ("exercise/[id].html", "workout/[id]/play.html"), which
// Vercel's rewrites can't point at. This copies each of them to a plain name
// ("exercise/_id.html", "workout/_id/play.html") that vercel.json rewrites to.
// Run after the export: node scripts/preview-routes.mjs <dir>
import { cpSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2];
if (!root) throw new Error('usage: node scripts/preview-routes.mjs <export dir>');

let copied = 0;
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const plain = name.replace(/^\[([a-z]+)\]/i, '_$1');
    if (plain !== name) {
      cpSync(path, join(dir, plain), { recursive: true });
      copied++;
    }
    if (statSync(path).isDirectory() && name !== '_expo' && name !== 'assets') walk(path);
  }
};
walk(root);
console.log(`preview-routes: ${copied} dynamic pages copied to plain names`);
