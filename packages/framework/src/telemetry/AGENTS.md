# Telemetry Framework Code

- This folder owns removable runtime telemetry helpers for local profiling.
- Keep the layer generic and opt-in through environment configuration.
- Do not add module-specific storage schemas, migrations, procedures, or Control
  Plane UI code here.
- Telemetry records must avoid procedure input values and SQL parameter values.
- Framework telemetry may publish batches to the process event bus, but it must
  not own telemetry storage or reporting.
