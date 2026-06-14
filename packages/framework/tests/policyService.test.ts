import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';

import { defineConfig, defineModule } from '../src/index.js';
import type { EventBus, EventEnvelope, EventSubscription } from '../src/events/eventBus.js';
import {
  createPolicyServer,
  definePolicy,
  POLICY_API_VERSION,
  POLICY_INSTANCES_CHANGED_EVENT,
  recordBy,
  PolicyContractError,
  type PolicyClient,
  type PolicyDocument,
  type PolicyStore,
  type PolicyValue
} from '../src/policies/index.js';
import type { ProcedureServer, RpcFactory } from '../src/rpc/rpc.js';

const readEmptyConfig = defineConfig({});

const sampleRule = definePolicy({
  id: 'sample.rules',
  kind: 'SampleRule',
  moduleId: 'sample',
  spec: z.object({
    key: z.string(),
    mode: z.enum(['enabled', 'disabled'])
  }),
  version: 1
});

definePolicy({
  id: 'sample.invalidPrimitiveResolver',
  kind: 'SampleInvalidPrimitiveResolver',
  moduleId: 'sample',
  // @ts-expect-error policy resolver must return an object or an array
  resolve() {
    return 1;
  },
  spec: z.object({
    key: z.string()
  }),
  version: 1
});

describe('policy server', () => {
  it('rejects invalid specs before writing to the store', async () => {
    const store = memoryStore([]);
    const server = createPolicyServer({
      catalog: [sampleRule],
      store
    });

    await server.start();

    const result = await server.procedures.setInstance({
      document: document({
        name: 'alpha',
        spec: {
          key: 'alpha',
          mode: 'broken'
        }
      })
    });

    expect(result).toMatchObject({
      error: {
        code: 'invalid_spec'
      },
      policyValueChanged: false,
      status: 'rejected'
    });
    expect(store.writes).toEqual([]);
    expect(server.procedures.getPolicyValue({ kind: 'SampleRule' })).toEqual([]);
  });

  it('publishes a small change event after an applied mutation', async () => {
    const events = manualEvents();
    const server = createPolicyServer({
      catalog: [sampleRule],
      events,
      store: memoryStore([])
    });

    await server.start();
    const result = await server.procedures.setInstance({
      document: document({
        name: 'alpha',
        spec: {
          key: 'alpha',
          mode: 'enabled'
        }
      })
    });

    expect(result).toMatchObject({
      identity: {
        kind: 'SampleRule',
        name: 'alpha'
      },
      operation: 'set',
      policyValueChanged: true,
      status: 'applied'
    });
    expect(events.published).toEqual([
      {
        data: {
          kind: 'SampleRule',
          moduleId: 'sample'
        },
        type: POLICY_INSTANCES_CHANGED_EVENT
      }
    ]);
  });

  it('rejects resolver errors without changing active value', async () => {
    const keyedRule = definePolicy({
      id: 'sample.keyedRules',
      kind: 'SampleKeyedRule',
      moduleId: 'sample',
      resolve: recordBy<{ key: string; mode: 'enabled' | 'disabled' }>((spec) => spec.key),
      spec: z.object({
        key: z.string(),
        mode: z.enum(['enabled', 'disabled'])
      }),
      version: 1
    });
    const server = createPolicyServer({
      catalog: [keyedRule],
      store: memoryStore([
        document({
          kind: 'SampleKeyedRule',
          name: 'alpha',
          spec: {
            key: 'alpha',
            mode: 'enabled'
          }
        })
      ])
    });
    await server.start();

    const result = await server.procedures.setInstance({
      document: document({
        kind: 'SampleKeyedRule',
        name: 'beta',
        spec: {
          key: 'alpha',
          mode: 'disabled'
        }
      })
    });

    expect(result).toMatchObject({
      error: {
        code: 'resolver_error'
      },
      policyValueChanged: false,
      status: 'rejected'
    });
    expect(server.procedures.getPolicyValue({ kind: 'SampleKeyedRule' })).toEqual({
      alpha: {
        key: 'alpha',
        mode: 'enabled'
      }
    });
  });

  it('rejects non-JSON policy values before writing to the store', async () => {
    const nonJsonRule = definePolicy({
      id: 'sample.nonJsonRules',
      kind: 'SampleNonJsonRule',
      moduleId: 'sample',
      resolve(specs) {
        if (specs.length === 0) {
          return [];
        }
        return {
          invalid: () => undefined
        };
      },
      spec: z.object({
        key: z.string()
      }),
      version: 1
    });
    const store = memoryStore([]);
    const server = createPolicyServer({
      catalog: [nonJsonRule],
      store
    });
    await server.start();

    const result = await server.procedures.setInstance({
      document: document({
        kind: 'SampleNonJsonRule',
        name: 'alpha',
        spec: {
          key: 'alpha'
        }
      })
    });

    expect(result).toMatchObject({
      error: {
        code: 'non_json_value'
      },
      policyValueChanged: false,
      status: 'rejected'
    });
    expect(store.writes).toEqual([]);
  });

  it('allows recordBy keys that exist on Object.prototype', async () => {
    const keyedRule = definePolicy({
      id: 'sample.prototypeNamedRules',
      kind: 'SamplePrototypeNamedRule',
      moduleId: 'sample',
      resolve: recordBy<{ key: string }>((spec) => spec.key),
      spec: z.object({
        key: z.string()
      }),
      version: 1
    });
    const server = createPolicyServer({
      catalog: [keyedRule],
      store: memoryStore([
        document({
          kind: 'SamplePrototypeNamedRule',
          name: 'alpha',
          spec: {
            key: 'toString'
          }
        })
      ])
    });
    await server.start();

    expect(server.procedures.getPolicyValue({ kind: 'SamplePrototypeNamedRule' })).toEqual({
      toString: {
        key: 'toString'
      }
    });
  });

  it('resolves the full active set before accepting a new instance', async () => {
    const minimumRule = definePolicy({
      id: 'sample.minimumRules',
      kind: 'SampleMinimumRule',
      moduleId: 'sample',
      resolve(specs: readonly { key: string; mode: string }[]) {
        if (specs.length < 2) {
          throw new Error('Expected at least two specs');
        }
        return Object.freeze([...specs]);
      },
      spec: z.object({
        key: z.string(),
        mode: z.enum(['enabled', 'disabled'])
      }),
      version: 1
    });
    const store = memoryStore([
      document({
        kind: 'SampleMinimumRule',
        name: 'alpha',
        spec: {
          key: 'alpha',
          mode: 'enabled'
        }
      }),
      document({
        kind: 'SampleMinimumRule',
        name: 'beta',
        spec: {
          key: 'beta',
          mode: 'disabled'
        }
      })
    ]);
    const server = createPolicyServer({
      catalog: [minimumRule],
      store
    });
    await server.start();

    const result = await server.procedures.setInstance({
      document: document({
        kind: 'SampleMinimumRule',
        name: 'gamma',
        spec: {
          key: 'gamma',
          mode: 'enabled'
        }
      })
    });

    expect(result).toMatchObject({
      status: 'applied'
    });
    expect(store.writes.map((item) => item.metadata.name)).toEqual(['gamma']);
  });

  it('rejects resolver errors before deleting from the store', async () => {
    const requiredRule = definePolicy({
      id: 'sample.requiredRules',
      kind: 'SampleRequiredRule',
      moduleId: 'sample',
      resolve(specs: readonly { key: string; mode: string }[]) {
        if (specs.length === 0) {
          throw new Error('Expected at least one spec');
        }
        return Object.freeze([...specs]);
      },
      spec: z.object({
        key: z.string(),
        mode: z.enum(['enabled', 'disabled'])
      }),
      version: 1
    });
    const store = memoryStore([
      document({
        kind: 'SampleRequiredRule',
        name: 'alpha',
        spec: {
          key: 'alpha',
          mode: 'enabled'
        }
      })
    ]);
    const server = createPolicyServer({
      catalog: [requiredRule],
      store
    });
    await server.start();

    const result = await server.procedures.deleteInstance({
      kind: 'SampleRequiredRule',
      name: 'alpha'
    });

    expect(result).toMatchObject({
      error: {
        code: 'resolver_error'
      },
      policyValueChanged: false,
      status: 'rejected'
    });
    expect(store.deletes).toEqual([]);
    expect(server.procedures.getPolicyValue({ kind: 'SampleRequiredRule' })).toEqual([
      {
        key: 'alpha',
        mode: 'enabled'
      }
    ]);
  });

  it('rejects malformed listInstances filters', async () => {
    const server = createPolicyServer({
      catalog: [sampleRule],
      store: memoryStore([])
    });
    await server.start();

    expect(() =>
      server.procedures.listInstances({
        labels: {
          subsystem: 1
        } as never
      })
    ).toThrow(PolicyContractError);
    expect(() =>
      server.procedures.listInstances({
        kind: 'sampleRule'
      })
    ).toThrow(PolicyContractError);
  });
});

describe('usePolicy', () => {
  it('returns a stable getter that reads the latest policy value', async () => {
    const events = manualEvents();
    let currentValue: PolicyValue = [
      {
        key: 'alpha',
        mode: 'enabled'
      }
    ];
    const client = {
      getPolicyValue: vi.fn(() => Promise.resolve(currentValue))
    } as unknown as PolicyClient;
    let readRules: (() => readonly { key: string; mode: 'enabled' | 'disabled' }[]) | undefined;
    const definition = defineModule('sample', {
      config: readEmptyConfig,
      setup({ usePolicy }) {
        readRules = usePolicy(sampleRule);
        return {};
      }
    });
    const app = definition({
      config: {},
      connect: {
        events: () => events,
        policies: () => client,
        rpc: testRpc()
      }
    });

    await app.start();

    const stableReadRules = readRules;
    expect(readRules?.()[0]?.key).toBe('alpha');

    currentValue = [
      {
        key: 'beta',
        mode: 'disabled'
      }
    ];
    await events.emit(POLICY_INSTANCES_CHANGED_EVENT, {
      kind: 'SampleRule',
      moduleId: 'sample'
    });
    await nextMicrotask();

    expect(readRules).toBe(stableReadRules);
    expect(readRules?.()[0]).toEqual({
      key: 'beta',
      mode: 'disabled'
    });

    await app.stop();
  });

  it('subscribes before the initial fetch and catches concurrent policy events', async () => {
    const events = manualEvents();
    let fetchCount = 0;
    const client = {
      getPolicyValue: vi.fn(async () => {
        fetchCount += 1;
        if (fetchCount === 1) {
          await events.emit(POLICY_INSTANCES_CHANGED_EVENT, {
            kind: 'SampleRule',
            moduleId: 'sample'
          });
          return [
            {
              key: 'alpha',
              mode: 'enabled'
            }
          ];
        }
        return [
          {
            key: 'beta',
            mode: 'disabled'
          }
        ];
      })
    } as unknown as PolicyClient & {
      getPolicyValue: ReturnType<typeof vi.fn>;
    };
    let readRules: (() => readonly { key: string; mode: 'enabled' | 'disabled' }[]) | undefined;
    const definition = defineModule('sample', {
      config: readEmptyConfig,
      setup({ usePolicy }) {
        readRules = usePolicy(sampleRule);
        return {};
      }
    });
    const app = definition({
      config: {},
      connect: {
        events: () => events,
        policies: () => client,
        rpc: testRpc()
      }
    });

    await app.start();

    expect(client.getPolicyValue).toHaveBeenCalledTimes(2);
    expect(readRules?.()[0]).toEqual({
      key: 'beta',
      mode: 'disabled'
    });

    await app.stop();
  });

  it('rejects runtime mutation of array policy values', async () => {
    const events = manualEvents();
    const client = {
      getPolicyValue: vi.fn(() =>
        Promise.resolve([
          {
            key: 'alpha',
            mode: 'enabled'
          }
        ])
      )
    } as unknown as PolicyClient;
    let readRules: (() => readonly { key: string; mode: 'enabled' | 'disabled' }[]) | undefined;
    const definition = defineModule('sample', {
      config: readEmptyConfig,
      setup({ usePolicy }) {
        readRules = usePolicy(sampleRule);
        return {};
      }
    });
    const app = definition({
      config: {},
      connect: {
        events: () => events,
        policies: () => client,
        rpc: testRpc()
      }
    });

    await app.start();

    expect(() => {
      (readRules?.() as unknown as { push(item: unknown): number }).push({
        key: 'beta',
        mode: 'disabled'
      });
    }).toThrow();
    expect(readRules?.()).toHaveLength(1);

    await app.stop();
  });

  it('keeps the last good value when refetch fails after startup', async () => {
    const events = manualEvents();
    const client = {
      getPolicyValue: vi
        .fn()
        .mockResolvedValueOnce([
          {
            key: 'alpha',
            mode: 'enabled'
          }
        ])
        .mockRejectedValueOnce(new Error('endpoint is down'))
    } as unknown as PolicyClient;
    let readRules: (() => readonly { key: string; mode: 'enabled' | 'disabled' }[]) | undefined;
    const definition = defineModule('sample', {
      config: readEmptyConfig,
      setup({ usePolicy }) {
        readRules = usePolicy(sampleRule);
        return {};
      }
    });
    const app = definition({
      config: {},
      connect: {
        events: () => events,
        policies: () => client,
        rpc: testRpc()
      }
    });

    await app.start();
    await events.emit(POLICY_INSTANCES_CHANGED_EVENT, {
      kind: 'SampleRule',
      moduleId: 'sample'
    });
    await nextMicrotask();

    expect(readRules?.()[0]).toEqual({
      key: 'alpha',
      mode: 'enabled'
    });

    await app.stop();
  });
});

function document(input: {
  kind?: string;
  name: string;
  spec: PolicyDocument['spec'];
}): PolicyDocument {
  return {
    apiVersion: POLICY_API_VERSION,
    kind: input.kind ?? 'SampleRule',
    metadata: {
      name: input.name
    },
    spec: input.spec
  };
}

function memoryStore(initial: readonly PolicyDocument[]): PolicyStore & {
  deletes: PolicyDocument['metadata']['name'][];
  writes: PolicyDocument[];
} {
  const documents = new Map(initial.map((item) => [`${item.kind}/${item.metadata.name}`, item]));
  const deletes: PolicyDocument['metadata']['name'][] = [];
  const writes: PolicyDocument[] = [];
  return {
    delete(identity) {
      deletes.push(identity.name);
      documents.delete(`${identity.kind}/${identity.name}`);
      return Promise.resolve();
    },
    loadAll() {
      return Promise.resolve([...documents.values()]);
    },
    set(item) {
      writes.push(item);
      documents.set(`${item.kind}/${item.metadata.name}`, item);
      return Promise.resolve();
    },
    deletes,
    writes
  };
}

function manualEvents(): EventBus & {
  emit(type: string, data: unknown): Promise<void>;
  published: { data?: unknown; type: string }[];
} {
  const handlers = new Map<string, ((event: EventEnvelope) => void | Promise<void>)[]>();
  const published: { data?: unknown; type: string }[] = [];
  return {
    async emit(type, data) {
      for (const handler of handlers.get(type) ?? []) {
        await handler({
          at: new Date(0).toISOString(),
          data,
          id: `evt:${type}`,
          trace: {},
          type
        });
      }
    },
    publish(type, data) {
      published.push({
        data,
        type
      });
    },
    published,
    start() {
      return Promise.resolve();
    },
    stop() {
      return Promise.resolve();
    },
    subscribe(type, handler): EventSubscription {
      const current = handlers.get(type) ?? [];
      current.push(handler);
      handlers.set(type, current);
      return {
        unsubscribe() {
          handlers.set(
            type,
            current.filter((item) => item !== handler)
          );
        }
      };
    }
  };
}

function testRpc(): RpcFactory {
  return {
    start(): Promise<ProcedureServer> {
      return Promise.resolve({
        stop() {
          return Promise.resolve();
        },
        url: 'http://127.0.0.1:0'
      });
    }
  };
}

function nextMicrotask(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
