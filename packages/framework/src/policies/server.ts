import { createLogger, logError } from '../log.js';
import { assertPolicyValue, descriptorOf, type AnyPolicyDefinition } from './definition.js';
import {
  identityOf,
  PolicyContractError,
  requirePolicyDocument,
  requirePolicyIdentity,
  throwContract
} from './document.js';
import {
  POLICY_INSTANCES_CHANGED_EVENT,
  type PolicyDocument,
  type PolicyError,
  type PolicyIdentity,
  type PolicyInstancesChanged,
  type PolicyMutationResult,
  type PolicyProcedures,
  type PolicyStore,
  type PolicyValue
} from './types.js';
import type { EventBus } from '../events/eventBus.js';
import type { PolicyInstance } from './resolvers.js';

type CreateServerInput = {
  catalog: readonly AnyPolicyDefinition[];
  events?: EventBus;
  store: PolicyStore;
};

type RuntimeState = {
  documents: Map<string, PolicyDocument>;
  values: Map<string, PolicyValue>;
};

const logger = createLogger('policies');

export function createPolicyServer(input: CreateServerInput): {
  procedures: PolicyProcedures;
  start(): Promise<void>;
} {
  const definitions = validateCatalog(input.catalog);
  let state: RuntimeState = {
    documents: new Map(),
    values: new Map()
  };
  let mutationQueue = Promise.resolve();

  async function start(): Promise<void> {
    const loaded = await input.store.loadAll();
    state = createState(definitions, loaded);
  }

  const procedures: PolicyProcedures = {
    async deleteInstance(rawInput) {
      const identity = safeIdentity(rawInput);
      if (identity.status === 'rejected') {
        return identity.result('delete');
      }
      return serializeMutation(() => deleteInstance(identity.value));
    },
    getInstance(rawInput) {
      const identity = requirePolicyIdentity(rawInput);
      const document = state.documents.get(identityKey(identity));
      if (document === undefined) {
        throwContract({
          code: 'invalid_document',
          identity,
          message: `Policy instance is not found: ${identity.kind}/${identity.name}`
        });
      }
      return document;
    },
    getPolicyValue(rawInput) {
      if (!isRecord(rawInput) || typeof rawInput.kind !== 'string') {
        throwContract({
          code: 'invalid_document',
          fieldPath: ['kind'],
          message: 'getPolicyValue input.kind is required'
        });
      }
      const definition = definitions.byKind.get(rawInput.kind);
      if (definition === undefined) {
        throwContract({
          code: 'unknown_kind',
          message: `Unknown policy kind: ${rawInput.kind}`
        });
      }
      return valueFor(definition.kind);
    },
    listInstances(rawInput) {
      const filter = instanceFilter(rawInput);
      return [...state.documents.values()].filter((document) =>
        documentMatches(definitions, document, filter)
      );
    },
    listPolicyKinds() {
      return definitions.all.map(descriptorOf);
    },
    async setInstance(rawInput) {
      const document = safeDocument(isRecord(rawInput) ? rawInput.document : undefined);
      if (document.status === 'rejected') {
        return document.result('set');
      }
      return serializeMutation(() => setInstance(document.value));
    }
  };

  async function setInstance(document: PolicyDocument): Promise<PolicyMutationResult> {
    const identity = identityOf(document);
    const prepared = prepareSet(definitions, state, document);
    if (prepared.status === 'rejected') {
      return rejected('set', identity, prepared.error);
    }

    try {
      await input.store.set(document);
    } catch (error) {
      return rejected('set', identity, {
        code: 'store_conflict',
        identity,
        message: error instanceof Error ? error.message : String(error)
      });
    }

    const previousValue = valueFor(document.kind);
    state = prepared.state;
    const changed = !sameJson(previousValue, valueFor(document.kind));
    publishChanged(document.kind);
    return {
      identity,
      operation: 'set',
      policyValueChanged: changed,
      status: 'applied'
    };
  }

  async function deleteInstance(identity: PolicyIdentity): Promise<PolicyMutationResult> {
    const prepared = prepareDelete(definitions, state, identity);
    if (prepared.status === 'rejected') {
      return rejected('delete', identity, prepared.error);
    }

    try {
      await input.store.delete(identity);
    } catch (error) {
      return rejected('delete', identity, {
        code: 'store_conflict',
        identity,
        message: error instanceof Error ? error.message : String(error)
      });
    }

    const previousValue = valueFor(identity.kind);
    state = prepared.state;
    const changed = !sameJson(previousValue, valueFor(identity.kind));
    publishChanged(identity.kind);
    return {
      identity,
      operation: 'delete',
      policyValueChanged: changed,
      status: 'applied'
    };
  }

  async function serializeMutation<T>(operation: () => Promise<T>): Promise<T> {
    const next = mutationQueue.catch(() => undefined).then(operation);
    mutationQueue = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }

  function publishChanged(kind: string): void {
    const definition = definitions.byKind.get(kind);
    if (definition === undefined || input.events === undefined) {
      return;
    }
    const data: PolicyInstancesChanged = {
      kind,
      moduleId: definition.moduleId
    };
    try {
      input.events.publish(POLICY_INSTANCES_CHANGED_EVENT, data);
    } catch (error) {
      logger.error(
        {
          event: 'policy.event_publish_failed',
          kind,
          ...logError(error)
        },
        'policy update event publish failed'
      );
    }
  }

  function valueFor(kind: string): PolicyValue {
    const value = state.values.get(kind);
    if (value === undefined) {
      throw new Error(`Policy value is not resolved: ${kind}`);
    }
    return value;
  }

  return {
    procedures,
    start
  };
}

function createState(definitions: Catalog, documents: readonly PolicyDocument[]): RuntimeState {
  const byIdentity = new Map<string, PolicyDocument>();
  for (const rawDocument of documents) {
    const document = requirePolicyDocument(rawDocument);
    const definition = definitions.byKind.get(document.kind);
    if (definition === undefined) {
      throwContract({
        code: 'unknown_kind',
        identity: identityOf(document),
        message: `Unknown policy kind: ${document.kind}`
      });
    }
    const key = identityKey(identityOf(document));
    if (byIdentity.has(key)) {
      throwContract({
        code: 'duplicate_identity',
        identity: identityOf(document),
        message: `Duplicate policy identity: ${key}`
      });
    }
    byIdentity.set(key, document);
  }

  return resolveAll(definitions, byIdentity);
}

function resolveAll(definitions: Catalog, documents: Map<string, PolicyDocument>): RuntimeState {
  const values = new Map<string, PolicyValue>();
  for (const definition of definitions.all) {
    const documentsForKind = [...documents.values()]
      .filter((document) => document.kind === definition.kind)
      .sort((left, right) => left.metadata.name.localeCompare(right.metadata.name));
    values.set(definition.kind, resolveDefinition(definition, documentsForKind));
  }
  return {
    documents,
    values
  };
}

function resolveDefinition(
  definition: AnyPolicyDefinition,
  documents: readonly PolicyDocument[]
): PolicyValue {
  const instances: PolicyInstance<unknown>[] = [];
  for (const document of documents) {
    const result = definition.spec.safeParse(document.spec);
    if (!result.success) {
      const issue = result.error.issues[0];
      throwContract({
        code: 'invalid_spec',
        ...(issue === undefined ? {} : { fieldPath: issue.path.map(String) }),
        identity: identityOf(document),
        message:
          issue?.message ?? `Policy spec is invalid: ${document.kind}/${document.metadata.name}`
      });
    }
    instances.push(policyInstanceOf(document, result.data));
  }

  try {
    const resolve = definition.resolve as unknown as (
      items: readonly PolicyInstance<unknown>[]
    ) => unknown;
    return assertPolicyValue(resolve(instances));
  } catch (error) {
    if (error instanceof PolicyContractError) {
      throw error;
    }
    throwContract({
      code:
        error instanceof Error && error.message === 'Policy value must be JSON-safe'
          ? 'non_json_value'
          : 'resolver_error',
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

function policyInstanceOf(document: PolicyDocument, spec: unknown): PolicyInstance<unknown> {
  return Object.freeze({
    metadata: Object.freeze({
      ...(document.metadata.labels === undefined
        ? {}
        : { labels: Object.freeze({ ...document.metadata.labels }) }),
      name: document.metadata.name
    }),
    spec
  });
}

function prepareSet(
  definitions: Catalog,
  current: RuntimeState,
  document: PolicyDocument
): { state: RuntimeState; status: 'applied' } | { error: PolicyError; status: 'rejected' } {
  const definition = definitions.byKind.get(document.kind);
  if (definition === undefined) {
    return {
      error: {
        code: 'unknown_kind',
        identity: identityOf(document),
        message: `Unknown policy kind: ${document.kind}`
      },
      status: 'rejected'
    };
  }
  return captureContract(() => {
    const documents = new Map(current.documents);
    documents.set(identityKey(identityOf(document)), document);
    return resolveAll(definitions, documents);
  });
}

function prepareDelete(
  definitions: Catalog,
  current: RuntimeState,
  identity: PolicyIdentity
): { state: RuntimeState; status: 'applied' } | { error: PolicyError; status: 'rejected' } {
  if (!definitions.byKind.has(identity.kind)) {
    return {
      error: {
        code: 'unknown_kind',
        identity,
        message: `Unknown policy kind: ${identity.kind}`
      },
      status: 'rejected'
    };
  }
  return captureContract(() => {
    const documents = new Map(current.documents);
    documents.delete(identityKey(identity));
    return resolveAll(definitions, documents);
  });
}

function captureContract(
  operation: () => RuntimeState
): { state: RuntimeState; status: 'applied' } | { error: PolicyError; status: 'rejected' } {
  try {
    return {
      state: operation(),
      status: 'applied'
    };
  } catch (error) {
    if (error instanceof PolicyContractError) {
      return {
        error: error.error,
        status: 'rejected'
      };
    }
    return {
      error: {
        code: 'resolver_error',
        message: error instanceof Error ? error.message : String(error)
      },
      status: 'rejected'
    };
  }
}

type Catalog = {
  all: readonly AnyPolicyDefinition[];
  byId: Map<string, AnyPolicyDefinition>;
  byKind: Map<string, AnyPolicyDefinition>;
};

function validateCatalog(catalog: readonly AnyPolicyDefinition[]): Catalog {
  const byId = new Map<string, AnyPolicyDefinition>();
  const byKind = new Map<string, AnyPolicyDefinition>();
  for (const definition of catalog) {
    if (byId.has(definition.id)) {
      throw new Error(`Duplicate policy definition id: ${definition.id}`);
    }
    if (byKind.has(definition.kind)) {
      throw new Error(`Duplicate policy definition kind: ${definition.kind}`);
    }
    byId.set(definition.id, definition);
    byKind.set(definition.kind, definition);
  }
  return {
    all: [...catalog],
    byId,
    byKind
  };
}

function safeDocument(
  value: unknown
):
  | { status: 'accepted'; value: PolicyDocument }
  | { result(operation: 'delete' | 'set'): PolicyMutationResult; status: 'rejected' } {
  try {
    return {
      status: 'accepted',
      value: requirePolicyDocument(value)
    };
  } catch (error) {
    return rejectedParser(error);
  }
}

function safeIdentity(
  value: unknown
):
  | { status: 'accepted'; value: PolicyIdentity }
  | { result(operation: 'delete' | 'set'): PolicyMutationResult; status: 'rejected' } {
  try {
    return {
      status: 'accepted',
      value: requirePolicyIdentity(value)
    };
  } catch (error) {
    return rejectedParser(error);
  }
}

function rejectedParser(error: unknown): {
  result(operation: 'delete' | 'set'): PolicyMutationResult;
  status: 'rejected';
} {
  return {
    result(operation) {
      return rejected(operation, undefined, contractError(error));
    },
    status: 'rejected'
  };
}

function contractError(error: unknown): PolicyError {
  if (error instanceof PolicyContractError) {
    return error.error;
  }
  return {
    code: 'invalid_document',
    message: error instanceof Error ? error.message : String(error)
  };
}

function rejected(
  operation: 'delete' | 'set',
  identity: PolicyIdentity | undefined,
  error: PolicyError
): PolicyMutationResult {
  return {
    error: identity === undefined ? error : { ...error, identity: error.identity ?? identity },
    ...(identity === undefined ? {} : { identity }),
    operation,
    policyValueChanged: false,
    status: 'rejected'
  };
}

function identityKey(identity: PolicyIdentity): string {
  return `${identity.kind}/${identity.name}`;
}

function instanceFilter(input: unknown): {
  kind?: string;
  labels?: Record<string, string>;
  moduleId?: string;
} {
  if (input === undefined) {
    return {};
  }
  if (!isRecord(input)) {
    throwContract({
      code: 'invalid_document',
      message: 'listInstances input must be an object'
    });
  }
  if (input.kind !== undefined && !isPolicyKind(input.kind)) {
    throwContract({
      code: 'invalid_document',
      fieldPath: ['kind'],
      message: 'listInstances input.kind must be UpperCamelCase'
    });
  }
  if (input.moduleId !== undefined && !isModuleId(input.moduleId)) {
    throwContract({
      code: 'invalid_document',
      fieldPath: ['moduleId'],
      message: 'listInstances input.moduleId must be kebab-case'
    });
  }
  if (input.labels !== undefined && !isPolicyLabels(input.labels)) {
    throwContract({
      code: 'invalid_document',
      fieldPath: ['labels'],
      message: 'listInstances input.labels must be a camelCase string record'
    });
  }
  return {
    ...(input.kind === undefined ? {} : { kind: input.kind }),
    ...(input.labels === undefined ? {} : { labels: input.labels }),
    ...(input.moduleId === undefined ? {} : { moduleId: input.moduleId })
  };
}

function documentMatches(
  definitions: Catalog,
  document: PolicyDocument,
  filter: { kind?: string; labels?: Record<string, string>; moduleId?: string }
): boolean {
  if (filter.kind !== undefined && document.kind !== filter.kind) {
    return false;
  }
  const definition = definitions.byKind.get(document.kind);
  if (filter.moduleId !== undefined && definition?.moduleId !== filter.moduleId) {
    return false;
  }
  if (filter.labels !== undefined) {
    const labels = document.metadata.labels ?? {};
    return Object.entries(filter.labels).every(([key, value]) => labels[key] === value);
  }
  return true;
}

function sameJson(left: PolicyValue, right: PolicyValue): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPolicyKind(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z][A-Za-z0-9]*$/.test(value);
}

function isModuleId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z][a-z0-9-]*$/.test(value);
}

function isPolicyLabels(value: unknown): value is Record<string, string> {
  return (
    isRecord(value) &&
    Object.entries(value).every(
      ([key, item]) =>
        /^[a-z][A-Za-z0-9]*$/.test(key) && typeof item === 'string' && item.trim().length > 0
    )
  );
}
