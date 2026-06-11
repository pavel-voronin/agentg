# Gateway Source Rules

- `module.ts` owns module composition and the boundary to Telegram through the
  typed `@agentg/telegram` client.
- `server.ts` owns only the external WebSocket gateway server and protocol
  parsing/serialization.
- `config.ts` owns only config schema. Do not parse environment variables or
  construct transports there.
- `main.ts` is only the local process entrypoint: read config, create the module
  app, start it, and report process-level failures.
