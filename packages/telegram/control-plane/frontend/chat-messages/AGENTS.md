# Chat Messages Frontend Helpers

- This folder contains browser-only state, normalization, and view-model helpers
  for the Telegram chat messages Control Plane content.
- Do not put Vue SFC files here. Repeated visual blocks belong in
  `../components/`; this folder owns composables and plain TypeScript helpers.
- Do not import backend code, Telegram runtime code, TDLib code, storage code,
  Node-only code, or deleted old-contour packages.
- Keep helpers focused by responsibility: data loading, scroll behavior,
  response normalization, and timeline view-model building stay in separate
  files.
