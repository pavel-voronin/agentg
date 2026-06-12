# History Reconciler

- This folder owns the Telegram history reconciler subsystem.
- The reconciler is private to Telegram. It may use Telegram storage, TDLib
  operations, file-slot recording, events, and telemetry, but it must not become
  a public module procedure or a package-root client surface.
- It owns durable history jobs, owner-scoped coverage convergence, TDLib paging,
  completion/failure events, and bounded observability for this lifecycle.
- Do not add compatibility paths, old/new parallel implementations, or caller
  choices for worker strategy.
- Metrics and spans must use low-cardinality labels. Request ids, owner keys,
  chat ids, message ids, raw date ranges, and error text stay out of metric
  labels and span names.
