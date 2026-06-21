# Pipelines Source

- Pipeline actions are dispatched through module RPC targets. Keep action
  validation and side effects in the action provider.
- The runtime may inspect action ids and dependency graph structure, but must not
  interpret Telegram, LLM provider, or data storage internals.
- Writes are ordinary nodes. Do not add detached write blocks.
