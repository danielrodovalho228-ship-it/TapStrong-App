// Points git at .githooks (pre-commit secret scan, docs/SECURITY.md rule 3).
// Runs on `npm ci` / `npm install`; never fails the install (EAS builds, zip
// downloads without .git).
import { execFileSync } from 'node:child_process';

try {
  execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'ignore' });
} catch {
  // No git here: nothing to install.
}
