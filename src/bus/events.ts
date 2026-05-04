import { randomUUID } from 'node:crypto';

export type JsonObject = {
  [key: string]: JsonValue;
};

export type JsonValue = JsonObject | JsonValue[] | boolean | number | string | null;

export type AppEvent<TType extends string = string, TData extends JsonObject = JsonObject> = {
  data: TData;
  id: string;
  occurredAt: string;
  source: string;
  type: TType;
  meta?: Record<string, JsonValue>;
};

export type AppEventInput<TType extends string = string, TData extends JsonObject = JsonObject> = {
  data: TData;
  occurredAt?: Date;
  source: string;
  type: TType;
  meta?: Record<string, JsonValue>;
};

export function createAppEvent<TType extends string, TData extends JsonObject>(
  input: AppEventInput<TType, TData>
): AppEvent<TType, TData> {
  return {
    data: input.data,
    id: `evt_${randomUUID()}`,
    occurredAt: (input.occurredAt ?? new Date()).toISOString(),
    source: input.source,
    type: input.type,
    ...(input.meta === undefined ? {} : { meta: input.meta })
  };
}
