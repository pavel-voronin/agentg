# Pipelines Module

- Owns named pipeline YAML documents, validation, run lifecycle, node execution,
  and trigger registration for pipeline schedules.
- Do not store semantic data here. Semantic reads/writes go through action
  providers such as `data.*`.
- Do not call Telegram storage, TDLib, LLM providers, or provider tables
  directly from this package.
- Trigger schedules compile into owner-scoped registrations in `triggers`.
