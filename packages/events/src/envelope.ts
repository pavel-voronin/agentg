import { randomUUID } from 'node:crypto';

import type { JsonObject, JsonValue } from './json.js';

export type IntegrationEvent = {
  id: string;
  type: string;
  occurredAt: string;
  data: JsonObject;
  meta?: Record<string, JsonValue>;
};

export function createIntegrationEvent(input: {
  type: string;
  occurredAt?: Date;
  data: JsonObject;
  meta?: Record<string, JsonValue>;
}): IntegrationEvent {
  return {
    id: `evt_${randomUUID()}`,
    type: input.type,
    occurredAt: (input.occurredAt ?? new Date()).toISOString(),
    data: input.data,
    ...(input.meta === undefined ? {} : { meta: input.meta })
  };
}
