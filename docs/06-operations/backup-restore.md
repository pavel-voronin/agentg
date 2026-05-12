# Backup And Restore

Not defined yet.

## Backup Candidates

- Postgres database.
- TDLib session and local database.

## Open Questions

- Should TDLib session backup be encrypted separately?
- What is the restore procedure on a new machine?
- Should modeled diagnostic tables and durable domain tables have different
  backup policies?
