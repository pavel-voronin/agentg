# Files

- This folder owns the Telegram file subsystem contract and file-specific
  policies for the current module.
- Keep file download implementation here when it is ported.
- Store code may depend on the file subsystem contract, but this folder must not
  depend on store internals except through explicit persistence functions.
- Do not import through `@agentg/telegram`; use owner-folder relative imports inside this package.
