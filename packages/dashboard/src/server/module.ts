import { createLogger, defineModule, telemetryEnabled } from '@agentg/framework';
import { dataClient } from '@agentg/data';
import { telegramClient } from '@agentg/telegram';

import { createProcedures as createDataProcedures } from '../../../data/dashboard/backend/procedures.js';
import { createProcedures as createTelegramProcedures } from '../../../telegram/dashboard/backend/procedures.js';
import { createDatabase } from '../../../telegram/src/database/client.js';
import { readConfig } from './config.js';
import { startServer } from './server.js';

const logger = createLogger('dashboard-server');
const telemetryLinksMethod = 'telemetry.links';

type DashboardProcedureMap = Record<string, (input: unknown) => Promise<unknown>>;

type TelemetryResources = {
  grafanaUrl: string;
  jaegerUiUrl: string;
  victoriaMetricsUrl: string;
};

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
    const data = dataClient({
      timeoutMs: 15_000,
      url: config.dataRpcUrl
    });
    const procedures = {
      ...createDataProcedures({
        client: data
      }),
      ...createTelegramProcedures({
        database,
        events,
        telegram
      }),
      ...(telemetryEnabled()
        ? createLazyTelemetryProcedures({
            grafanaUrl: config.grafanaUrl,
            jaegerUiUrl: config.jaegerUiUrl,
            victoriaMetricsUrl: config.victoriaMetricsUrl
          })
        : {})
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

function createLazyTelemetryProcedures(resources: TelemetryResources): DashboardProcedureMap {
  let procedures: DashboardProcedureMap | null = null;

  return {
    [telemetryLinksMethod]: async (input) => {
      if (procedures === null) {
        const module = await import('../../../telemetry/dashboard/backend/procedures.js');
        procedures = module.createProcedures(resources);
      }

      const procedure = procedures[telemetryLinksMethod];
      if (procedure === undefined) {
        throw new Error(`Dashboard procedure is not registered: ${telemetryLinksMethod}`);
      }
      return procedure(input);
    }
  };
}
