# Registry Package

- Do not hide material facts from the user. Explicitly disclose API changes,
  signature changes, compatibility paths, fallback behavior, architectural
  violations, failed checks, risky assumptions, and any workaround before or
  when presenting the change.
- This package is the deployable Registry runner for the module boundary.
- Registry logic, contracts, registry, client, and helpers belong to
  `@agentg/framework`; this package only provides config and process
  startup.
- Do not add module RPC, query/mutation vocabulary, compatibility envelopes, or local
  Registry contracts here.
- Every new folder in this package must include its own `AGENTS.md` before code is added there.
