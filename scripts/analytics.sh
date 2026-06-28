#!/usr/bin/env bash
# analytics.sh — one-command access to the app_events behavioural log (migration 012).
#
# We have no third-party analytics; events live in Postgres and are queried out-of-band
# via the Supabase Management API. This wraps that call so you don't hand-write curl +
# jq every time. Reads SUPABASE_ACCESS_TOKEN from .env (same token the deploy uses).
#
# Usage:
#   scripts/analytics.sh counts                 # per-day, per-event volume (app_event_counts view)
#   scripts/analytics.sh recent [N]             # last N events (default 50), newest first
#   scripts/analytics.sh user <user_id>         # replay one user's full event timeline
#   scripts/analytics.sh funnel                 # onboarding funnel; abandonment = started − completed
#   scripts/analytics.sh sql "<raw SQL>"        # run any read-only query against the DB
#
# Output is the raw JSON from the API (pipe to `jq` to shape it).

set -euo pipefail

REF="tzlvhvihnoaypajraide"
ENV_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "error: .env not found at $ENV_FILE (needs SUPABASE_ACCESS_TOKEN)" >&2
  exit 1
fi

TOKEN="$(grep '^SUPABASE_ACCESS_TOKEN=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")"
if [[ -z "$TOKEN" ]]; then
  echo "error: SUPABASE_ACCESS_TOKEN missing from .env" >&2
  exit 1
fi

run_sql() {
  local sql="$1"
  curl -sf \
    -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    --data-binary "$(printf '{"query": %s}' "$(printf '%s' "$sql" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')")"
  echo
}

cmd="${1:-counts}"
case "$cmd" in
  counts)
    run_sql "select * from app_event_counts limit 100;"
    ;;
  recent)
    n="${2:-50}"
    run_sql "select created_at, user_id, name, props from app_events order by created_at desc limit ${n};"
    ;;
  user)
    [[ -n "${2:-}" ]] || { echo "usage: analytics.sh user <user_id>" >&2; exit 1; }
    run_sql "select created_at, name, props from app_events where user_id = '${2}' order by created_at;"
    ;;
  funnel)
    run_sql "select name, count(*) as events, count(distinct user_id) as users from app_events where name like 'onboarding_%' group by name order by name;"
    ;;
  sql)
    [[ -n "${2:-}" ]] || { echo "usage: analytics.sh sql \"<query>\"" >&2; exit 1; }
    run_sql "$2"
    ;;
  *)
    echo "unknown command: $cmd" >&2
    grep -E '^#( |$)' "$0" | sed 's/^# \{0,1\}//' >&2
    exit 1
    ;;
esac
