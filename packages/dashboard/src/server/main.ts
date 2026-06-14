import { createLogger, logError, nats, startTelemetryRuntime } from '@agentg/framework';
import { telegramClient } from '@agentg/telegram';

import { createProcedures as createTelegramProcedures } from '../../../telegram/dashboard/backend/procedures.js';
import { createDatabase } from '../../../telegram/src/database/client.js';
import { createProcedures as createTelemetryProcedures } from '../../../telemetry/dashboard/backend/procedures.js';
import { readConfig } from './config.js';
import { runServer } from './server.js';

const logger = createLogger('dashboard');
const config = readConfig(process.env);
const stopTelemetry = startTelemetryRuntime('dashboard');
const events = nats(config.natsUrl)();
await events.start();
const database = createDatabase(config.databaseUrl);
await database.start();
const telegram = telegramClient({ timeoutMs: 15_000, url: config.telegramRpcUrl });

try {
  await runServer({
    config: {
      host: config.host,
      port: config.port,
      staticDir: 'dist'
    },
    events,
    procedures: {
      ...createTelegramProcedures({
        database: database.db,
        events,
        telegram
      }),
      ...createTelemetryProcedures({
        grafanaUrl: config.grafanaUrl,
        jaegerUiUrl: config.jaegerUiUrl,
        victoriaMetricsUrl: config.victoriaMetricsUrl
      })
    }
  });
} catch (error) {
  logger.error(
    {
      event: 'dashboard.failed',
      ...logError(error)
    },
    'dashboard failed'
  );
  process.exitCode = 1;
} finally {
  await stopTelemetry();
  await database.stop();
  await events.stop();
}
