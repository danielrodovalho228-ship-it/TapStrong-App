import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * Theme v2: every screen reads colors from the theme, so Light and Dark
 * both work. Hex, rgb() and hsl() literals are allowed only in the theme
 * files (tests may use them to check values).
 */
const ROOT = join(__dirname, '..');
const ALLOWED = new Set(['theme/tokens.ts', 'theme/palettes.ts']);
const LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\(/;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('no color literals outside the theme files', () => {
  it('finds none', () => {
    const found: string[] = [];
    for (const path of sources(ROOT)) {
      const rel = relative(ROOT, path).split('\\').join('/');
      if (ALLOWED.has(rel)) continue;
      readFileSync(path, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (LITERAL.test(line)) found.push(`${rel}:${i + 1}: ${line.trim()}`);
        });
    }
    expect(found).toEqual([]);
  });

  it('catches a literal', () => {
    expect(LITERAL.test("color: '#1E1C1A'")).toBe(true);
    expect(LITERAL.test("backgroundColor: 'rgba(0, 0, 0, 0.5)'")).toBe(true);
    expect(LITERAL.test('colors.accent')).toBe(false);
  });
});
