import { bindSubsystemContext, defineSubsystem } from '@agentg/framework';

import { runHistorySyncService } from './runService.js';
import type { HistorySyncServiceModule, HistorySyncServiceOptions } from './runService.js';

type ServiceResource = {
  requestSync: (reason: string, chatId?: string) => void;
};

export const useService = defineSubsystem('service', () => {
  let requestSyncHandler: ServiceResource['requestSync'] | undefined;

  return {
    [bindSubsystemContext](context: unknown): void {
      if (isServiceContext(context)) {
        requestSyncHandler = context.requestSync;
      }
    },
    requestSync: (reason: string, chatId?: string): void => {
      requestSyncHandler?.(reason, chatId);
    },
    start(options: HistorySyncServiceOptions, module: HistorySyncServiceModule): Promise<void> {
      return runHistorySyncService(options, module);
    }
  };
});

function isServiceContext(context: unknown): context is ServiceResource {
  return typeof context === 'object' && context !== null && 'requestSync' in context;
}
