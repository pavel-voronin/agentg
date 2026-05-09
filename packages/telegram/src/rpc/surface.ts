import { surface } from '@agentg/rpc/surface';

import { countMessagesInIntervals } from './procedures/countMessagesInIntervals.js';
import { fetchMessagesPage } from './procedures/fetchMessagesPage.js';
import { fetchPage } from './procedures/fetchPage.js';
import { getChat } from './procedures/getChat.js';
import { getFileQueueStats } from './procedures/getFileQueueStats.js';
import { getChatHistoryFacts } from './procedures/getChatHistoryFacts.js';
import { getMessage } from './procedures/getMessage.js';
import { listChatDirectory } from './procedures/listChatDirectory.js';
import { listChats } from './procedures/listChats.js';
import { listRecentMessages } from './procedures/listRecentMessages.js';
import { requestFile } from './procedures/requestFile.js';
import { searchMessages } from './procedures/searchMessages.js';

export const telegramRpcSurface = surface('telegram', {
  countMessagesInIntervals,
  fetchMessagesPage,
  fetchPage,
  getChat,
  getFileQueueStats,
  getChatHistoryFacts,
  getMessage,
  listChatDirectory,
  listChats,
  listRecentMessages,
  requestFile,
  searchMessages
});
