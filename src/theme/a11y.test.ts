/**
 * Static accessibility rules over the app source (SPEC §2.6, §11.9):
 * no text below 13 px, and every pressable says what it is to screen readers.
 */
import fs from 'fs';
import path from 'path';

const SRC = path.join(__dirname, '..');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(full);
    return /\.tsx$/.test(e.name) && !/\.test\./.test(e.name) ? [full] : [];
  });
}

/** The attributes of each opening tag, skipping `>` inside `{...}`. */
function openingTags(source: string, tag: string): { line: number; attrs: string }[] {
  const out: { line: number; attrs: string }[] = [];
  const re = new RegExp(`<${tag}\\b`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    let depth = 0;
    let i = m.index + m[0].length;
    for (; i < source.length; i++) {
      const c = source[i];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
    }
    out.push({
      line: source.slice(0, m.index).split('\n').length,
      attrs: source.slice(m.index, i),
    });
  }
  return out;
}

const files = sourceFiles(SRC);

describe('accessibility rules in the source', () => {
  it('no font size below 13 px', () => {
    const small = files.flatMap((f) =>
      [...fs.readFileSync(f, 'utf8').matchAll(/fontSize:\s*(\d+)/g)]
        .filter((m) => Number(m[1]) < 13)
        .map((m) => `${path.relative(SRC, f)}: ${m[0]}`),
    );
    expect(small).toEqual([]);
  });

  it('every Pressable has a role, or is explicitly hidden from screen readers', () => {
    const missing = files.flatMap((f) =>
      openingTags(fs.readFileSync(f, 'utf8'), 'Pressable')
        .filter(
          (t) => !/accessibilityRole=|role=/.test(t.attrs) && !/accessible=\{false\}/.test(t.attrs),
        )
        .map((t) => `${path.relative(SRC, f)}:${t.line}`),
    );
    expect(missing).toEqual([]);
  });

  it('icon-only buttons have a label', () => {
    const missing = files.flatMap((f) =>
      openingTags(fs.readFileSync(f, 'utf8'), 'IconButton')
        .filter((t) => !/accessibilityLabel=/.test(t.attrs))
        .map((t) => `${path.relative(SRC, f)}:${t.line}`),
    );
    expect(missing).toEqual([]);
  });
});
