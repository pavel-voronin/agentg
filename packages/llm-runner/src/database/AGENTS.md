# Database

- This folder owns LLM run storage schema, async output dataset storage, and
  Postgres resource wiring.
- Tables must use the `llm_runner_` prefix.
- Keep provider credentials out of database rows.
