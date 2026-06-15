# Update Handlers

- This folder contains one handler file per TDLib update type.
- Handler file names must match the TDLib update type, for example
  `updateNewMessage.ts`.
- Keep handlers as direct ports of the reviewed reviewed handler logic unless a
  specific incompatibility is found and disclosed.
- If a handler needs database, files, live coverage, status, or update events,
  accept `resources: IngestionResources` from the ingestion dispatcher.
- Do not add handler plans or long comments here.
- Do not import Telegram runtime code.
