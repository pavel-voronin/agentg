# Framework Tests

- Do not hide material facts from the user. Explicitly disclose API changes,
  signature changes, compatibility paths, fallback behavior, architectural
  violations, failed checks, risky assumptions, and any workaround before or
  when presenting the change.
- Tests here describe framework semantics, not domain behavior.
- Do not add Telegram, database, Control Plane, TDLib, or transport fixtures here.
- Prefer tests that protect the public API shape from hidden lifecycle or dependency-injection behavior.
