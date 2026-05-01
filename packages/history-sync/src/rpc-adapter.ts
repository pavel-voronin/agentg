import type { AppDatabase } from '@agentg/database/client';
import type { EventBus, EventSubscription } from '@agentg/shared/events/bus';
import { createIntegrationEvent, type IntegrationEvent } from '@agentg/shared/events/envelope';
import type { JsonValue } from '@agentg/shared/json';

import { callHistoryMethod } from './observability.js';

export function subscribeHistoryRpc(options: {
  database: AppDatabase;
  eventBus: EventBus;
}): EventSubscription {
  return options.eventBus.respond('agentg.command.history.rpc', async (event) => {
    const data = asRecord(event.data);
    const method = typeof data?.method === 'string' ? data.method : undefined;
    if (method === undefined) {
      return historyRpcFailed('agentg.command.history.rpc requires method');
    }

    try {
      const result = await callHistoryMethod(options, method, data?.params);
      if (result === undefined) {
        return historyRpcFailed(`Unknown method: ${method}`);
      }

      return createIntegrationEvent({
        data: { result: result as JsonValue },
        source: 'history-sync',
        type: 'history.rpc.completed'
      });
    } catch (error) {
      return historyRpcFailed(error instanceof Error ? error.message : String(error));
    }
  });
}

function historyRpcFailed(error: string): IntegrationEvent {
  return createIntegrationEvent({
    data: { error },
    source: 'history-sync',
    type: 'history.rpc.failed'
  });
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}
