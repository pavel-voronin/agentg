import {
  callProcedure,
  createRegistryClient,
  nats,
  startTelemetryRuntime
} from '@agentg/framework';

import { procedures as telegramProcedures } from '../../../telegram/control-plane/backend/procedures.js';
import { createDatabase } from '../../../telegram/src/database/client.js';
import { procedures as telemetryProcedures } from '../../../telemetry/control-plane/backend/procedures.js';
import { readConfig } from './config.js';
import { runServer } from './server.js';

const config = readConfig(process.env);
const stopTelemetry = startTelemetryRuntime('control-plane');
const events = nats(config.natsUrl)();
await events.start();
const database = createDatabase(config.databaseUrl);
await database.start();

const registry = createRegistryClient({
  url: config.registryUrl
});

try {
  await registry.refresh();
  await runServer({
    config: {
      host: config.host,
      port: config.port,
      staticDir: 'dist'
    },
    events,
    procedures: {
      ...telegramProcedures({
        callTelegramProcedure,
        database: database.db,
        events,
        filesDirectory: config.tdlibFilesDirectory
      }),
      ...telemetryProcedures({
        grafanaUrl: config.grafanaUrl,
        jaegerUiUrl: config.jaegerUiUrl,
        victoriaMetricsUrl: config.victoriaMetricsUrl
      })
    },
    registry
  });
} catch (error) {
  console.error(
    JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      event: 'control_plane.failed'
    })
  );
  process.exitCode = 1;
} finally {
  await stopTelemetry();
  registry.close();
  await database.stop();
  await events.stop();
}

async function callTelegramProcedure<T>(procedure: string, input: unknown): Promise<T> {
  const snapshot = registry.getSnapshot();
  const record = snapshot.modules.find((module) => module.module === 'telegram');
  if (!record?.procedures.includes(procedure)) {
    throw new Error(`Telegram procedure is not registered: ${procedure}`);
  }

  return callProcedure(record.rpcUrl, procedure, input, { timeoutMs: 15_000 });
}
