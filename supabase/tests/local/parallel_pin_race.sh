#!/usr/bin/env bash
# Security round 2, S2-P1-1: wrong PINs sent at the same time must never get
# more than 5 checks before the lock (the old function checked them all).
# Run by scripts/db-test.sh with DB=<database>.
set -euo pipefail

UID_A='00000000-0000-0000-0000-0000000fa001'
UID_B='00000000-0000-0000-0000-0000000fa002'
q() { psql -v ON_ERROR_STOP=1 -qAt -d "$DB" -c "$1"; }
as() { # as <uid> <sql>: one connection, signed in as <uid>
  psql -v ON_ERROR_STOP=1 -qAt -d "$DB" <<SQL
select set_config('request.jwt.claim.sub', '$1', false);
set role authenticated;
$2
SQL
}

q "insert into auth.users (id, is_anonymous) values ('$UID_A', false), ('$UID_B', false);"
q "insert into public.profiles (user_id, birth_month, birth_year, body_band, mode) values
   ('$UID_A', 4, 1985, 'adult', 'adult'), ('$UID_B', 4, 1985, 'adult', 'adult');"
as "$UID_A" "select public.set_parent_pin('1234');" >/dev/null
as "$UID_B" "select public.set_parent_pin('1234');" >/dev/null

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# Count every PIN comparison: in this throwaway database only, crypt() logs
# each call and takes 50 ms more, so parallel calls really overlap.
q "create table public.test_crypt_log (at timestamptz default clock_timestamp());
   alter function extensions.crypt(text, text) rename to crypt_real;
   create function extensions.crypt(text, text) returns text language plpgsql as \$f\$
   begin
     insert into public.test_crypt_log default values;
     perform pg_sleep(0.05);
     return extensions.crypt_real(\$1, \$2);
   end \$f\$;"

# 30 wrong PINs at once: exactly 4 "wrong", then locked.
for i in $(seq 1 30); do
  (as "$UID_A" "select result from public.verify_parent_pin('0000');" | tail -1 >"$tmp/a$i") &
done
wait
compares=$(q "select count(*) from public.test_crypt_log;")
if [[ "$compares" -gt 5 ]]; then
  echo "parallel wrong PINs: $compares PIN checks before the lock (at most 5)" >&2
  exit 1
fi
wrong=$(cat "$tmp"/a* | grep -c '^wrong$' || true)
locked=$(cat "$tmp"/a* | grep -c '^locked$' || true)
if [[ "$wrong" -ne 4 || "$locked" -ne 26 ]]; then
  echo "parallel wrong PINs: $wrong wrong, $locked locked (want 4 and 26)" >&2
  exit 1
fi

# 29 wrong + the right one at once: at most 5 wrong checks before any lock
# (the right one may land first and reset the count only once).
for i in $(seq 1 29); do
  (as "$UID_B" "select result from public.verify_parent_pin('0000');" | tail -1 >"$tmp/b$i") &
done
(as "$UID_B" "select result from public.verify_parent_pin('1234');" | tail -1 >"$tmp/b_ok") &
wait
# At most 5 checks before a lock, plus 5 more if the right one landed first.
checked=$(q "select count(*) from public.test_crypt_log;")
if [[ "$checked" -gt $((compares + 10)) ]]; then
  echo "parallel PINs with the right one: $((checked - compares)) checks (at most 10)" >&2
  exit 1
fi
q "delete from public.test_crypt_log;"
still_locked=$(as "$UID_B" "select result from public.verify_parent_pin('1234');" | tail -1)
if [[ "$(cat "$tmp/b_ok")" != "ok" && "$still_locked" != "locked" ]]; then
  echo "the right PIN neither passed in time nor was locked out: $still_locked" >&2
  exit 1
fi
echo "parallel_pin_race: all assertions passed"
