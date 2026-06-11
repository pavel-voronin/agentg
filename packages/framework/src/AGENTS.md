# Framework Source

- Do not hide material facts from the user. Explicitly disclose API changes,
  signature changes, compatibility paths, fallback behavior, architectural
  violations, failed checks, risky assumptions, and any workaround before or
  when presenting the change.
- `index.ts` is only the package public barrel.
- `index.ts` must export only the current public package surface. Do not export
  internal helpers, test helpers, or types without an
  outside-package consumer. Run `npx knip` before changing it.
- `config.ts` owns schema-first config parsing. It must return plain typed data
  only.
- `module.ts` owns module setup, resources, framework connectivity, and process lifecycle.
- `database/` owns standard database resource providers.
- `rpc/rpc.ts` owns the generic RPC contract.
- `rpc/httpRpc.ts` owns the default HTTP JSON RPC implementation.
- `events/eventBus.ts` owns the generic event bus contract.
- `events/nats.ts` owns the default NATS-backed event bus implementation.
- `json.ts` owns JSON-safe value primitives and conversion used by framework
  consumers.
- `types.ts` contains shared internal framework types.
- Keep functions short and explicit. Do not hide domain work in helpers.
- The only supported module definition form is
  `defineModule('name', { config: readConfig, setup(...) { ... } })`.
  Do not add shorthand overloads, compatibility forms, `defineModule<Config>(...)`,
  or exported `ModuleSetup` for module authors.
- `resource` creates module-owned runtime capabilities. Resource lifecycle must
  be declared inside the `resource()` factory through scoped `startup`,
  `shutdown`, and `background`.
- `resource()` returns only the usable resource surface. Do not return or expose
  lifecycle wrappers such as `{ resource, start, stop }`.
- `background(fn)` inside a resource uses the resource name.
- `background(name, fn)` inside a resource uses `resource.name`. Duplicate
  process names are allowed and receive stable numeric suffixes internally.
- `defineInternalRpcDomain` creates typed internal procedure clients over the
  default HTTP RPC transport. Domain packages own and export their own clients.
- `startup` registers blocking module readiness work. It must complete before
  RPC exposure.
- `background` registers runtime loops, observers, and consumers that start
  after RPC exposure.
- Module `setup()` returns the public module procedure map directly. Do not add
  `app.procedures`, `{ procedures }` envelopes, static `.procedures` fields, or
  runtime procedure accessors.
- Dashboard contributions are not module surface. Keep them in Dashboard-owned
  filesystem discovery.
- Event bus code must stay simple: publish by string type, subscribe by subject, no event registration, no validation layer.
- Modules receive `events` from setup. Module packages must not create NATS
  connections themselves.
- Module app creation requires explicit `connect.events` and `connect.rpc`
  providers. Do not add hidden transport addresses.
- Do not add transport-specific code here unless the framework concept requires it.
