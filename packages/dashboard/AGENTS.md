# Dashboard Rules

- This package is the new Dashboard process. It owns the shell, HTTP server,
  WebSocket host, and filesystem discovery of module Dashboard entrypoints.
- Use `@agentg/framework` for event bus, config, and procedure transport.
- Module Dashboard contributions are discovered from filesystem entrypoints.
- Runtime Vue content is loaded through Vite direct imports so development HMR
  works for module-provided Dashboard components.
- Keep backend server code under `src/server`.
- Keep browser runtime code under `src/runtime`, `src/components`, `src/stores`,
  `src/composition`, and `src/view-models`.
