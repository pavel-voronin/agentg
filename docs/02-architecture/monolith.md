# Monolith Architecture

AgenTG runs as one Node.js application. `createApp()` builds the runtime in this
order:

1. config
2. SQLite
3. in-memory event bus
4. repositories
5. services
6. trusted plugins
7. edge servers

Internal reads, commands, and plugin calls use direct TypeScript interfaces.
Events use the in-memory event bus.

## Storage

The runtime uses one SQLite database file by default: `agentg.sqlite`.

SQLite runs with WAL enabled. All migrations run through one ordered migration
stream in `src/storage/migrations`.

Table ownership is visible from table names:

- `telegram_*`
- `history_*`
- `summaries_*`

Telegram media and files are stored in the filesystem blob store.

## Modules

`src/telegram` owns Telegram normalization, TDLib access, Telegram repository
queries, and Telegram service methods such as `getChat()` and `getMessage()`.

`src/history` owns recorded history messages, coverage intervals, range math,
reconciliation, and backfill jobs. It receives Telegram changes through the
in-memory event bus and calls `TelegramService` directly when it needs current
message DTOs.

`src/plugins/summaries` is a trusted in-process plugin. It receives
`eventBus`, `historyService`, `telegramService`, and its repository directly.

`src/edges/control-plane` and `src/edges/gateway` are external WebSocket edges.
They parse external requests and call app services/plugins directly inside the
process.
