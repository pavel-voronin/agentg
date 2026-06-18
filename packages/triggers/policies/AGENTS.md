# Trigger Policy Definitions

- This folder owns `TriggerRule` policy definitions only.
- Definitions must stay pure: no database, event bus, RPC clients, process
  startup, timers, or file-system access.
- Runtime consumption belongs in `src/module.ts` through framework `usePolicy`.
