import type { AppDatabase } from '@agentg/database/client';
import type { EventBus } from '@agentg/shared/events/bus';
import { callTelegramHistoryMethod } from '@agentg/telegram/history-sync/observability';

type HistoryRuntime = {
  database: AppDatabase;
  eventBus: EventBus;
};

export async function callHistoryMethod(
  runtime: HistoryRuntime,
  method: string,
  params: unknown
): Promise<unknown> {
  return callTelegramHistoryMethod(runtime, method, params);
}
