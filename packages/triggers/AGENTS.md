# Triggers Package

- This package owns `TriggerRule` policy semantics, materialized trigger
  registrations, occurrence scheduling, leases, dispatch, and trigger events.
- Keep action input opaque. Target modules own action-specific validation and
  execution after accepting a dispatched occurrence.
- Do not import domain package internals for dispatch. Use configured module RPC
  targets and ordinary procedure calls.
- Keep package root exports minimal. Export only a typed client when another
  current package consumes it.
