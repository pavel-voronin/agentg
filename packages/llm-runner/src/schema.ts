import {
  actionRequestSchema,
  actionResultSchema,
  datasetSchema,
  type ActionResult,
  type Dataset
} from '@agentg/data';
import { z } from 'zod';

const actionInputSchema = z
  .object({
    output: z
      .object({
        format: z.enum(['text', 'json']).optional()
      })
      .strict()
      .optional(),
    profile: z.string().trim().min(1),
    prompt: z.string().trim().min(1)
  })
  .strict();

export const runActionRequestSchema = actionRequestSchema.extend({
  with: actionInputSchema
});

export const runActionResultSchema = z.union([
  z
    .object({
      runId: z.string().trim().min(1),
      status: z.literal('accepted')
    })
    .strict(),
  actionResultSchema.options[1]
]);

export const getRunResultInputSchema = z
  .object({
    runId: z.string().trim().min(1)
  })
  .strict();

export const runResultSchema = z.union([
  z
    .object({
      runId: z.string(),
      status: z.union([z.literal('accepted'), z.literal('processing')])
    })
    .strict(),
  z
    .object({
      dataset: datasetSchema,
      runId: z.string(),
      status: z.literal('completed')
    })
    .strict(),
  z
    .object({
      error: z
        .object({
          code: z.string(),
          message: z.string()
        })
        .strict(),
      runId: z.string(),
      status: z.literal('failed')
    })
    .strict()
]);

export type LlmActionInput = z.infer<typeof actionInputSchema>;
export type LlmRunActionRequest = z.infer<typeof runActionRequestSchema>;
export type LlmRunActionResult =
  | { runId: string; status: 'accepted' }
  | Extract<ActionResult, { status: 'rejected' }>;
export type LlmRunResult = z.infer<typeof runResultSchema>;
export type { Dataset };
