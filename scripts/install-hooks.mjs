// Points git at .githooks (pre-commit secret scan, docs/SECURITY.md rule 3).
// Runs on `npm ci` / `npm install`; never fails the install (EAS builds, zip
// downloads without .git). An existing core.hooksPath (another hook manager)
// is left alone, with a note on how to add ours (security round 2, P3).
import { execFileSync } from 'node:child_process';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: 'pipe' }).trim();

export function planHooks(current) {
  if (!current) return 'install';
  if (current === '.githooks') return 'already';
  return 'keep';
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    git('rev-parse', '--git-dir');
  } catch {
    process.exit(0); // No git here: nothing to install.
  }
  let current = '';
  try {
    current = git('config', '--get', 'core.hooksPath');
  } catch {
    // Not set.
  }
  const plan = planHooks(current);
  if (plan === 'install') git('config', 'core.hooksPath', '.githooks');
  else if (plan === 'keep')
    console.warn(
      `note: core.hooksPath is already "${current}"; left as is. Add ` +
        '`node scripts/security-check.mjs --staged` to your pre-commit hook (docs/SECURITY.md).',
    );
}
