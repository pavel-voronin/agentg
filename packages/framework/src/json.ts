export type JsonObject = {
  [key: string]: JsonValue;
};

export type JsonValue = JsonObject | JsonValue[] | boolean | number | string | null;

export function toJsonValue(value: unknown, seen = new WeakSet<object>()): JsonValue {
  if (value === undefined) {
    return null;
  }

  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => toJsonValue(item, seen));
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      return '[Circular]';
    }
    seen.add(value);

    const result: JsonObject = {};
    for (const [key, item] of Object.entries(value)) {
      if (item !== undefined) {
        result[key] = toJsonValue(item, seen);
      }
    }
    seen.delete(value);

    return result;
  }

  if (typeof value === 'function') {
    return value.name.length > 0 ? `[Function: ${value.name}]` : '[Function]';
  }

  if (typeof value === 'symbol') {
    return value.description ?? '[Symbol]';
  }

  return null;
}
