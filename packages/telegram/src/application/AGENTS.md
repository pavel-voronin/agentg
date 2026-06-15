# Telegram Application Services

- This folder owns Telegram application-service orchestration.
- Application services consume domain changes, call repositories, and publish
  domain events.
- Application services must not import TDLib types, Drizzle schema, Dashboard
  code, or procedure DTOs.
- Keep services narrow; do not create a generic framework inside Telegram.
