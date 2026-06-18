# LLM Runner Source

- Keep runtime code organized around runs, artifacts, sources, and profiles.
- Procedures validate their own inputs and return direct current results.
- Do not export procedure-specific DTO types for other packages.
- Do not import Telegram internals. Use configured source resolver RPC targets.
