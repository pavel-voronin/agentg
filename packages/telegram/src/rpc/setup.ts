import type { EventBus } from '@agentg/events/bus';
import { defineInternalRpcDomain } from '@agentg/rpc/domain';

import type { TelegramDatabase as AppDatabase } from '../database/client.js';
import { chatDirectory } from '../control-plane/backend/procedures/chatDirectory.js';
import { fileQueueStats } from '../control-plane/backend/procedures/fileQueueStats.js';
import { message } from '../control-plane/backend/procedures/message.js';
import { messagesPage } from '../control-plane/backend/procedures/messagesPage.js';
import { requestFile } from '../control-plane/backend/procedures/requestFile.js';
import type { TelegramFileSubsystem } from '../files/subsystem.js';
import {
  createTelegramTdlibOperations,
  type TelegramTdlibOperations
} from '../tdlib/operations.js';
import type { TdlibInvoker } from '../tdlib/operationEvents.js';
import { countMessagesInIntervals } from './procedures/countMessagesInIntervals.js';
import { ensureHistoryCoverage } from './procedures/ensureHistoryCoverage.js';
import { fetchPage } from './procedures/fetchPage.js';
import { getChat } from './procedures/getChat.js';
import { getChatHistoryFacts } from './procedures/getChatHistoryFacts.js';
import { getHistoryCoverage } from './procedures/getHistoryCoverage.js';
import { listChats } from './procedures/listChats.js';
import { listRecentMessages } from './procedures/listRecentMessages.js';
import { searchMessages } from './procedures/searchMessages.js';

export type TelegramClient = TdlibInvoker;

export type TelegramRpcRuntimeDeps = {
  client: TelegramClient;
  database: AppDatabase;
  eventBus: EventBus;
  files: TelegramFileSubsystem;
};

export type TelegramRpcRuntime = TelegramRpcRuntimeDeps & {
  tdlib: TelegramTdlibOperations;
};

export const telegramRpc = defineInternalRpcDomain({
  createRuntime: createTelegramRpcRuntime,
  procedures: {
    'cp.chatDirectory': chatDirectory,
    'cp.fileQueueStats': fileQueueStats,
    'cp.message': message,
    'cp.messagesPage': messagesPage,
    'cp.requestFile': requestFile,
    countMessagesInIntervals,
    ensureHistoryCoverage,
    fetchPage,
    getChat,
    getChatHistoryFacts,
    getHistoryCoverage,
    listChats,
    listRecentMessages,
    searchMessages
  },
  slug: 'telegram'
});

export type TelegramRouter = ReturnType<typeof telegramRpc.createRouter>;
export const createTelegramRpcClient = telegramRpc.createClient;
export type TelegramRpcClient = ReturnType<typeof createTelegramRpcClient>;

function createTelegramRpcRuntime(deps: TelegramRpcRuntimeDeps): TelegramRpcRuntime {
  return {
    ...deps,
    tdlib: createTelegramTdlibOperations({
      client: deps.client,
      eventBus: deps.eventBus
    })
  };
}
