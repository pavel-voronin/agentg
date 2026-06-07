# Observability

AgentG emits OpenTelemetry traces and metrics when `AGENTG_TELEMETRY` is enabled.
The local development observability stack uses VictoriaMetrics for metrics,
Jaeger all-in-one in-memory for traces, prometheus-nats-exporter for NATS server
metrics, and Grafana for dashboards and trace correlation links. This stack is
development-only and intentionally ephemeral: Jaeger uses its default transient
in-memory storage, VictoriaMetrics is mounted on `tmpfs` in Docker Compose, and
Grafana is provisioned from repository files instead of a persistent volume.

## Local Backends

With `AGENTG_TELEMETRY=1`, `npm run infra:up` starts:

- VictoriaMetrics on `http://127.0.0.1:8428`
- prometheus-nats-exporter for NATS server metrics
- Jaeger UI on `http://127.0.0.1:16686`
- Grafana on `http://127.0.0.1:3000`

With `AGENTG_TELEMETRY=0`, `npm run infra:up` starts only Postgres and NATS, and
NATS server metrics are not scraped.

Runtime defaults:

- metrics OTLP HTTP endpoint:
  `http://127.0.0.1:8428/opentelemetry/v1/metrics`
- traces OTLP HTTP endpoint:
  `http://127.0.0.1:4318/v1/traces`

`npm run dev` starts local module processes through Process Compose. The
`process-compose.yaml` environment defaults `AGENTG_TELEMETRY` to enabled and
sets each process `OTEL_SERVICE_NAME` from its Process Compose service name. The
same service name is used as the low-cardinality `source` metric label, so
Grafana can correlate VictoriaMetrics series with Jaeger services. Docker
Compose keeps telemetry opt-in through `AGENTG_TELEMETRY`, which defaults to
disabled for direct Docker Compose runs and can be overridden with
`AGENTG_TELEMETRY=1`.

## Signals

Traces:

- RPC client and server calls
- Control Plane server procedure calls
- Postgres query classifications and relation names
- Telegram live update persistence

Metrics:

- operation call count, error count, duration histogram
- TDLib update handler catalog gauge
- TDLib update last-seen gauge
- Telegram ingestion queue pending/running/concurrency gauges
- prometheus-nats-exporter metrics scraped by VictoriaMetrics from NATS
  monitoring endpoints

NATS server time-series use the upstream prometheus-nats-exporter metric names.
The local exporter enables `varz`, `connz_detailed`, `subz`, and `healthz` only
when `AGENTG_TELEMETRY` is enabled; detailed connection and subscription series
are allowed here because this stack is not used in production.

Metric labels must stay low-cardinality. Do not add raw URLs with query strings,
chat IDs, message IDs, trace IDs, SQL parameters, message text, secrets, or
other user data as metric labels.

## Control Plane

The telemetry page is a thin read and navigation surface:

- `telemetry.links` is a Control Plane backend procedure that reads backend UI
  links for embedded dashboards and debug tools.
- The Operations, TDLib Updates, and NATS tabs embed provisioned Grafana
  dashboards. Dashboard UIDs and slugs are fixed in the Control Plane component;
  backend-provided links cover only external observability tool base URLs.
- The NATS dashboard is backed by prometheus-nats-exporter metrics.

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

The provisioned `Operations` dashboard reads operation rate, p95 latency,
error-rate series, and recent traces from Grafana data sources. Metric panels
link to Jaeger searches by `source`, `operation_kind`, and `operation_name`.
Jaeger UI is configured with outbound links back to Grafana.

The provisioned `TDLib Updates` dashboard reads the handler catalog from
`agentg_telegram_update_catalog_info` so all registered TDLib update handlers
stay visible even before a selected window has traffic. It joins that catalog
with `ingestion.update` operation calls, errors, error rate, p50/p95/p99 latency,
total processing time, last-seen timestamps, and Jaeger drill-down links for
individual update operation traces.
