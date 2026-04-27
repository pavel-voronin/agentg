#!/usr/bin/env bash
set -euo pipefail

compose=(docker compose)
psql=("${compose[@]}" exec -T postgres psql -U agentg -d agentg)

echo "== Backfill scheduler =="
"${psql[@]}" -c "
select
  value->>'phase' as phase,
  value->>'privateWindowEndIso' as private_window_end,
  value->>'groupChannelWindowEndIso' as group_channel_window_end,
  updated_at
from telegram_sync_state
where key = 'telegram:backfill:v2:scheduler';
"

echo
echo "== Window progress by phase =="
"${psql[@]}" -c "
select
  value->>'phase' as phase,
  count(*) as states,
  count(*) filter (where (value->>'windowComplete')::boolean) as complete,
  count(*) filter (where not (value->>'windowComplete')::boolean) as incomplete,
  sum((value->>'fetchedCount')::bigint) as fetched,
  max(updated_at) as last_update
from telegram_sync_state
where key like 'telegram:backfill:v2:%:%'
group by value->>'phase'
order by phase;
"

echo
echo "== Incomplete windows =="
"${psql[@]}" -c "
select
  replace(replace(key, 'telegram:backfill:v2:', ''), ':', ' / ') as window,
  value->>'windowStartIso' as window_start,
  value->>'windowEndIso' as window_end,
  (value->>'fetchedCount')::bigint as fetched,
  value->>'cursorMessageId' as cursor_message_id,
  updated_at as last_update
from telegram_sync_state
where key like 'telegram:backfill:v2:%:%'
  and not (value->>'windowComplete')::boolean
order by updated_at desc
limit 25;
"
