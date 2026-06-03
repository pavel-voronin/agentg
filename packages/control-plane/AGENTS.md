# Control Plane Rules

- This package is the new Control Plane process. It owns the shell, HTTP server,
  WebSocket host, and filesystem discovery of module Control Plane entrypoints.
- Use `@agentg/framework` for event bus, registry access, config, and
  procedure calls.
- Do not read module `controlPlane` fields from registry manifests. Module
  Control Plane contributions are discovered from filesystem entrypoints.
- Runtime Vue content is loaded through Vite direct imports so development HMR
  works for module-provided Control Plane components.
- Keep backend server code under `src/server`.
- Keep browser runtime code under `src/runtime`, `src/components`, `src/stores`,
  `src/composition`, and `src/view-models`.
