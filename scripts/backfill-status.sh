#!/usr/bin/env bash
set -euo pipefail

compose=(docker compose)
psql=("${compose[@]}" exec -T postgres psql -U agentg -d agentg)

echo "== History sync objects =="
"${psql[@]}" -c "
select
  (select count(*) from history_templates) as templates,
  (select count(*) from history_targets) as targets,
  (select count(*) from history_coverage) as coverage_intervals,
  (select count(*) from backfill_jobs) as backfill_jobs;
"

echo
echo "== Backfill jobs by status =="
"${psql[@]}" -c "
select
  status,
  count(*) as jobs,
  min(start_at) as oldest_start,
  max(end_at) as newest_end,
  max(updated_at) as last_update
from backfill_jobs
group by status
order by status;
"

echo
echo "== Runnable jobs =="
"${psql[@]}" -c "
select
  id,
  telegram_chat_id,
  start_at,
  end_at,
  status,
  cursor is not null as has_cursor,
  updated_at
from backfill_jobs
where status in ('pending', 'running')
order by end_at desc, start_at desc
limit 25;
"

echo
echo "== Coverage by chat =="
"${psql[@]}" -c "
select
  telegram_chat_id,
  count(*) as intervals,
  min(start_at) as oldest_coverage,
  max(end_at) as newest_coverage
from history_coverage
group by telegram_chat_id
order by newest_coverage desc
limit 25;
"
