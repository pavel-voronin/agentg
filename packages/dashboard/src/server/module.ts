import { createLogger, defineModule } from '@agentg/framework';
import { telegramClient } from '@agentg/telegram';

import { createProcedures as createTelegramProcedures } from '../../../telegram/dashboard/backend/procedures.js';
import { createDatabase } from '../../../telegram/src/database/client.js';
import { createProcedures as createTelemetryProcedures } from '../../../telemetry/dashboard/backend/procedures.js';
import { readConfig } from './config.js';
import { startServer } from './server.js';

const logger = createLogger('dashboard-server');

export const serverModule = defineModule('dashboard', {
  config: readConfig,
  setup({ background, config, events, resource }) {
    const database = resource('database', ({ startup }) => {
      const connection = createDatabase(config.databaseUrl);

      startup(() => connection.start());

      return connection.db;
    });
    const telegram = telegramClient({
      timeoutMs: 15_000,
      url: config.telegramRpcUrl
    });
    const procedures = {
      ...createTelegramProcedures({
        database,
        events,
        telegram
      }),
      ...createTelemetryProcedures({
        grafanaUrl: config.grafanaUrl,
        jaegerUiUrl: config.jaegerUiUrl,
        victoriaMetricsUrl: config.victoriaMetricsUrl
      })
    };

    background('server', async () => {
      const handle = await startServer({
        config: {
          host: config.host,
          port: config.port,
          staticDir: 'dist'
        },
        events,
        procedures
      });
      logger.info(
        {
          event: 'dashboard.ready',
          host: handle.host,
          port: handle.port
        },
        'dashboard ready'
      );

      return async () => {
        await handle.close();
        return undefined;
      };
    });

    return {};
  }
});
