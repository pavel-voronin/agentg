import type { HistoryReconciler } from '../../reconciler/runtime.js';
import type { GetMessagesInput } from './contract.js';
import { getMessagesRequestId } from './requestId.js';

export async function enqueueGetMessagesRequest(
  reconciler: HistoryReconciler,
  input: GetMessagesInput
): Promise<{
  requestId: string;
  result: 'pending_coalesced' | 'pending_enqueued';
}> {
  const requestId = getMessagesRequestId(input);
  return reconciler.enqueue({
    ...input,
    requestId
  });
}
