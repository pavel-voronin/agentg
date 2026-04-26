export type JsonObject = {
  [key: string]: JsonValue;
};

export type JsonValue = JsonObject | JsonValue[] | boolean | number | string | null;
