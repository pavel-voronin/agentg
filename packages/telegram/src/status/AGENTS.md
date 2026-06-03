# Status

- This folder owns the Telegram module status resource.
- Keep status state, status resource types, and status factories here.
- Other folders may consume the status resource through explicit resource
  parameters, but must not declare status types or create status instances.
- Do not add TDLib ingestion, file, database, history, or UI logic here.
