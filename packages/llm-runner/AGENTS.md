# LLM Runner Package

- This package owns LLM-backed processing, run lifecycle, profile adapter
  wiring, source resolver ports, and current artifacts.
- Keep source-domain selector semantics outside this package.
- Profiles are connection/runtime configuration. Do not put prompt templates or
  semantic capability types in profiles.
- Do not make policies, triggers, Telegram storage, TDLib, or provider-specific
  response shapes part of the public package surface.
