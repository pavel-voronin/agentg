import type { JsonObject, JsonValue } from '../json.js';
import {
  POLICY_API_VERSION,
  type PolicyDocument,
  type PolicyError,
  type PolicyIdentity,
  type PolicyMetadata
} from './types.js';

export class PolicyContractError extends Error {
  readonly error: PolicyError;

  constructor(error: PolicyError) {
    super(error.message);
    this.name = 'PolicyContractError';
    this.error = error;
  }
}

export function identityOf(document: PolicyDocument): PolicyIdentity {
  return {
    kind: document.kind,
    name: document.metadata.name
  };
}

export function requirePolicyDocument(value: unknown): PolicyDocument {
  if (!isRecord(value)) {
    throwContract({
      code: 'invalid_document',
      message: 'Policy document must be an object'
    });
  }

  const apiVersion = value.apiVersion;
  if (apiVersion !== POLICY_API_VERSION) {
    throwContract({
      code: 'invalid_api_version',
      message: `Policy apiVersion must be ${POLICY_API_VERSION}`
    });
  }

  const kind = value.kind;
  if (typeof kind !== 'string' || !/^[A-Z][A-Za-z0-9]*$/.test(kind)) {
    throwContract({
      code: 'invalid_document',
      fieldPath: ['kind'],
      message: 'Policy kind must be UpperCamelCase'
    });
  }

  const metadata = requireMetadata(value.metadata);
  const spec = value.spec;
  if (!isJsonValue(spec)) {
    throwContract({
      code: 'invalid_document',
      fieldPath: ['spec'],
      message: 'Policy spec must be JSON-safe'
    });
  }

  return {
    apiVersion,
    kind,
    metadata,
    spec
  };
}

export function requirePolicyIdentity(value: unknown): PolicyIdentity {
  if (!isRecord(value)) {
    throwContract({
      code: 'invalid_document',
      message: 'Policy identity must be an object'
    });
  }
  if (typeof value.kind !== 'string' || !/^[A-Z][A-Za-z0-9]*$/.test(value.kind)) {
    throwContract({
      code: 'invalid_document',
      fieldPath: ['kind'],
      message: 'Policy identity kind must be UpperCamelCase'
    });
  }
  if (typeof value.name !== 'string' || !isCamelCaseStem(value.name)) {
    throwContract({
      code: 'invalid_document',
      fieldPath: ['name'],
      message: 'Policy identity name must be camelCase'
    });
  }
  return {
    kind: value.kind,
    name: value.name
  };
}

export function throwContract(error: PolicyError): never {
  throw new PolicyContractError(error);
}

function requireMetadata(value: unknown): PolicyMetadata {
  if (!isRecord(value)) {
    throwContract({
      code: 'invalid_document',
      fieldPath: ['metadata'],
      message: 'Policy metadata must be an object'
    });
  }
  if (typeof value.name !== 'string' || !isCamelCaseStem(value.name)) {
    throwContract({
      code: 'invalid_document',
      fieldPath: ['metadata', 'name'],
      message: 'Policy metadata.name must be camelCase'
    });
  }

  const labels = value.labels;
  if (labels === undefined) {
    return {
      name: value.name
    };
  }
  if (!isStringRecord(labels)) {
    throwContract({
      code: 'invalid_document',
      fieldPath: ['metadata', 'labels'],
      message: 'Policy metadata.labels must be a string record'
    });
  }
  for (const [key, labelValue] of Object.entries(labels)) {
    if (!isCamelCaseStem(key) || labelValue.trim().length === 0) {
      throwContract({
        code: 'invalid_document',
        fieldPath: ['metadata', 'labels', key],
        message: 'Policy label keys must be camelCase and values must be non-empty strings'
      });
    }
  }
  return {
    labels,
    name: value.name
  };
}

function isCamelCaseStem(value: string): boolean {
  return /^[a-z][A-Za-z0-9]*$/.test(value);
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
  if (isRecord(value)) {
    return Object.entries(value).every(([key, item]) => isSafeObjectKey(key) && isJsonValue(item));
  }
  return false;
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((item) => typeof item === 'string');
}

function isSafeObjectKey(key: string): boolean {
  return key !== '__proto__' && key !== 'constructor' && key !== 'prototype';
}
