# Ingestion

- This folder owns TDLib update ingestion for the current Telegram module.
- Preserve update handler coverage mechanically: every reviewed handler file must
  have a matching current handler file and catalog entry until the reviewed handler inventory is complete.
- `updateCoverage.test.ts` is the migration guard. Do not weaken it to make a
  port compile.
- Update handlers must receive module resources from the dispatcher. Do not add
  `useDatabase`, `useFiles`, `useLiveCoverage`, `useStatus`, or
  `useUpdateEvents` accessors here.
- `resources.ts` may only compose the resource shape from owner-folder types.
  It must not declare database, file, live coverage, status, or event resource
  contracts and must not create resource instances.
- Keep TDLib client creation in `src/tdlib/`; this folder consumes the TDLib
  resource and routes updates to storage, file, history, and event resources.
- Do not import through `@agentg/telegram`; use owner-folder relative imports inside this package.
