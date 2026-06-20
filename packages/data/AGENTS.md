# Data Module

- Owns the shared addressable model space, provider routing, annotations,
  collections, and `data.*` pipeline actions.
- Provider-owned lifecycle and storage stay in provider modules. Do not read or
  write provider-owned tables from this package.
- Keep action procedures as module capabilities. Do not add policy, trigger, LLM
  provider, or Telegram-specific behavior here.
- Do not export DTO types speculatively. Export only the typed internal client
  and intentional shared model contracts used by current consumers.
