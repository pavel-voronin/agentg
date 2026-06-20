# Data Source

- Keep the module centered on model refs, datasets, provider calls, annotations,
  collections, and `data.*` action execution.
- Provider calls must go through RPC targets from configuration.
- Direct data procedures return direct results. Pipeline action procedures return
  action results with `ready` or `rejected`.
- Do not add Telegram-specific filters or LLM behavior in this package.
