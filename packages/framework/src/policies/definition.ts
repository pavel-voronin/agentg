import { z, type ZodType } from 'zod';

import { toJsonValue, type JsonValue } from '../json.js';
import { collectSpecs, type PolicyResolvedValue, type PolicyResolver } from './resolvers.js';
import type { PolicyDocument, PolicyKindDescriptor, PolicyValue } from './types.js';

export type PolicyDefinition<
  TSpec = unknown,
  TValue extends PolicyResolvedValue = readonly TSpec[]
> = {
  readonly form: PolicyKindDescriptor['form'];
  readonly id: string;
  readonly kind: string;
  readonly moduleId: string;
  readonly resolve: PolicyResolver<TSpec, TValue>;
  readonly spec: ZodType<TSpec>;
  readonly version: number;
};

export type AnyPolicyDefinition = Omit<
  PolicyDefinition<unknown, PolicyResolvedValue>,
  'resolve'
> & {
  readonly resolve: PolicyResolver<never, PolicyResolvedValue>;
};

export type PolicySpecOf<TDefinition> =
  TDefinition extends PolicyDefinition<infer TSpec, PolicyResolvedValue> ? TSpec : never;

export type PolicyValueOf<TDefinition> =
  TDefinition extends PolicyDefinition<unknown, infer TValue extends PolicyResolvedValue>
    ? Readonly<TValue>
    : never;

type DefinePolicyInput<TSpec, TValue extends PolicyResolvedValue> = {
  readonly examples?: readonly PolicyDocument[];
  readonly id: string;
  readonly kind: string;
  readonly moduleId: string;
  readonly resolve?: PolicyResolver<TSpec, TValue>;
  readonly spec: ZodType<TSpec>;
  readonly version: number;
};

export function definePolicy<TSpec, TValue extends PolicyResolvedValue = readonly TSpec[]>(
  input: DefinePolicyInput<TSpec, TValue>
): PolicyDefinition<TSpec, TValue> {
  const resolve =
    input.resolve ?? (collectSpecs<TSpec>() as unknown as PolicyResolver<TSpec, TValue>);
  validateDefinitionInput(input.id, input.kind, input.moduleId, input.version);

  return Object.freeze({
    form: Object.freeze({
      ...(input.examples === undefined ? {} : { examples: Object.freeze([...input.examples]) }),
      spec: toJsonValue(z.toJSONSchema(input.spec))
    }),
    id: input.id,
    kind: input.kind,
    moduleId: input.moduleId,
    resolve,
    spec: input.spec,
    version: input.version
  });
}

export function descriptorOf(definition: PolicyDescriptorSource): PolicyKindDescriptor {
  return {
    form: definition.form,
    id: definition.id,
    kind: definition.kind,
    moduleId: definition.moduleId,
    version: definition.version
  };
}

type PolicyDescriptorSource = {
  readonly form: PolicyKindDescriptor['form'];
  readonly id: string;
  readonly kind: string;
  readonly moduleId: string;
  readonly version: number;
};

function validateDefinitionInput(
  id: string,
  kind: string,
  moduleId: string,
  version: number
): void {
  if (id.trim().length === 0) {
    throw new Error('Policy definition id is required');
  }
  if (!/^[A-Z][A-Za-z0-9]*$/.test(kind)) {
    throw new Error(`Policy kind must be UpperCamelCase: ${kind}`);
  }
  if (!/^[a-z][a-z0-9-]*$/.test(moduleId)) {
    throw new Error(`Policy moduleId must be kebab-case: ${moduleId}`);
  }
  if (!Number.isSafeInteger(version) || version <= 0) {
    throw new Error(`Policy version must be a positive integer: ${String(version)}`);
  }
}

export function assertPolicyValue(value: unknown): PolicyValue {
  if (!Array.isArray(value) && !isPlainObject(value)) {
    throw new Error('Policy value must be an array or an object');
  }

  if (!isJsonValue(value)) {
    throw new Error('Policy value must be JSON-safe');
  }

  return deepFreeze(value);
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const nested of Object.values(value)) {
    deepFreeze(nested);
  }
  return value;
}

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  ) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  if (isPlainObject(value)) {
    return Object.entries(value).every(([key, item]) => isSafeObjectKey(key) && isJsonValue(item));
  }
  return false;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function isSafeObjectKey(key: string): boolean {
  return key !== '__proto__' && key !== 'constructor' && key !== 'prototype';
}
