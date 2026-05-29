import { bindSubsystemContext, defineSubsystem } from '@agentg/framework/domain';

import { runHistorySyncService } from './runService.js';
import type { HistorySyncServiceDomain, HistorySyncServiceOptions } from './runService.js';

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
    start(options: HistorySyncServiceOptions, domain: HistorySyncServiceDomain): Promise<void> {
      return runHistorySyncService(options, domain);
    }
  };
});

function isServiceContext(context: unknown): context is ServiceResource {
  return typeof context === 'object' && context !== null && 'requestSync' in context;
}
