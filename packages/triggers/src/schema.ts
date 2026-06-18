import { z } from 'zod';

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
