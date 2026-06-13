# AgenTG

AgenTG is a pre-alpha Telegram client runtime for a personal agent.

It runs as a local developer stack: Telegram ingestion, Postgres, NATS,
OpenTelemetry Collector, VictoriaMetrics, Jaeger, Grafana, NATS and Postgres
exporters, history sync, gateway, and the Dashboard UI.

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

This command starts Postgres, NATS, OpenTelemetry Collector, VictoriaMetrics,
Jaeger, Grafana, and the NATS and Postgres exporters through Docker Compose,
runs database migrations, and starts the Telegram runtime, history sync,
gateway, Dashboard server, and the Vite Dashboard app through Process
Compose in detached mode. The Dashboard server owns the Telemetry page
backend procedures.

After `npm run dev:status` shows `dashboard` as healthy, open:

[http://127.0.0.1:8788/](http://127.0.0.1:8788/)

Development observability UIs:

- Jaeger traces: [http://127.0.0.1:16686/](http://127.0.0.1:16686/)
- Grafana TDLib updates dashboard:
  [http://127.0.0.1:3000/d/agentg-tdlib-updates/agentg-tdlib-updates](http://127.0.0.1:3000/d/agentg-tdlib-updates/agentg-tdlib-updates)
- Grafana Postgres dashboard:
  [http://127.0.0.1:3000/d/agentg-postgres/agentg-postgres](http://127.0.0.1:3000/d/agentg-postgres/agentg-postgres)
- VictoriaMetrics VMUI:
  [http://127.0.0.1:8428/vmui/](http://127.0.0.1:8428/vmui/)

The Telegram RPC server listens on `127.0.0.1:8702`. The Dashboard server
listens on `127.0.0.1:8789`.

Manage the detached Process Compose app stack with:

```sh
npm run dev:status
npm run dev:attach
npm run dev:logs -- dashboard-server --tail 100
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
docker compose --profile container-client --profile dashboard up --build
```

Docker Compose defaults `AGENTG_TELEMETRY` to `0`. To run the same stack with
OpenTelemetry metrics, traces, NATS exporter metrics, and Postgres exporter
metrics enabled:

```sh
AGENTG_TELEMETRY=1 docker compose --profile telemetry --profile container-client --profile dashboard up --build
```

This starts Postgres, NATS, OpenTelemetry Collector, VictoriaMetrics, Jaeger,
Grafana, the NATS exporter, the Postgres exporter, Telegram ingestion,
History Sync, Gateway, and Dashboard. Open:

[http://127.0.0.1:8788/](http://127.0.0.1:8788/)

Gateway listens on `127.0.0.1:8787`. Stop the stack with `Ctrl+C`, or from
another terminal:

```sh
docker compose --profile container-client --profile dashboard down
```

## Useful Commands

```sh
npm run db:recreate
npm run check
```

`npm run db:recreate` drops and recreates the local database from the current
generated schema.

`npm run check` runs typecheck, lint, source audit, formatting check, and tests.
