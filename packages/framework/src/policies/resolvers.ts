export type PolicyResolvedValue = readonly unknown[] | Readonly<Record<string, unknown>>;

type PolicyInstanceMetadata = {
  readonly labels?: Readonly<Record<string, string>>;
  readonly name: string;
};

export type PolicyInstance<TSpec> = {
  readonly metadata: PolicyInstanceMetadata;
  readonly spec: TSpec;
};

export type PolicyResolver<TSpec, TValue extends PolicyResolvedValue> = (
  instances: readonly PolicyInstance<TSpec>[]
) => TValue;

export function collectSpecs<TSpec>(): PolicyResolver<TSpec, readonly TSpec[]> {
  return (instances) => Object.freeze(instances.map((instance) => instance.spec));
}

export function recordBy<TSpec>(
  keyOf: (spec: TSpec) => number | string
): PolicyResolver<TSpec, Readonly<Record<string, TSpec>>> {
  return (instances) => {
    const output: Record<string, TSpec> = {};
    for (const { spec } of instances) {
      const key = String(keyOf(spec));
      if (!isSafeRecordKey(key)) {
        throw new Error(`Unsafe policy record key: ${key}`);
      }
      if (Object.hasOwn(output, key)) {
        throw new Error(`Duplicate policy record key: ${key}`);
      }
      output[key] = spec;
    }
    return Object.freeze(output);
  };
}

export function singleSpec<TSpec extends PolicyResolvedValue>(input: {
  empty: TSpec;
}): PolicyResolver<TSpec, TSpec> {
  return (instances) => {
    if (instances.length === 0) {
      return input.empty;
    }
    if (instances.length > 1) {
      throw new Error(`Expected at most one policy instance, got ${String(instances.length)}`);
    }
    const [instance] = instances;
    if (instance === undefined) {
      throw new Error('Expected one policy instance');
    }
    return instance.spec;
  };
}

function isSafeRecordKey(key: string): boolean {
  return key !== '__proto__' && key !== 'constructor' && key !== 'prototype';
}
