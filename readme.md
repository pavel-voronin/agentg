# AgenTG

AgenTG is a pre-alpha Telegram client runtime for a personal agent.

It runs as a local developer stack: Telegram ingestion, Postgres, NATS, history
sync, gateway, and the Control Plane UI.

## Requirements

- Node.js and npm
- Docker with Compose
- Telegram API credentials:
  - `TELEGRAM_API_ID`
  - `TELEGRAM_API_HASH`

Set the Telegram credentials in your shell before running Telegram commands:

```sh
export TELEGRAM_API_ID=12345
export TELEGRAM_API_HASH=your_api_hash
```

## Install

```sh
npm install
```

## Authenticate TDLib

Run the interactive auth command once before starting the dev stack:

```sh
npm run telegram:auth
```

The command asks for the phone number, Telegram login code, email code when
Telegram requests it, and 2FA password when enabled. Secret codes and passwords
are not echoed back to the terminal.

TDLib session data is stored under `td-data/` by default.

## Run In Developer Mode

Start the full local stack:

```sh
npm run dev
```

This command starts Postgres and NATS through Docker Compose, runs database
migrations, starts the Telegram runtime, history sync, gateway, Control Plane
server, and the Vite Control Plane app.

When the command prints the Vite local URL, open:

[http://127.0.0.1:8788/](http://127.0.0.1:8788/)

The Telegram RPC server listens on `127.0.0.1:18081`. The Control Plane server
listens on `127.0.0.1:8789`.

Stop the stack with `Ctrl+C` in the terminal running `npm run dev`.

## Run With Docker Compose

Authenticate TDLib on the host first, because the Docker stack mounts the same
`td-data/` directory:

```sh
npm run telegram:auth
```

Put Telegram credentials in `.env` or export them in the shell:

```sh
TELEGRAM_API_ID=12345
TELEGRAM_API_HASH=your_api_hash
```

Build and start the product stack:

```sh
docker compose --profile container-client --profile control-plane up --build
```

This starts Postgres, NATS, Registry, Telegram ingestion, History Sync, Gateway,
and Control Plane. Open:

[http://127.0.0.1:8788/](http://127.0.0.1:8788/)

Gateway listens on `127.0.0.1:8787`. Stop the stack with `Ctrl+C`, or from
another terminal:

```sh
docker compose --profile container-client --profile control-plane down
```

## Useful Commands

```sh
npm run db:recreate
npm run check
```

`npm run db:recreate` drops and recreates the local database from the current
generated schema.

`npm run check` runs typecheck, lint, source audit, formatting check, and tests.
