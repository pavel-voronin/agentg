import { surface } from '@agentg/rpc/surface';

import { chatSummary } from './procedures/chatSummary.js';
import { readChatSummary } from './procedures/readChatSummary.js';
import { readSummaryRun } from './procedures/readSummaryRun.js';
import { requestSummary } from './procedures/requestSummary.js';

export const summariesRpcSurface = surface('summaries', {
  chatSummary,
  readChatSummary,
  readSummaryRun,
  requestSummary
});
