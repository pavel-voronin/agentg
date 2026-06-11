# History Sync Dashboard Backend

- This folder owns History Sync Dashboard-only backend code.
- Procedures here serve History Sync Dashboard UI and forward through the typed
  History Sync module client.
- Procedures here are not public module procedures for other modules.
- Accept resources explicitly from `createProcedures(resources)`.
- Keep frontend code and Vue components out of this folder.
