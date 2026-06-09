# Chat Messages Frontend Helpers

- This folder contains browser-only state, normalization, and view-model helpers
  for the Telegram chat messages Dashboard content.
- Do not put Vue SFC files here. Repeated visual blocks belong in
  `../components/`; this folder owns composables and plain TypeScript helpers.
- Do not import backend code, Telegram runtime code, TDLib code, storage code,
  or Node-only code,.
- Keep helpers focused by responsibility: data loading, scroll behavior,
  response normalization, and timeline view-model building stay in separate
  files.
