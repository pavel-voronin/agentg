# Observability

AgentG emits OpenTelemetry traces and metrics when `AGENTG_TELEMETRY` is enabled.
The local development observability stack uses OpenTelemetry Collector as the
OTLP ingress, VictoriaMetrics for metrics, Jaeger all-in-one in-memory for
traces, prometheus-nats-exporter for NATS server metrics, postgres_exporter for
Postgres server metrics, and Grafana for dashboards and trace correlation links.
This stack is development-only and intentionally ephemeral: Jaeger uses its
default transient in-memory storage, VictoriaMetrics is mounted on `tmpfs` in
Docker Compose, and Grafana is provisioned from repository files instead of a
persistent volume.

## Local Backends

With `AGENTG_TELEMETRY=1`, `npm run infra:up` starts:

- OpenTelemetry Collector OTLP HTTP on `http://127.0.0.1:4318`
- OpenTelemetry Collector OTLP gRPC on `127.0.0.1:4317`
- VictoriaMetrics on `http://127.0.0.1:8428`
- prometheus-nats-exporter for NATS server metrics
- postgres_exporter for Postgres server metrics
- Jaeger UI on `http://127.0.0.1:16686`
- Grafana on `http://127.0.0.1:3000`

With `AGENTG_TELEMETRY=0`, `npm run infra:up` starts only Postgres and NATS, and
OpenTelemetry Collector, VictoriaMetrics, Jaeger, Grafana, NATS exporter, and
Postgres exporter are not started.

Runtime defaults:

- metrics OTLP HTTP endpoint:
  `http://127.0.0.1:4318/v1/metrics`
- traces OTLP HTTP endpoint:
  `http://127.0.0.1:4318/v1/traces`

The Collector forwards metrics to
`http://victoria-metrics:8428/opentelemetry/v1/metrics` and traces to
`http://jaeger:4318/v1/traces`.

`npm run dev` starts local module processes through Process Compose. The
`process-compose.yaml` environment defaults `AGENTG_TELEMETRY` to enabled and
sets each process `OTEL_SERVICE_NAME` from its Process Compose service name. The
same service name is exported as the OpenTelemetry `service.name` resource
attribute and appears in VictoriaMetrics as `service_name`, so Grafana can
correlate metric series with Jaeger services. Docker Compose keeps telemetry
opt-in through `AGENTG_TELEMETRY`, which defaults to disabled for direct Docker
Compose runs and can be overridden with `AGENTG_TELEMETRY=1`.

## Signals

Traces:

- RPC client and server calls with OpenTelemetry RPC semantic attributes
- Control Plane server procedure calls
- Postgres query operation, summary, system, and relation attributes
- NATS publish/process spans with OpenTelemetry messaging semantic attributes
- Telegram live update persistence and bounded UI/file pipeline stages

Metrics:

- OpenTelemetry RPC client/server duration histograms
- OpenTelemetry DB client operation duration histograms
- OpenTelemetry messaging publish/process duration histograms
- TDLib update processing duration histogram
- TDLib update handler catalog gauge
- TDLib update last-seen gauge in Unix seconds
- Telegram ingestion queue pending/running/concurrency gauges
- Telegram ingestion queue wait duration histogram
- Telegram messages-page and message-view stage duration histograms
- Telegram file-record stage duration histogram
- Telegram file queue asset/job/byte gauges
- Telegram file worker wake and job outcome counters
- Telegram file worker stage duration histogram
- prometheus-nats-exporter metrics scraped by VictoriaMetrics from NATS
  monitoring endpoints
- postgres_exporter metrics scraped by VictoriaMetrics from Postgres statistics
  views and pg_stat_statements query IDs

NATS server time-series use the upstream prometheus-nats-exporter metric names.
The local exporter enables `varz`, `connz_detailed`, `subz`, and `healthz` only
when `AGENTG_TELEMETRY` is enabled; detailed connection and subscription series
are allowed here because this stack is not used in production.

Postgres server time-series use the upstream postgres_exporter metric names.
The local exporter disables settings metrics, role limits, replication slots,
and progress-vacuum collectors. It enables database, locks, replication,
stat_bgwriter, stat_database, stat_user_tables, statio_user_tables, WAL,
postmaster, database_wraparound, long_running_transactions,
stat_activity_autovacuum, stat_checkpointer, statio_user_indexes, and a limited
pg_stat_statements collector. VictoriaMetrics keeps only the Postgres metric
names used by the provisioned Postgres dashboard. Series with a `datname` label
are kept only for the application database, `agentg`; template and system
databases are dropped at scrape time. Exporter internals, Go runtime series,
pg_settings, and unrendered collector series are dropped at scrape time. Query
text labels stay disabled; pg_stat_statements is limited to the top 100
statement IDs to keep metric cardinality bounded.

Metric labels must stay low-cardinality. Do not add raw URLs with query strings,
chat IDs, message IDs, trace IDs, SQL parameters, message text, secrets, or
other user data as metric labels.

## Adding Signals

Every new span or metric must have a clear owner and a dashboard decision in the
same change.

Span rules:

- Use OpenTelemetry semantic conventions for RPC, DB, messaging, HTTP, service
  identity, and errors.
- Add spans only for distributed boundaries and bounded domain stages that make a
  trace easier to explain.
- Keep span names stable. Do not include user data, IDs, SQL text, URLs, file
  paths, counts, timestamps, or error messages in span names.
- Use attributes for low-cardinality grouping only. High-cardinality diagnostic
  data belongs outside metrics and ordinary trace attributes.

Metric rules:

- Use duration histograms for latency and processing time.
- Use gauges for current state such as queue size, concurrency, and last-seen
  timestamps.
- Use counters only when a histogram `_count` series is not the right count.
- Record durations in seconds. Record timestamp gauges as Unix seconds and
  convert in Grafana queries when a panel expects milliseconds.
- Use `error.type` for failed spans and failed duration metrics. Do not create
  parallel success/failure label schemes.
- Add each new metric to the owning Grafana dashboard, or explicitly document
  why it is intentionally not graphed.
- Do not keep old and new metric names, compatibility labels, or migration-only
  telemetry side by side.

## Control Plane

The telemetry page is a thin read and navigation surface:

- `telemetry.links` is a Control Plane backend procedure that reads backend UI
  links for embedded dashboards and debug tools.
- The Operations, Telegram, Files, History Sync, TDLib Updates,
  Postgres, and NATS tabs embed provisioned Grafana dashboards. Dashboard UIDs
  and slugs are fixed in the Control Plane component; backend-provided links
  cover only external observability tool base URLs.
- The NATS dashboard is backed by prometheus-nats-exporter metrics.
- The Postgres dashboard is backed by postgres_exporter metrics and app-level
  `db.client.operation.duration` metrics.

Control Plane does not subscribe to telemetry report events and does not run a
background report refresh loop. Further reads happen only during initialization
or an explicit refresh action.

## Debug Views

VictoriaMetrics VMUI:

- `http://127.0.0.1:8428/vmui`

Jaeger:

- `http://127.0.0.1:16686`

Grafana:

- `http://127.0.0.1:3000`

The provisioned `Operations` dashboard reads RPC call rate and p95 latency,
Postgres query p95 latency, Telegram domain-stage p95 latency, and recent traces
from Grafana data sources. Jaeger UI is configured with outbound links back to
Grafana for RPC methods and TDLib update types.

The provisioned `Telegram` dashboard groups module telemetry by internal
subsystem: ingestion, read path, storage, and events. It reads Telegram queue
gauges, queue wait latency, update processing latency, update catalog and
last-seen timestamps, non-file Control Plane Telegram RPC latency, messages-page
and message-view stage latency, non-file app DB client operation latency, and
non-file app-level NATS send/process latency for Telegram event subjects.

The provisioned `Files` dashboard is the operator x-ray for Telegram
file handling. It reads file queue asset, job, and byte gauges, unknown-size
backlog, worker wake reasons, worker job outcomes, worker stage latency and
rate, file-record stage latency and rate, file-facing Control Plane RPC latency
and rate, file-table DB latency and rate, `telegram.files.*` event send/process
telemetry, and recent Jaeger traces for file worker passes. The top row is made
of red-flag indicators rather than raw graphs: queued backlog, failed assets,
backlog without worker ticks, failure rate, file-download defer retry rate, and
stale recovery rate. Top-row rate panels use file queue gauges as the liveness
anchor, so no matching failure/defer/stale events render as zero only when file
queue telemetry itself is present; missing file telemetry remains visible as
`No telemetry`.

The provisioned `History Sync` dashboard groups module telemetry by controller,
sync stages, workload, and downstream boundaries. It reads controller pass
latency and errors, stage latency and errors, latest pass workload gauges,
monotonic totals for fetched pages, fetched messages, stored messages, and
covered intervals, History Sync RPC calls to Telegram, History Sync Postgres
client operations, History Sync NATS publishing, and NATS processing for History
Sync lifecycle events plus the Telegram chat directory update trigger.

The provisioned `TDLib Updates` dashboard reads the handler catalog from
`telegram_update_catalog_info` so all registered TDLib update handlers stay
visible even before a selected window has traffic. It joins that catalog with
`telegram_update_processing_duration_seconds_*` calls, errors, p50/p95/p99
latency, `telegram_update_last_seen_unix_seconds`, and Jaeger drill-down links
for individual update traces.

The provisioned `Postgres` dashboard is the contract for persisted Postgres
server metrics. It reads Postgres health, uptime, database size and connection
limit, wraparound age, long transactions, connections, locks, transaction and
rollback rates, tuple rates, cache and block I/O, temp files, deadlocks, table
scan and tuple access rates, table size, dead and modified tuples, vacuum and
analyze activity, table/index I/O, limited pg_stat_statements query ID hot
spots, checkpoint and WAL pressure, background writer activity, archiver
activity, replication signals, and app-level DB client operation rates and
latency.
