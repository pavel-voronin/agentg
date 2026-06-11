# Discovery Rules

- Discovery scans module-owned Dashboard contributions under
  `packages/*/dashboard/dashboard.ts`.
- The discovered entrypoint is a Dashboard-specific file, not runtime module
  surface.
- Do not parse `dashboard.ts` source text for contribution contents. Import
  the entrypoint through Vite's module graph and read its exported
  `dashboard.contents`.
- Keep discovery filesystem-based. Do not read Dashboard contributions from
  service manifests.
- When adding or removing module Dashboard entrypoints, Vite must invalidate
  the virtual provider module and reload the browser.
