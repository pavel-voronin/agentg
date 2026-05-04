import type { JsonValue } from '../json.js';

export type DomainError = {
  code: string;
  details?: JsonValue | undefined;
  message: string;
};

export type ProcedureErrorEnvelope = {
  error: DomainError;
  ok: false;
};

export function isProcedureErrorEnvelope(value: unknown): value is ProcedureErrorEnvelope {
  const record = asRecord(value);
  const error = asRecord(record?.error);

  return (
    record?.ok === false && typeof error?.code === 'string' && typeof error.message === 'string'
  );
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

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}
