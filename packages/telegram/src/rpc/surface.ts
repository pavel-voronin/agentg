import { surface } from '@agentg/rpc/surface';

import { chatDirectory } from '../control-plane/backend/procedures/chatDirectory.js';
import { fileQueueStats } from '../control-plane/backend/procedures/fileQueueStats.js';
import { message } from '../control-plane/backend/procedures/message.js';
import { messagesPage } from '../control-plane/backend/procedures/messagesPage.js';
import { requestFile } from '../control-plane/backend/procedures/requestFile.js';
import { countMessagesInIntervals } from './procedures/countMessagesInIntervals.js';
import { ensureHistoryCoverage } from './procedures/ensureHistoryCoverage.js';
import { fetchPage } from './procedures/fetchPage.js';
import { getChat } from './procedures/getChat.js';
import { getChatHistoryFacts } from './procedures/getChatHistoryFacts.js';
import { getHistoryCoverage } from './procedures/getHistoryCoverage.js';
import { listChats } from './procedures/listChats.js';
import { listRecentMessages } from './procedures/listRecentMessages.js';
import { searchMessages } from './procedures/searchMessages.js';

export const telegramRpcSurface = surface('telegram', {
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
});
