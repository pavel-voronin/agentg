import { datasetSchema, jsonValueSchema } from '@agentg/data';
import { z } from 'zod';

const nodeSchema = z
  .object({
    from: z.string().trim().min(1).optional(),
    needs: z.array(z.string().trim().min(1)).readonly().optional(),
    use: z.string().trim().min(1),
    with: jsonValueSchema.optional()
  })
  .strict();

const triggerSchema = z
  .object({
    everySeconds: z.number().int().positive(),
    kind: z.literal('periodic'),
    startAt: z.iso.datetime().optional()
  })
  .strict();

export const documentSchema = z
  .object({
    apiVersion: z.literal('agentg.dev/v1'),
    kind: z.literal('Pipeline'),
    metadata: z
      .object({
        name: z.string().trim().min(1)
      })
      .strict(),
    spec: z
      .object({
        nodes: z.record(z.string().trim().min(1), nodeSchema),
        triggers: z.record(z.string().trim().min(1), triggerSchema).optional()
      })
      .strict()
  })
  .strict();

export const setInputSchema = z
  .object({
    document: z.union([z.string(), documentSchema])
  })
  .strict();

export const nameInputSchema = z
  .object({
    name: z.string().trim().min(1)
  })
  .strict();

export const runInputSchema = z
  .object({
    idempotencyKey: z.string().trim().min(1).optional(),
    name: z.string().trim().min(1)
  })
  .strict();

export const getRunInputSchema = z
  .object({
    runId: z.string().trim().min(1)
  })
  .strict();

export const listRunsInputSchema = z
  .object({
    pipelineName: z.string().trim().min(1).optional(),
    status: z
      .enum(['accepted', 'running', 'waiting', 'completed', 'failed', 'cancelled'])
      .optional()
  })
  .default({});

export const triggeredInputSchema = z
  .object({
    actionInput: z
      .object({
        pipelineName: z.string().trim().min(1),
        triggerName: z.string().trim().min(1)
      })
      .strict(),
    occurrence: z
      .object({
        idempotencyKey: z.string().trim().min(1),
        registrationKey: z.string().trim().min(1),
        scheduledAt: z.string().trim().min(1)
      })
      .strict(),
    trigger: z
      .object({
        kind: z.literal('trigger'),
        requestId: z.string().trim().min(1)
      })
      .strict()
  })
  .strict();

export const providerResultSchema = z.union([
  z
    .object({
      dataset: datasetSchema,
      runId: z.string().trim().min(1).optional(),
      status: z.literal('ready')
    })
    .strict(),
  z
    .object({
      runId: z.string().trim().min(1),
      status: z.literal('accepted')
    })
    .strict(),
  z
    .object({
      error: z
        .object({
          code: z.string().trim().min(1),
          message: z.string()
        })
        .strict(),
      status: z.literal('rejected')
    })
    .strict()
]);

export const providerRunResultSchema = z.union([
  z
    .object({
      runId: z.string().trim().min(1),
      status: z.union([z.literal('accepted'), z.literal('processing')])
    })
    .strict(),
  z
    .object({
      dataset: datasetSchema,
      runId: z.string().trim().min(1),
      status: z.literal('completed')
    })
    .strict(),
  z
    .object({
      error: z
        .object({
          code: z.string().trim().min(1),
          message: z.string()
        })
        .strict(),
      runId: z.string().trim().min(1),
      status: z.literal('failed')
    })
    .strict()
]);

export const providerRunEventSchema = z
  .object({
    failureCode: z.string().trim().min(1).optional(),
    nodeId: z.string().trim().min(1),
    pipelineRunId: z.string().trim().min(1),
    profile: z.string().trim().min(1).optional(),
    runId: z.string().trim().min(1),
    status: z.union([z.literal('completed'), z.literal('failed')])
  })
  .loose();

export const executionContextSchema = z
  .object({
    date: z
      .object({
        utc: z.string().trim().min(1)
      })
      .strict(),
    run: z
      .object({
        startedAt: z.string().trim().min(1)
      })
      .strict(),
    trigger: z
      .object({
        scheduledAt: z.string().trim().min(1)
      })
      .strict()
      .optional(),
    window: z
      .object({
        endAt: z.string().trim().min(1),
        startAt: z.string().trim().min(1)
      })
      .strict()
      .optional()
  })
  .strict();

export type Document = z.infer<typeof documentSchema>;
export type Node = z.infer<typeof nodeSchema>;
export type Trigger = z.infer<typeof triggerSchema>;
export type ExecutionContext = z.infer<typeof executionContextSchema>;
export type ProviderResult = z.infer<typeof providerResultSchema>;
export type ProviderRunResult = z.infer<typeof providerRunResultSchema>;
export type ProviderRunEvent = z.infer<typeof providerRunEventSchema>;
export type Dataset = z.infer<typeof datasetSchema>;
