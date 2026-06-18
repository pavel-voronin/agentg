# Triggers Source

- `module.ts` composes config, database, policies, scheduler, dispatcher,
  events, and procedures.
- `runtime.ts` owns trigger orchestration.
- `database/` owns the Postgres resource and schema.
- `registrations/`, `occurrences/`, `scheduler/`, and `dispatcher/` own their
  named runtime responsibilities.
