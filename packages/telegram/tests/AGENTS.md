# Telegram Tests

- Do not hide material facts from the user. Explicitly disclose API changes,
  signature changes, compatibility paths, fallback behavior, architectural
  violations, failed checks, risky assumptions, and any workaround before or
  when presenting the change.
- Tests here verify public module behavior only.
- Do not inspect internal resources, process names, or private setup state.
- Prefer behavior checks through the module's public integration surface.
