# Files

- Do not import, depend on, wrap, call, or adapt deleted old-contour packages such as `@agentg/events`, `@agentg/service-directory`,
  `@agentg/database`. If one appears necessary, stop and report the boundary violation before editing code.

- This folder owns the Telegram file subsystem contract and file-specific
  policies for the current module.
- Keep file download implementation here when it is ported.
- Store code may depend on the file subsystem contract, but this folder must not
  depend on store internals except through explicit persistence functions.
- Do not import through `@agentg/telegram`; use owner-folder relative imports inside this package.
