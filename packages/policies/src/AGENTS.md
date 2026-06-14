# Policies Source

- `main.ts` is only the local process entrypoint.
- `module.ts` composes the policy server, file store, generated catalog, events,
  and RPC procedures.
- `store.ts` owns YAML persistence and canonical path rules.
- `config.ts` owns process config parsing.
- `generated/` is produced by the catalog generator and must not be edited by
  hand except for bootstrapping this package before generation runs.
