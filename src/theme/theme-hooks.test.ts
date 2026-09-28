import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * QA R6-01: a theme change re-renders screens in place, so components must
 * read colors through `useColors()` and styles through the hook
 * `makeStyles` returns. The module-level `colors` object is only for
 * `makeStyles` factories: a component reading it would keep the old colors
 * (React Compiler memoizes around module values).
 */
const ROOT = join(__dirname, '..');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

it('module-level colors are read only inside makeStyles factories', () => {
  const found: string[] = [];
  for (const path of sources(ROOT)) {
    const rel = relative(ROOT, path).split('\\').join('/');
    if (rel.startsWith('theme/')) continue;
    const code = readFileSync(path, 'utf8');
    if (!/\bcolors\b/.test(code) && !/makeStyles/.test(code)) continue;
    const ast = parse(code, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
    const styleHooks = new Set<string>();
    traverse(ast, {
      Identifier(p) {
        const name = p.node.name;
        if (!p.isReferencedIdentifier()) return;
        const binding = p.scope.getBinding(name);
        if (!binding || binding.scope !== p.scope.getProgramParent()) return;
        const inFactory = p.findParent(
          (q) =>
            q.isCallExpression() &&
            q.node.callee.type === 'Identifier' &&
            q.node.callee.name === 'makeStyles',
        );
        if (name === 'colors' && binding.kind === 'module' && !inFactory)
          found.push(`${rel}:${p.node.loc?.start.line} colors`);
      },
      VariableDeclarator(p) {
        const init = p.node.init;
        if (
          init?.type === 'CallExpression' &&
          init.callee.type === 'Identifier' &&
          init.callee.name === 'makeStyles' &&
          p.node.id.type === 'Identifier'
        )
          styleHooks.add(p.node.id.name);
      },
    });
    for (const hook of styleHooks)
      if (!/^use[A-Z]/.test(hook)) found.push(`${rel}: makeStyles result "${hook}" is not a hook`);
  }
  expect(found).toEqual([]);
});
