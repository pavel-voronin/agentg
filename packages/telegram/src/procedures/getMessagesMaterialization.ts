import { fetchHistoryPage } from '../history/fetch.js';
import { HISTORY_PAST_BOUNDARY } from '../history/time.js';
import { priorities } from '../tdlib/priority.js';
import type { ProcedureResources } from './resources.js';

type GetMessagesRequest = {
  beforeMessageId?: string | undefined;
  chatId: string;
  limit: number;
  pageEndAt: string;
};

export async function materializeGetMessages(
  request: GetMessagesRequest,
  resources: ProcedureResources
): ReturnType<typeof fetchHistoryPage> {
  return fetchHistoryPage(
    {
      chatId: request.chatId,
      ...(request.beforeMessageId === undefined
        ? {}
        : { cursorMessageId: Number(request.beforeMessageId) }),
      endAt: request.pageEndAt,
      limit: request.limit,
      startAt: HISTORY_PAST_BOUNDARY.toISOString()
    },
    resources,
    { priority: priorities.low }
  );
}
