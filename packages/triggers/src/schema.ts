import { z } from 'zod';
import type { JsonValue } from '@agentg/framework';

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.string(),
    z.number(),
    z.boolean(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema)
  ])
);
const moduleNameSchema = z.string().regex(/^[a-z][a-z0-9-]*$/);
const procedureNameSchema = z.string().regex(/^[a-z][A-Za-z0-9]*$/);

export const occurrenceStatuses = [
  'scheduled',
  'claimed',
  'dispatching',
  'accepted',
  'rejected',
  'retryWaiting',
  'failed',
  'cancelled'
] as const;

export type OccurrenceStatus = (typeof occurrenceStatuses)[number];

export const listOccurrencesInputSchema = z
  .object({
    registrationKey: z.string().optional(),
    status: z.enum(occurrenceStatuses).optional()
  })
  .default({});

export type ListOccurrencesInput = z.infer<typeof listOccurrencesInputSchema>;

const ownerSchema = z
  .object({
    key: z.string().trim().min(1),
    module: moduleNameSchema
  })
  .strict();

const registrationInputSchema = z
  .object({
    action: z
      .object({
        input: jsonValueSchema,
        module: moduleNameSchema,
        procedure: procedureNameSchema
      })
      .strict(),
    condition: z
      .object({
        everySeconds: z.number().int().positive(),
        kind: z.literal('periodic'),
        startAt: z.iso.datetime().optional()
      })
      .strict(),
    name: z.string().trim().min(1)
  })
  .strict();

export const replaceRegistrationsInputSchema = z
  .object({
    owner: ownerSchema,
    registrations: z.array(registrationInputSchema).readonly()
  })
  .strict();

export const listRegistrationsInputSchema = z
  .object({
    owner: z
      .object({
        key: z.string().trim().min(1).optional(),
        module: moduleNameSchema
      })
      .strict()
      .optional()
  })
  .default({});

export type ReplaceRegistrationsInput = z.infer<typeof replaceRegistrationsInputSchema>;
export type ListRegistrationsInput = z.infer<typeof listRegistrationsInputSchema>;

export type TriggeredActionInput = {
  actionInput: unknown;
  occurrence: {
    idempotencyKey: string;
    registrationKey: string;
    scheduledAt: string;
  };
  trigger: {
    kind: 'trigger';
    requestId: string;
  };
};

export type TriggeredActionResult =
  | {
      runId: string;
      status: 'accepted';
    }
  | {
      error: {
        code: string;
        message: string;
      };
      status: 'rejected';
    };

export function requireTriggeredActionResult(value: unknown): TriggeredActionResult {
  if (!isRecord(value)) {
    throw new Error('Triggered action result must be an object');
  }
  if (value.status === 'accepted' && typeof value.runId === 'string' && value.runId.length > 0) {
    return {
      runId: value.runId,
      status: 'accepted'
    };
  }
  if (value.status === 'rejected' && isRecord(value.error)) {
    const code = value.error.code;
    const message = value.error.message;
    if (typeof code === 'string' && code.length > 0 && typeof message === 'string') {
      return {
        error: {
          code,
          message
        },
        status: 'rejected'
      };
    }
  }
  throw new Error('Triggered action result is invalid');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
