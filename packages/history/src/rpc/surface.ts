import { surface } from '@agentg/rpc/surface';

import { deleteTarget } from './procedures/deleteTarget.js';
import { getChatHistoryState } from './procedures/getChatHistoryState.js';
import { requestSync } from './procedures/requestSync.js';
import { upsertTarget } from './procedures/upsertTarget.js';

export const historyRpcSurface = surface('history', {
  deleteTarget,
  getChatHistoryState,
  requestSync,
  upsertTarget
});
