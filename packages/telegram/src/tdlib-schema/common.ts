import { z } from 'zod';
import type { JsonObject, JsonValue } from '@agentg/events/json';

export const tdlibIdSchema = z.union([z.number(), z.string()]);
export const tdlibObjectSchema = z.looseObject({ _: z.string() });

export type TdlibObject = JsonObject & {
  _: string;
};

export function tdlibDate(value: number | undefined): Date | undefined {
  return value === undefined || value <= 0 ? undefined : new Date(value * 1000);
}

export function tdlibIdString(value: number | string | undefined): string | undefined {
  return value === undefined ? undefined : String(value);
}

export function tdlibIdNumber(value: number | string | undefined): number | undefined {
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return value;
  }
  if (typeof value === 'string' && /^-?[0-9]+$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function asTdlibObject(value: unknown): TdlibObject | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  return typeof record._ === 'string' ? tdlibJsonObject(record) : undefined;
}

export function tdlibObject(value: unknown): TdlibObject {
  const object = asTdlibObject(value);
  if (object === undefined) {
    throw new Error('Expected TDLib object');
  }
  return object;
}

export function tdlibJsonObject(value: unknown): TdlibObject {
  const parsed: unknown = JSON.parse(JSON.stringify(value));
  return sanitizeJsonValue(parsed as JsonValue) as TdlibObject;
}

export function tdlibJsonValue(value: unknown): JsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed: unknown = JSON.parse(JSON.stringify(value));
  return sanitizeJsonValue(parsed as JsonValue);
}

function sanitizeJsonValue(value: JsonValue): JsonValue {
  if (typeof value === 'string') {
    return value.replaceAll('\u0000', '\\u0000');
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeJsonValue);
  }

  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, sanitizeJsonValue(entry)])
    );
  }

  return value;
}
