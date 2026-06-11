# Framework Package

- Do not hide material facts from the user. Explicitly disclose API changes,
  signature changes, compatibility paths, fallback behavior, architectural
  violations, failed checks, risky assumptions, and any workaround before or
  when presenting the change.
- This package defines the current module runtime vocabulary only: `module`,
  `resource`, `process`, `procedure`, event bus, and typed internal RPC
  clients.
- This package is the module boundary foundation.
- Do not add domain-specific code here. Telegram, history sync, files, TDLib,
  database schemas, and Dashboard screens belong outside this package.
- Keep public API small. A new exported function is allowed only when it names a framework concept directly.
- Root exports must stay empty by default. Export only values with a real
  current consumer outside this package. Framework tests may import internal
  files by relative path; tests alone do not justify widening `src/index.ts`.
  Run `npx knip` before adding or keeping package public exports.
- Events are not a public module manifest surface. Do not add event registration or publish guards.
- Module apps use the `connect` option with separate `events` and `rpc`
  providers. Do not add top-level transport options.
- Do not add dependency injection containers, named runtime lookups, compatibility layers, or framework aliases.
- Every new folder in this package must include its own `AGENTS.md` before code is added there.
