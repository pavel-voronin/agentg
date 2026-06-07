# AgenTG

AgenTG is a pre-alpha Telegram client runtime for a personal agent.

It runs as a local developer stack: Telegram ingestion, Postgres, NATS,
VictoriaMetrics, Jaeger, Grafana, history sync, gateway, and the Control Plane UI.

## Requirements

- Node.js and npm
- Docker with Compose
- Process Compose
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
brew install f1bonacc1/tap/process-compose
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

This command starts Postgres, NATS, VictoriaMetrics, Jaeger, and Grafana through
Docker Compose, runs database migrations, and starts the Telegram runtime,
history sync, gateway, Control Plane server, and the Vite Control Plane app
through Process Compose in detached mode. The Control Plane server owns the
Telemetry page backend procedures.

After `npm run dev:status` shows `control-plane` as healthy, open:

[http://127.0.0.1:8788/](http://127.0.0.1:8788/)

Development observability UIs:

- Jaeger traces: [http://127.0.0.1:16686/](http://127.0.0.1:16686/)
- Grafana operations dashboard:
  [http://127.0.0.1:3000/d/agentg-operations/agentg-operations](http://127.0.0.1:3000/d/agentg-operations/agentg-operations)
- Grafana TDLib updates dashboard:
  [http://127.0.0.1:3000/d/agentg-tdlib-updates/agentg-tdlib-updates](http://127.0.0.1:3000/d/agentg-tdlib-updates/agentg-tdlib-updates)
- VictoriaMetrics VMUI:
  [http://127.0.0.1:8428/vmui/](http://127.0.0.1:8428/vmui/)

The Telegram RPC server listens on `127.0.0.1:8702`. The Control Plane server
listens on `127.0.0.1:8789`.

Manage the detached Process Compose app stack with:

```sh
npm run dev:status
npm run dev:attach
npm run dev:logs -- control-plane-server --tail 100
npm run dev:restart -- telegram
npm run dev:down
```

`npm run dev:down` stops app processes and leaves Docker-owned infrastructure
running.

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

Docker Compose defaults `AGENTG_TELEMETRY` to `0`. To run the same stack with
OpenTelemetry metrics, traces, and NATS exporter metrics enabled:

```sh
AGENTG_TELEMETRY=1 docker compose --profile container-client --profile control-plane up --build
```

This starts Postgres, NATS, VictoriaMetrics, Jaeger, Grafana, Registry, Telegram
ingestion, History Sync, Gateway, and Control Plane. Open:

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
