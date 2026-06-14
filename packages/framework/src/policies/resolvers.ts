export type PolicyResolvedValue = readonly unknown[] | Readonly<Record<string, unknown>>;

export type PolicyResolver<TSpec, TValue extends PolicyResolvedValue> = (
  specs: readonly TSpec[]
) => TValue;

export function collectSpecs<TSpec>(): PolicyResolver<TSpec, readonly TSpec[]> {
  return (specs) => Object.freeze([...specs]);
}

export function recordBy<TSpec>(
  keyOf: (spec: TSpec) => number | string
): PolicyResolver<TSpec, Readonly<Record<string, TSpec>>> {
  return (specs) => {
    const output: Record<string, TSpec> = {};
    for (const spec of specs) {
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
  return (specs) => {
    if (specs.length === 0) {
      return input.empty;
    }
    if (specs.length > 1) {
      throw new Error(`Expected at most one policy instance, got ${String(specs.length)}`);
    }
    const [spec] = specs;
    if (spec === undefined) {
      throw new Error('Expected one policy instance');
    }
    return spec;
  };
}

function isSafeRecordKey(key: string): boolean {
  return key !== '__proto__' && key !== 'constructor' && key !== 'prototype';
}
