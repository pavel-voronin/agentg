import { z } from 'zod';

import type { JsonValue } from '../json.js';

export type DomainError = {
  code: string;
  details?: JsonValue | undefined;
  message: string;
};

export type ProcedureExtensionEnvelope<T = JsonValue> =
  | {
      ok: false;
      error: DomainError;
    }
  | {
      ok: true;
      result: T;
    };

export type ProcedureExtensions = Record<string, ProcedureExtensionEnvelope>;

export type ProcedureErrorEnvelope = {
  ok: false;
  error: DomainError;
  extensions: ProcedureExtensions;
};

export type ProcedureSuccessEnvelope<T> = {
  ok: true;
  extensions: ProcedureExtensions;
  result: T;
};

export type ProcedureEnvelope<T> = ProcedureErrorEnvelope | ProcedureSuccessEnvelope<T>;

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema)
  ])
);

export const domainErrorSchema = z.object({
  code: z.string().trim().min(1),
  details: jsonValueSchema.optional(),
  message: z.string()
});

export const procedureExtensionEnvelopeSchema = z.discriminatedUnion('ok', [
  z.object({
    error: domainErrorSchema,
    ok: z.literal(false)
  }),
  z.object({
    ok: z.literal(true),
    result: jsonValueSchema
  })
]);

export const procedureExtensionsSchema = z.record(z.string(), procedureExtensionEnvelopeSchema);

const domainErrorEnvelopeSchema = z.object({
  error: domainErrorSchema,
  extensions: procedureExtensionsSchema.optional(),
  ok: z.literal(false)
});

export function procedureEnvelopeSchema<const TSchema extends z.ZodType>(resultSchema: TSchema) {
  return z
    .union([resultSchema, domainErrorEnvelopeSchema])
    .transform((value): ProcedureEnvelope<z.output<TSchema>> => {
      if (isDomainErrorEnvelope(value)) {
        return {
          error: value.error,
          extensions: value.extensions ?? {},
          ok: false as const
        };
      }

      return {
        extensions: {},
        ok: true as const,
        result: value
      };
    });
}

export function okEnvelope<T>(
  result: T,
  extensions: ProcedureExtensions = {}
): ProcedureEnvelope<T> {
  return {
    extensions,
    ok: true,
    result
  };
}

export function domainErrorEnvelope(
  error: DomainError,
  extensions: ProcedureExtensions = {}
): ProcedureErrorEnvelope {
  return {
    error,
    extensions,
    ok: false
  };
}

export function extensionOk<T extends JsonValue>(result: T): ProcedureExtensionEnvelope<T> {
  return {
    ok: true,
    result
  };
}

export function extensionError(error: DomainError): ProcedureExtensionEnvelope<never> {
  return {
    error,
    ok: false
  };
}

export function unwrapProcedureEnvelope<T>(envelope: ProcedureEnvelope<T>): T {
  if (envelope.ok) {
    return envelope.result;
  }

  throw new ProcedureDomainError(envelope.error);
}

export class ProcedureDomainError extends Error {
  readonly code: string;
  readonly details?: JsonValue | undefined;

  constructor(error: DomainError) {
    super(error.message);
    this.name = 'ProcedureDomainError';
    this.code = error.code;
    if (error.details !== undefined) {
      this.details = error.details;
    }
  }
}

type DomainErrorEnvelopeInput = z.output<typeof domainErrorEnvelopeSchema>;

function isDomainErrorEnvelope(value: unknown): value is DomainErrorEnvelopeInput {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ok' in value &&
    (value as { ok?: unknown }).ok === false
  );
}
