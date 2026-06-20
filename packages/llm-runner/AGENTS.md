# LLM Runner Package

- This package owns LLM action execution, run lifecycle, profile adapter wiring,
  and dataset output for pipeline nodes.
- Source selection and rendered prompt input belong upstream in `data` and
  `pipelines`, not in this package.
- Profiles are connection/runtime configuration. Do not put prompt templates or
  semantic capability types in profiles.
- Do not add source resolver ports, artifact storage, policies, triggers,
  Telegram storage, TDLib, or provider-specific response shapes to the public
  package surface.
