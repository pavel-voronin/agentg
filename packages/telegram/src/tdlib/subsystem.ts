import type { EventBus } from '@agentg/events/bus';
import { bindSubsystemContext, defineSubsystem } from '@agentg/framework/domain';

import { runTelegramIngestion } from './ingestion.js';
import { createTelegramTdlibOperations, type TelegramTdlibOperations } from './operations.js';
import type { TelegramIngestionDomain, TelegramIngestionOptions } from './ingestion.js';
import type { TdlibInvoker } from './operationEvents.js';

const TELEGRAM_TDLIB_METHODS = [
  'addFileToDownloads',
  'close',
  'deleteFile',
  'downloadFile',
  'getChat',
  'getChatHistory',
  'getChatMessageByDate',
  'getChats',
  'getFile',
  'getMe',
  'loadChats',
  'removeFileFromDownloads'
] as const;

const TELEGRAM_OPERATION_LIFECYCLES = ['completed', 'failed', 'started'] as const;

const TELEGRAM_TDLIB_EVENT_TYPES = TELEGRAM_TDLIB_METHODS.flatMap((method) =>
  TELEGRAM_OPERATION_LIFECYCLES.map((lifecycle) => `telegram.tdlib.${method}.${lifecycle}`)
);

export const useTdlib = defineSubsystem('tdlib', () => ({
  [bindSubsystemContext]: (context: unknown) => {
    if (isTdlibOperationContext(context)) {
      configureOperations(context);
    }
  },
  eventTypes: TELEGRAM_TDLIB_EVENT_TYPES,
  ...createTdlibOperationSurface(() => operations),
  start: (options: TelegramIngestionOptions, domain: TelegramIngestionDomain) =>
    runTelegramIngestion(options, domain, {
      configureOperations
    })
}));

type TdlibOperationContext = {
  client: TdlibInvoker;
  eventBus: EventBus;
};

let operations: TelegramTdlibOperations | undefined;

function configureOperations(context: TdlibOperationContext): void {
  operations = createTelegramTdlibOperations(context);
}

function isTdlibOperationContext(context: unknown): context is TdlibOperationContext {
  if (typeof context !== 'object' || context === null) {
    return false;
  }
  return 'client' in context && 'eventBus' in context;
}

function createTdlibOperationSurface(
  getOperations: () => TelegramTdlibOperations | undefined
): TelegramTdlibOperations {
  function readyOperations(): TelegramTdlibOperations {
    const ready = getOperations();
    if (ready === undefined) {
      throw new Error('TDLib operations are not ready');
    }
    return ready;
  }

  return {
    getChat(input, options) {
      return readyOperations().getChat(input, options);
    },
    getChatHistory(input, options) {
      return readyOperations().getChatHistory(input, options);
    },
    getChatMessageByDate(input, options) {
      return readyOperations().getChatMessageByDate(input, options);
    },
    getChats(input, options) {
      return readyOperations().getChats(input, options);
    },
    loadChats(input, options) {
      return readyOperations().loadChats(input, options);
    }
  };
}
