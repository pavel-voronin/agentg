# Telegram API vs Bot API

## Current Understanding

For AgenTG, Telegram should be implemented as a user-client rather than as a bot.

## Bot API

Useful for:

- creating bots
- receiving messages addressed to the bot
- simple automation

Limitations for this project:

- bot is not the user's Telegram client
- group visibility can be constrained
- does not naturally represent the user's personal account

## Telegram API / TDLib

Useful for:

- custom Telegram clients
- user account login
- receiving updates as the user
- local client state

## Current Decision

Use TDLib sidecar for ingestion.

See [ADR-0001](../07-decisions/adr0001UseTdlibUserClient.md).
