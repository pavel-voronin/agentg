import {
  callProcedure,
  createRegistryClient,
  nats,
  startTelemetryPublisher
} from '@agentg/framework';

import { procedures as telegramProcedures } from '../../../telegram/control-plane/backend/procedures.js';
import { createDatabase } from '../../../telegram/src/database/client.js';
import { readConfig } from './config.js';
import { runServer } from './server.js';

const config = readConfig(process.env);
const events = nats(config.natsUrl)();
await events.start();
const database = createDatabase(config.databaseUrl);
await database.start();
const stopTelemetry = startTelemetryPublisher(events);

const registry = createRegistryClient({
  events,
  onRefreshFailure(error) {
    console.warn(
      JSON.stringify({
        error: error.message,
        event: 'control_plane.registry_refresh_failed'
      })
    );
  },
  onTopologyFailure(error) {
    console.error(
      JSON.stringify({
        error: error.message,
        event: 'control_plane.registry_topology_failed'
      })
    );
    process.exitCode = 1;
    process.kill(process.pid, 'SIGTERM');
  },
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
  stopTelemetry();
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
