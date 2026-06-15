# Telegram Domain Models

- This folder owns stable Telegram domain models.
- Model files must not import TDLib, Drizzle, storage schema, procedures,
  Dashboard code, repositories, or storage code.
- Keep schemas and inferred TypeScript types together when a model crosses a
  procedure, event, or Dashboard boundary.
- Add only models with a current consumer.
