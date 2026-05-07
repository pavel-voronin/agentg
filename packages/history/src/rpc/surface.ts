import { surface } from '@agentg/rpc/surface';

import { deleteTarget } from './procedures/deleteTarget.js';
import { getChatHistoryState } from './procedures/getChatHistoryState.js';
import { getChatStats } from './procedures/getChatStats.js';
import { getOverview } from './procedures/getOverview.js';
import { listJobs } from './procedures/listJobs.js';
import { requestSync } from './procedures/requestSync.js';
import { upsertTarget } from './procedures/upsertTarget.js';

export const historyRpcSurface = surface('history', {
  deleteTarget,
  getChatHistoryState,
  getChatStats,
  getOverview,
  listJobs,
  requestSync,
  upsertTarget
});
