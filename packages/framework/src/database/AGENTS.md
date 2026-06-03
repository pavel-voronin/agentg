# Database Framework Code

- Do not hide material facts from the user. Explicitly disclose API changes,
  signature changes, compatibility paths, fallback behavior, architectural
  violations, failed checks, risky assumptions, and any workaround before or
  when presenting the change.
- This folder owns standard database resource providers for modules.
- Keep provider contracts generic. Domain schema, migrations, table names, and
  query helpers belong to the module that owns them.
- `postgres.ts` owns the standard Postgres/Drizzle resource provider.
- Do not add module-specific storage code here.
