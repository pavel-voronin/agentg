# Reconciler Adapters

- This folder is the reconciler boundary for upstream TDLib payloads.
- TDLib response objects may be accepted here and converted to Telegram domain
  records or changes.
- Do not import Drizzle tables or storage modules here.
