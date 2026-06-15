# Reconciler Tests

- This folder contains focused tests for the private Telegram history
  reconciler subsystem.
- Tests here may import internal reconciler files by relative path. Do not widen
  package-root exports for test convenience.
- Keep assertions on runtime behavior, history source adapters, and bounded
  telemetry labels.
- Do not require live TDLib, real file downloads, Grafana, or external telemetry
  backends in unit tests.
