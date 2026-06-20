# LLM Runner Source

- Keep runtime code organized around actions, profiles, runs, events, and
  dataset output.
- Procedures validate their own inputs and return direct current results.
- Do not export procedure-specific DTO types for other packages.
- Do not import Telegram internals and do not add source resolver RPC targets.
  Pipeline input arrives as a prepared dataset.
