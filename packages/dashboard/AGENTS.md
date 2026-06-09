# Dashboard Rules

- This package is the new Dashboard process. It owns the shell, HTTP server,
  WebSocket host, and filesystem discovery of module Dashboard entrypoints.
- Use `@agentg/framework` for event bus, registry access, config, and
  procedure calls.
- Do not read module `dashboard` fields from registry manifests. Module
  Dashboard contributions are discovered from filesystem entrypoints.
- Runtime Vue content is loaded through Vite direct imports so development HMR
  works for module-provided Dashboard components.
- Keep backend server code under `src/server`.
- Keep browser runtime code under `src/runtime`, `src/components`, `src/stores`,
  `src/composition`, and `src/view-models`.
