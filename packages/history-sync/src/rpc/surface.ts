import { surface } from '@agentg/rpc/surface';

import { deleteTarget } from './procedures/deleteTarget.js';
import { getChatHistorySyncState } from './procedures/getChatHistorySyncState.js';
import { requestSync } from './procedures/requestSync.js';
import { upsertTarget } from './procedures/upsertTarget.js';

export const historySyncRpcSurface = surface('history-sync', {
  deleteTarget,
  getChatHistorySyncState,
  requestSync,
  upsertTarget
});
