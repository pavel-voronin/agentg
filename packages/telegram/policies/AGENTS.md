# Telegram Policy Definitions

- This folder owns Telegram policy definitions only.
- Definitions must be pure: no database, TDLib, event bus, module setup, RPC
  clients, process startup, or file-system access.
- Keep runtime consumption in `src/module.ts` through framework `usePolicy`.
- Keep Telegram file decision behavior in `src/files`; this folder declares the
  configurable policy shape and resolver only.
