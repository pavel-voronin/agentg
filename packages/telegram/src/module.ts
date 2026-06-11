import { defineModule } from '@agentg/framework';

import { createAccountIdentity } from './account/index.js';
import { readConfig } from './config.js';
import { createDatabase } from './database/client.js';
import { useFiles } from './files/index.js';
import { createLiveCoverageObserver } from './history/liveCoverage.js';
import { useIngestion } from './ingestion/index.js';
import { countMessagesInIntervalsProcedure } from './procedures/countMessagesInIntervals.js';
import { ensureHistoryCoverageProcedure } from './procedures/ensureHistoryCoverage.js';
import { fetchPageProcedure } from './procedures/fetchPage.js';
import { getChatProcedure } from './procedures/getChat.js';
import { getChatHistoryFactsProcedure } from './procedures/getChatHistoryFacts.js';
import { getHistoryCoverageProcedure } from './procedures/getHistoryCoverage.js';
import { listChatsProcedure } from './procedures/listChats.js';
import { listRecentMessagesProcedure } from './procedures/listRecentMessages.js';
import { requestFileProcedure } from './procedures/requestFile.js';
import { searchMessagesProcedure } from './procedures/searchMessages.js';
import { createStatusTracker } from './status/tracker.js';
import { useTdlib } from './tdlib/index.js';

export const telegramModule = defineModule('telegram', {
  config: readConfig,
  setup({ config, events, resource }) {
    const database = resource('database', ({ startup }) => {
      const resource = createDatabase(config.databaseUrl);

      startup(() => resource.start());

      return resource.db;
    });
    const tdlib = resource('tdlib', ({ startup }) => {
      const resource = useTdlib({
        config: {
          ...(config.apiHash === undefined ? {} : { apiHash: config.apiHash }),
          ...(config.apiId === undefined ? {} : { apiId: config.apiId }),
          databaseDirectory: config.tdlibDatabaseDirectory,
          filesDirectory: config.tdlibFilesDirectory
        },
        events
      });

      startup(() => resource.start());

      return resource.tdlib;
    });
    const files = resource('files', ({ startup }) => {
      const resource = useFiles({
        database,
        events,
        filesDirectory: config.tdlibFilesDirectory,
        tdlib
      });

      startup(() => resource.start());

      return resource.files;
    });
    const liveCoverage = resource('liveCoverage', () =>
      createLiveCoverageObserver({
        database
      })
    );
    const status = resource('status', () => createStatusTracker(events));
    const account = resource('account', () => createAccountIdentity());
    resource('ingestion', ({ startup }) => {
      const ingestion = useIngestion({
        account,
        database,
        events,
        files,
        liveCoverage,
        status,
        tdlib,
        updateConcurrency: config.ingestionUpdateConcurrency
      });

      startup(() => ingestion.start());

      return undefined;
    });
    const procedureResources = {
      database,
      events,
      files,
      tdlib
    };

    return {
      countMessagesInIntervals: countMessagesInIntervalsProcedure(procedureResources),
      ensureHistoryCoverage: ensureHistoryCoverageProcedure(procedureResources),
      fetchPage: fetchPageProcedure(procedureResources),
      getChat: getChatProcedure(procedureResources),
      getChatHistoryFacts: getChatHistoryFactsProcedure(procedureResources),
      getHistoryCoverage: getHistoryCoverageProcedure(procedureResources),
      listChats: listChatsProcedure(procedureResources),
      listRecentMessages: listRecentMessagesProcedure(procedureResources),
      requestFile: requestFileProcedure(procedureResources),
      searchMessages: searchMessagesProcedure(procedureResources),
      status: () => ({
        ready: status.snapshot().ready
      })
    };
  }
});
