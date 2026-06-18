import { defineModule } from '@agentg/framework';

import { fileDownloadRulesPolicy, historyGapRestoreRulesPolicy } from '../policies/policies.js';
import { createAccountIdentity } from './account/index.js';
import { readConfig } from './config.js';
import { createDatabase } from './database/client.js';
import { useFiles } from './files/index.js';
import { createRestoreService } from './gap-restore/runtime.js';
import { createLiveCoverageObserver } from './history/liveCoverage.js';
import { createIngestionOperations } from './ingestion/adapters/operations.js';
import { useIngestion } from './ingestion/index.js';
import { getChatProcedure } from './procedures/getChat.js';
import { listRecentMessagesProcedure } from './procedures/listRecentMessages.js';
import { getMessagesProcedure } from './procedures/getMessages.js';
import { requestFileProcedure } from './procedures/requestFile.js';
import { resolveSourceContentProcedure } from './procedures/resolveSourceContent.js';
import { searchMessagesProcedure } from './procedures/searchMessages.js';
import { createHistorySource } from './reconciler/adapters/historySource.js';
import { useHistoryReconciler } from './reconciler/runtime.js';
import { createStatusTracker } from './status/tracker.js';
import { createFileOperations } from './tdlib/fileOperations.js';
import { useTdlib } from './tdlib/index.js';

export const telegramModule = defineModule('telegram', {
  config: readConfig,
  setup({ config, events, resource, usePolicy }) {
    const getDownloadRules = usePolicy(fileDownloadRulesPolicy);
    const getGapRestoreRules = usePolicy(historyGapRestoreRulesPolicy);
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
        getDownloadRules,
        operations: createFileOperations(tdlib),
        tdlibSourceDirectories: [config.tdlibFilesDirectory, config.tdlibDatabaseDirectory]
      });

      startup(() => resource.start());

      return resource.files;
    });
    const liveCoverage = resource('liveCoverage', () =>
      createLiveCoverageObserver({
        database
      })
    );
    const reconciler = resource('reconciler', ({ startup }) => {
      const resource = useHistoryReconciler({
        database,
        events,
        files,
        historySource: createHistorySource(tdlib)
      });

      startup(() => resource.start());

      return resource.reconciler;
    });
    const status = resource('status', () => createStatusTracker(events));
    const account = resource('account', () => createAccountIdentity());
    const procedureResources = {
      database,
      events,
      files,
      reconciler
    };
    const getMessages = getMessagesProcedure(procedureResources);
    const gapRestore = resource('gapRestore', () =>
      createRestoreService({
        database,
        getMessages,
        getRules: getGapRestoreRules
      })
    );
    resource('ingestion', ({ startup }) => {
      const ingestion = useIngestion({
        account,
        database,
        events,
        files,
        gapRestore,
        liveCoverage,
        operations: createIngestionOperations(tdlib),
        status,
        updateConcurrency: config.ingestionUpdateConcurrency
      });

      startup(() => ingestion.start());

      return undefined;
    });

    return {
      getChat: getChatProcedure(procedureResources),
      listRecentMessages: listRecentMessagesProcedure(procedureResources),
      getMessages,
      requestFile: requestFileProcedure(procedureResources),
      resolveSourceContent: resolveSourceContentProcedure(procedureResources),
      searchMessages: searchMessagesProcedure(procedureResources),
      status: () => ({
        ready: status.snapshot().ready
      })
    };
  }
});
