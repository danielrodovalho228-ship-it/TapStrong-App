#!/usr/bin/env bash
# Proves the draft exercise library and the prototype videos never ship
# (SPEC §2.1, §6): exports release bundles and fails if any contains them.
# Slower than unit tests (~1 min); run before any store build.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT

cd "$ROOT"
EXPO_OFFLINE=1 CI=1 npx expo export --platform android --platform ios --platform web --output-dir "$OUT" >/dev/null

if grep -rl 'Prototype exercise library' "$OUT" >/dev/null; then
  echo "FAIL: a release bundle contains the draft exercise library" >&2
  grep -rl 'Prototype exercise library' "$OUT" >&2
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
if grep -rl 'simulateFirstCharge' "$OUT" >/dev/null; then
  echo "FAIL: a release bundle contains the development purchase simulator" >&2
  exit 1
fi
if find "$OUT" -iname '*.mp4' | grep -q .; then
  echo "FAIL: a release bundle contains video files" >&2
  find "$OUT" -iname '*.mp4' >&2
  exit 1
fi
echo "OK: no draft exercises, draft Repair tests, prototype videos or purchase simulator in release bundles"
