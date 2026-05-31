# Discovery Rules

- Do not import, depend on, wrap, call, or adapt deleted old-contour packages such as `@agentg/events`, `@agentg/service-directory`,
  `@agentg/database`. If one appears necessary, stop and report the boundary violation before editing code.

- Discovery scans module-owned Control Plane contributions under
  `packages/*/control-plane/controlPlane.ts`.
- The discovered entrypoint is a Control Plane-specific file, not runtime module
  surface.
- Do not parse `controlPlane.ts` source text for contribution contents. Import
  the entrypoint through Vite's module graph and read its exported
  `controlPlane.contents`.
- Keep discovery filesystem-based. Do not read Control Plane contributions from
  registry manifests.
- When adding or removing module Control Plane entrypoints, Vite must invalidate
  the virtual provider module and reload the browser.
