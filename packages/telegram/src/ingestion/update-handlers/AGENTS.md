# Update Handlers

- Do not import, depend on, wrap, call, or adapt deleted old-contour packages such as `@agentg/events`, `@agentg/service-directory`,
  `@agentg/database`. If one appears necessary, stop and report the boundary violation before editing code.

- This folder contains one handler file per TDLib update type.
- Handler file names must match the TDLib update type, for example
  `updateNewMessage.ts`.
- Keep handlers as direct ports of the reviewed reviewed handler logic unless a
  specific incompatibility is found and disclosed.
- If a handler needs database, files, live coverage, status, or update events,
  accept `resources: IngestionResources` from the registry dispatcher.
- Do not add handler plans or long comments here.
- Do not import Telegram runtime code.
