import type { JsonValue } from '@agentg/framework';
import { z } from 'zod';

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.string(),
    z.number(),
    z.boolean(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema)
  ])
);

export const sourceRefSchema = z
  .object({
    _model: z.string().trim().min(1),
    id: z.string().trim().min(1)
  })
  .strict();

export const contentRefSchema = z
  .object({
    _model: z.string().trim().min(1),
    id: z.string().trim().min(1),
    sourceRef: sourceRefSchema.optional()
  })
  .strict();

export const sourceSelectorSchema = z
  .object({
    domain: z.string().regex(/^[a-z][a-z0-9-]*$/),
    selector: jsonValueSchema
  })
  .strict();

export const llmRunPayloadSchema = z
  .object({
    artifactKey: z.string().trim().min(1),
    instructions: z.string().trim().min(1),
    profile: z.string().trim().min(1),
    sourceSelector: sourceSelectorSchema
  })
  .strict();

export const triggerProvenanceSchema = z
  .object({
    occurrence: z
      .object({
        idempotencyKey: z.string().trim().min(1),
        registrationKey: z.string().trim().min(1),
        scheduledAt: z.iso.datetime()
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

export const runTriggeredInputSchema = z
  .object({
    actionInput: llmRunPayloadSchema,
    occurrence: triggerProvenanceSchema.shape.occurrence,
    trigger: triggerProvenanceSchema.shape.trigger
  })
  .strict();

export const listArtifactsInputSchema = z
  .object({
    artifactKey: z.string().trim().min(1).optional(),
    sourceRef: sourceRefSchema
  })
  .strict();

export const getCurrentArtifactInputSchema = z
  .object({
    artifactKey: z.string().trim().min(1),
    sourceRef: sourceRefSchema
  })
  .strict();

export const runOutputSchema = z.union([
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

export type LlmRunPayload = z.infer<typeof llmRunPayloadSchema>;
export type SourceSelector = z.infer<typeof sourceSelectorSchema>;
export type SourceRef = z.infer<typeof sourceRefSchema>;
export type ContentRef = z.infer<typeof contentRefSchema>;
export type TriggerProvenance = z.infer<typeof triggerProvenanceSchema>;
export type RunTriggeredInput = z.infer<typeof runTriggeredInputSchema>;
export type ListArtifactsInput = z.infer<typeof listArtifactsInputSchema>;
export type GetCurrentArtifactInput = z.infer<typeof getCurrentArtifactInputSchema>;
export type LlmRunOutput = z.infer<typeof runOutputSchema>;
