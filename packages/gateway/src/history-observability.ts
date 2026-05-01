import type { EventBus } from '@agentg/shared/events/bus';
import { createIntegrationEvent } from '@agentg/shared/events/envelope';
import type { JsonValue } from '@agentg/shared/json';

type HistoryRuntime = {
  eventBus: EventBus;
};

export async function callHistoryMethod(
  runtime: HistoryRuntime,
  method: string,
  params: unknown
): Promise<unknown> {
  const response = await runtime.eventBus.request(
    createIntegrationEvent({
      data: {
        method,
        params: params as JsonValue
      },
      source: 'agent-gateway',
      type: 'agentg.command.history.rpc'
    }),
    {
      timeoutMs: 15000
    }
  );
  const data = asRecord(response.data);
  if (typeof data?.error === 'string') {
    throw new Error(data.error);
  }

  return data?.result;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}
