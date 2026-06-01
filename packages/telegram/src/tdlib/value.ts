/// <reference types="@prebuilt-tdlib/types" />

import type { JsonObject, JsonValue } from '@agentg/framework';
import { toJsonValue } from '@agentg/framework';
import type { Update, file } from 'tdlib-types';

export type TypedObject = JsonObject & { _: string };
export type UpdateByType<Type extends Update['_']> = Extract<Update, { _: Type }>;

export function tdDate(value: number | undefined): Date | undefined {
  return value === undefined || value <= 0 ? undefined : new Date(value * 1000);
}

export function tdId(value: number | string | null | undefined): string | undefined {
  return value === null || value === undefined ? undefined : String(value);
}

export function tdIdNumber(value: number | string | undefined): number | undefined {
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return value;
  }
  if (typeof value === 'string' && /^-?[0-9]+$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function tdJsonObject(value: unknown): TypedObject {
  const json = toJsonValue(value);
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    throw new Error('Expected TDLib object');
  }
  return json as TypedObject;
}

export function tdJsonValue(value: unknown): JsonValue | undefined {
  return value === undefined ? undefined : toJsonValue(value);
}

export function tdFileOrUndefined(value: unknown): file | undefined {
  const object = tdObjectOrUndefined(value);
  if (object?._ !== 'file') {
    return undefined;
  }

  const local = tdObjectOrUndefined(object.local);
  const remote = tdObjectOrUndefined(object.remote);
  if (
    typeof object.id !== 'number' ||
    local?._ !== 'localFile' ||
    remote?._ !== 'remoteFile' ||
    typeof remote.id !== 'string'
  ) {
    return undefined;
  }

  return value as file;
}

function tdObjectOrUndefined(value: unknown): TypedObject | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  return typeof record._ === 'string' ? tdJsonObject(record) : undefined;
}
