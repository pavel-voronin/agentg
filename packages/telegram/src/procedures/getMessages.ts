import { timeTelemetrySpan } from '@agentg/framework';
import { z } from 'zod';

import {
  nonEmptyStringSchema,
  positiveIntegerSchema,
  readMessageSchema
} from '../views/schemas.js';
import { materializeGetMessages } from './getMessagesMaterialization.js';
import { readMaterializedGetMessages, readReadyGetMessages } from './getMessagesReadiness.js';
import { resolveGetMessagesRequest } from './getMessagesRequest.js';
import type { ProcedureResources } from './resources.js';

const METRIC_GET_MESSAGES_STAGE_DURATION = 'telegram.get_messages.stage.duration';

const inputSchema = z.object({
  beforeMessageId: nonEmptyStringSchema.regex(/^[0-9]+$/).optional(),
  chatId: nonEmptyStringSchema,
  limit: positiveIntegerSchema.optional()
});

const outputSchema = z.object({
  messages: z.array(readMessageSchema),
  reachedStart: z.boolean()
});

type Input = z.infer<typeof inputSchema>;
type Output = z.infer<typeof outputSchema>;

export function getMessagesProcedure(resources: ProcedureResources) {
  return async (input: unknown): Promise<Output> => {
    const output = await runGetMessages(inputSchema.parse(input), resources);
    return outputSchema.parse(output);
  };
}

async function runGetMessages(input: Input, resources: ProcedureResources): Promise<Output> {
  const request = await timeGetMessagesStage('resolve_request', () =>
    resolveGetMessagesRequest(input, resources)
  );
  const ready = await timeGetMessagesStage('read_ready', () =>
    readReadyGetMessages(request, resources)
  );
  if (ready !== undefined) {
    return ready;
  }

  const materialized = await timeGetMessagesStage('materialize', () =>
    materializeGetMessages(request, resources)
  );
  return timeGetMessagesStage('read_materialized', () =>
    readMaterializedGetMessages(request, resources, {
      reachedStart: materialized.kind === 'page' ? materialized.reachedBeginning : true
    })
  );
}

function timeGetMessagesStage<T>(stage: string, operation: () => Promise<T>): Promise<T> {
  const attributes = {
    'telegram.get_messages.stage': stage
  };
  return timeTelemetrySpan(
    {
      attributes,
      metric: {
        attributes,
        name: METRIC_GET_MESSAGES_STAGE_DURATION
      },
      name: `telegram.get_messages.${stage}`
    },
    operation
  );
}
