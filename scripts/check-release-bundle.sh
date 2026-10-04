#!/usr/bin/env bash
# Proves the draft exercise library and the prototype videos never ship
# (SPEC §2.1, §6): exports release bundles and fails if any contains them.
# Slower than unit tests (~1 min); run before any store build.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT

cd "$ROOT"
EXPO_OFFLINE=1 CI=1 npx expo export --clear --platform android --platform ios --platform web --output-dir "$OUT" >/dev/null

if grep -rl 'Prototype exercise library' "$OUT" >/dev/null; then
  echo "FAIL: a release bundle contains the draft exercise library" >&2
  grep -rl 'Prototype exercise library' "$OUT" >&2
  exit 1
fi
# ASCII marker (Hermes bytecode stores the § note above as UTF-16).
if grep -rl 'Launch set for the professional review' "$OUT" >/dev/null; then
  echo "FAIL: a release bundle contains the launch set drafts" >&2
  exit 1
fi
if grep -rl 'Bundled shoulder program media' "$OUT" >/dev/null; then
  echo "FAIL: a release bundle contains the internal build's shoulder media" >&2
  exit 1
fi
if grep -rl 'Prototype exercise videos' "$OUT" >/dev/null; then
  echo "FAIL: a release bundle contains the prototype video map" >&2
  exit 1
fi
if grep -rl 'Repair check tests (SPEC' "$OUT" >/dev/null; then
  echo "FAIL: a release bundle contains the draft Repair tests" >&2
  exit 1
fi
if grep -rl 'Joint movement catalog (SPEC' "$OUT" >/dev/null; then
  echo "FAIL: a release bundle contains the draft joint movement catalog" >&2
  exit 1
fi
if grep -rl 'simulateFirstCharge' "$OUT" >/dev/null; then
  echo "FAIL: a release bundle contains the development purchase simulator" >&2
  exit 1
fi
# Development-only navigator warnings (QA R6 P2: "component with the name
# 'o'") are stripped from release builds.
if grep -rl 'Got a component with the name' "$OUT" >/dev/null; then
  echo "FAIL: a release bundle contains development-only navigator warnings" >&2
  exit 1
fi
# No personal contact address as a fallback (QA R7 P2).
if grep -rl 'danielrodovalho' "$OUT" >/dev/null; then
  echo "FAIL: a release bundle contains a personal email address" >&2
  exit 1
fi
if find "$OUT" -iname '*.mp4' | grep -q .; then
  echo "FAIL: a release bundle contains video files" >&2
  find "$OUT" -iname '*.mp4' >&2
  exit 1
fi
# Media import 1: the prototype posters (and anything else from
# assets/prototype) are development-only too.
if find "$OUT" -path '*prototype*' | grep -q . || grep -rl 'assets/prototype' "$OUT" >/dev/null; then
  echo "FAIL: a release bundle contains prototype media (assets/prototype)" >&2
  find "$OUT" -path '*prototype*' >&2
  exit 1
fi
# Security round 2 (P3): no secret in any release bundle.
node scripts/security-check.mjs --bundle "$OUT" --no-history --offline >/dev/null || {
  node scripts/security-check.mjs --bundle "$OUT" --no-history --offline >&2
  exit 1
}
# The internal test build (EAS profiles "internal" and "apk", Daniel Oct 3)
# carries the launch set as drafts and the shoulder program's checked clips
# (Phase 32 B1, offline), but no prototype media, purchase simulator or
# secrets: the other clips stream from Storage.
INT="$(mktemp -d)"
trap 'rm -rf "$OUT" "$INT"' EXIT
EXPO_PUBLIC_APP_VARIANT=internal EXPO_OFFLINE=1 CI=1 npx expo export --clear --platform android --output-dir "$INT" >/dev/null
if ! grep -rl 'Launch set for the professional review' "$INT" >/dev/null; then
  echo "FAIL: the internal build has no exercise library" >&2
  exit 1
fi
if ! grep -rl 'Bundled shoulder program media' "$INT" >/dev/null; then
  echo "FAIL: the internal build has no bundled shoulder media" >&2
  exit 1
fi
if find "$INT" -path '*prototype*' | grep -q . \
  || grep -rl 'Prototype exercise videos\|simulateFirstCharge' "$INT" >/dev/null; then
  echo "FAIL: the internal build contains prototype media or the purchase simulator" >&2
  exit 1
fi
node scripts/security-check.mjs --bundle "$INT" --no-history --offline >/dev/null || {
  node scripts/security-check.mjs --bundle "$INT" --no-history --offline >&2
  exit 1
}
echo "OK (internal): launch set and shoulder media inside, no prototype media, simulator or secrets"
echo "OK: no draft exercises, draft Repair tests, the draft movement catalog, prototype videos or posters, purchase simulator, dev-only warnings, personal contact or secrets in release bundles"
