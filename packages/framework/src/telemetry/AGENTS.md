# Telemetry Framework Code

- This folder owns removable runtime telemetry helpers for local profiling.
- Keep the layer generic and opt-in through environment configuration.
- Do not add module-specific storage schemas, migrations, procedures, or Control
  Plane UI code here.
- Telemetry records must avoid procedure input values and SQL parameter values.
- Framework telemetry may publish batches to the process event bus, but it must
  not own telemetry storage or reporting.

## Adding Spans And Metrics

- Use OpenTelemetry semantic conventions before adding a domain-specific
  attribute, metric, or span name. RPC, DB, HTTP, messaging, errors, and service
  identity must use the published OpenTelemetry names.
- Add a span for a distributed boundary or a bounded domain stage that explains
  time inside an existing trace. Do not add spans for every row, message,
  relation, file slot, retry attempt, or loop iteration.
- Span names must be stable operation or stage names. Do not put IDs, counts,
  raw input values, SQL text, URLs, paths, chat IDs, message IDs, trace IDs, or
  user text in span names.
- Span attributes may include only low-cardinality dimensions that are useful for
  grouping traces. Put high-cardinality values on logs or explicit debug output,
  not on spans.
- Use duration histograms for latency and processing time. Use gauges for current
  state. Add counters only for monotonic events where an existing histogram
  `_count` series is not the right event count.
- Duration values are seconds. Timestamp gauges use Unix seconds unless a target
  UI query explicitly converts them to another unit.
- Metric names in code use OpenTelemetry-style dotted names. Prometheus names are
  derived by the exporter; do not write code against generated Prometheus names.
- Metric labels must be bounded, stable, and intentionally chosen. Never add raw
  URLs, SQL parameters, IDs, message text, usernames, tokens, trace IDs,
  timestamps, unbounded status strings, or exception messages as metric labels.
- Failed spans and failed duration metrics must use the standard `error.type`
  attribute. Do not create parallel `ok`, `success`, or `failed` label schemes.
- When adding a metric, add or update the owning dashboard in the same change, or
  document why the metric is intentionally not graphed. A new metric without a
  dashboard decision is an incomplete change.
- Do not add compatibility metric names, duplicate old/new signals, adapter
  labels, or migration-only telemetry. Replace the contract directly.
- Tests for instrumentation must assert the exported names and attributes and
  must assert that sensitive raw input is not recorded.
