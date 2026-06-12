# History Sync Model

- This folder contains History Sync domain types and response/view projections.
- Do not import database clients, module setup, controller code, Telegram
  implementation files, or Dashboard components.
- Keep Telegram access represented by narrow Telegram domain procedure client
  types only. Do not model TDLib methods, page fetches, cursors, coverage table
  operations, or file materialization controls here.
