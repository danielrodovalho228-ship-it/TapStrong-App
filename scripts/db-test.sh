#!/usr/bin/env bash
# Applies all migrations to a throwaway Postgres database and runs the SQL tests.
# Needs a local Postgres (psql) reachable via standard PG* env vars.
# In CI with Docker, prefer `npx supabase start && npx supabase db reset`.
set -euo pipefail

DB="tapstrong_test_$$"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT

run() { psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$1"; }

run "$ROOT/supabase/tests/local/auth_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "migrate: $(basename "$f")"
  run "$f"
done
if [[ -f "$ROOT/supabase/seed.sql" ]]; then
  echo "seed: seed.sql"
  run "$ROOT/supabase/seed.sql"
fi
for f in "$ROOT"/supabase/tests/local/*.sql; do
  [[ "$(basename "$f")" == auth_stub.sql ]] && continue
  echo "test: $(basename "$f")"
  run "$f"
done
