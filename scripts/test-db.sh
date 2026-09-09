#!/bin/sh
# Runs the SQL invariant tests in supabase/tests/*.sql against the local
# Supabase stack. Each file runs in its own transaction and rolls back, so the
# database is left exactly as it was. Pass --reset to apply migrations and
# seeds first (`supabase db reset`).
#
# Usage: pnpm test:db [--reset]
set -eu

cd "$(dirname "$0")/.."

if [ "${1:-}" = "--reset" ]; then
  supabase db reset
fi

DB_URL=$(supabase status -o env 2>/dev/null | sed -n 's/^DB_URL="\(.*\)"$/\1/p')
if [ -z "$DB_URL" ]; then
  echo "supabase is not running; start it with 'supabase start'" >&2
  exit 1
fi

status=0
for f in supabase/tests/*.sql; do
  printf '%s ... ' "$f"
  if out=$(psql "$DB_URL" -v ON_ERROR_STOP=1 -q -X -f "$f" 2>&1); then
    echo "ok"
  else
    echo "FAIL"
    echo "$out" | sed 's/^/    /'
    status=1
  fi
done
exit $status
