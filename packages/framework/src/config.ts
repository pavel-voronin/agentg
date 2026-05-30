const fieldMarker = Symbol('configField');
type ConfigSource = Record<string, unknown>;
type ConfigSourceInput = ConfigSource | readonly ConfigSource[];
type ReadResult = { found: false } | { found: true; value: unknown };

type FieldState<T> = {
  defaultValue?: T | undefined;
  hasDefault: boolean;
  isOptional: boolean;
};

type ConfigField<T> = {
  readonly [fieldMarker]: true;
  readonly sourceKey: string;
  readonly state: FieldState<T>;
  default(value: T): ConfigField<T>;
  optional(): ConfigField<T | undefined>;
  parse(value: unknown, path: string): T;
};

type ConfigSchema = ConfigField<unknown> | { readonly [key: string]: ConfigSchema };

type InferConfig<TSchema> =
  TSchema extends ConfigField<infer TValue>
    ? TValue
    : TSchema extends object
      ? { readonly [K in keyof TSchema]: InferConfig<TSchema[K]> }
      : never;

export type ConfigOf<TReader> = TReader extends (...sources: ConfigSourceInput[]) => infer TConfig
  ? TConfig
  : never;

export function defineConfig<const TSchema extends ConfigSchema>(
  schema: TSchema
): (...sources: ConfigSourceInput[]) => InferConfig<TSchema> {
  return (...sources) => readSchema(schema, flattenSources(sources), []) as InferConfig<TSchema>;
}

export function number(sourceKey: string): ConfigField<number> {
  return createField(sourceKey, (value, path) => {
    if (typeof value === 'number') {
      if (Number.isFinite(value)) {
        return value;
      }
      throw new Error(`${path} must be a number`);
    }
    if (typeof value !== 'string') {
      throw new Error(`${path} must be a number`);
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new Error(`${path} must be a number`);
    }
    return parsed;
  });
}

export function string(sourceKey: string): ConfigField<string> {
  return createField(sourceKey, (value, path) => {
    if (typeof value !== 'string') {
      throw new Error(`${path} must be a string`);
    }
    return value;
  });
}

function createField<T>(
  sourceKey: string,
  parse: (value: unknown, path: string) => T,
  state: FieldState<T> = {
    hasDefault: false,
    isOptional: false
  }
): ConfigField<T> {
  return {
    [fieldMarker]: true,
    sourceKey,
    state,
    default(value) {
      return createField(sourceKey, parse, {
        defaultValue: value,
        hasDefault: true,
        isOptional: false
      });
    },
    optional() {
      return createField<T | undefined>(sourceKey, parse, {
        hasDefault: false,
        isOptional: true
      });
    },
    parse
  };
}

function findValue(
  sources: readonly ConfigSource[],
  path: readonly string[],
  sourceKey: string
): ReadResult {
  let output: ReadResult = { found: false };
  for (const source of sources) {
    const pathValue = readPath(source, path);
    if (pathValue.found && pathValue.value !== undefined) {
      output = pathValue;
      continue;
    }

    const keyValue = source[sourceKey];
    if (keyValue !== undefined) {
      output = {
        found: true,
        value: keyValue
      };
    }
  }
  return output;
}

function flattenSources(sources: readonly ConfigSourceInput[]): ConfigSource[] {
  const output: ConfigSource[] = [];
  for (const source of sources) {
    if (isSourceArray(source)) {
      output.push(...source);
    } else {
      output.push(source);
    }
  }
  return output;
}

function isConfigField(value: ConfigSchema): value is ConfigField<unknown> {
  return fieldMarker in value;
}

function isSourceArray(source: ConfigSourceInput): source is readonly ConfigSource[] {
  return Array.isArray(source);
}

function pathLabel(path: readonly string[]): string {
  return path.join('.');
}

function readField(
  field: ConfigField<unknown>,
  sources: readonly ConfigSource[],
  path: readonly string[]
): unknown {
  const value = findValue(sources, path, field.sourceKey);
  const label = pathLabel(path);
  if (!value.found || value.value === '') {
    if (field.state.hasDefault) {
      return field.state.defaultValue;
    }
    if (field.state.isOptional) {
      return undefined;
    }
    throw new Error(`${label} is required`);
  }
  return field.parse(value.value, label);
}

function readPath(source: ConfigSource, path: readonly string[]): ReadResult {
  let current: unknown = source;
  for (const part of path) {
    if (typeof current !== 'object' || current === null || !(part in current)) {
      return { found: false };
    }
    current = (current as Record<string, unknown>)[part];
  }
  return {
    found: true,
    value: current
  };
}

function readSchema(
  schema: ConfigSchema,
  sources: readonly ConfigSource[],
  path: readonly string[]
): unknown {
  if (isConfigField(schema)) {
    return readField(schema, sources, path);
  }

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    output[key] = readSchema(value, sources, [...path, key]);
  }
  return output;
}
