import { describe, expect, it } from 'vitest';

import {
  defineConfig,
  defineInternalRpcDomain,
  defineModule,
  httpRpc,
  nats,
  number,
  string,
  type ProceduresOf
} from '../src/index.js';
import type { EventBusFactory } from '../src/events/eventBus.js';
import { callProcedure, startProcedureServer } from '../src/rpc/httpRpc.js';
import type { ProcedureServer } from '../src/rpc/rpc.js';

const readEmptyConfig = defineConfig({});

describe('defineModule', () => {
  it('reads config through a schema-created reader', () => {
    const readConfig = defineConfig({
      host: string('HOST').optional(),
      natsUrl: string('NATS_URL'),
      port: number('PORT').default(8710),
      timeoutMs: number('REQUEST_TIMEOUT_MS').optional()
    });

    expect(
      readConfig(
        {
          NATS_URL: 'nats://env:4222',
          PORT: '8702'
        },
        {
          port: 9000,
          timeoutMs: '1000'
        }
      )
    ).toEqual({
      host: undefined,
      natsUrl: 'nats://env:4222',
      port: 9000,
      timeoutMs: 1000
    });
  });

  it('accepts config sources as an array', () => {
    const readConfig = defineConfig({
      natsUrl: string('NATS_URL')
    });

    expect(
      readConfig([
        {
          NATS_URL: 'nats://env:4222'
        },
        {
          natsUrl: 'nats://object:4222'
        }
      ])
    ).toEqual({
      natsUrl: 'nats://object:4222'
    });
  });

  it('rejects missing required config values', () => {
    const readConfig = defineConfig({
      natsUrl: string('NATS_URL')
    });

    expect(() => readConfig({})).toThrow('natsUrl is required');
  });

  it('rejects NATS config without an explicit connection target', () => {
    expect(() => nats({})).toThrow('NATS connection requires servers or port');
  });

  it('creates resources during module instance creation', () => {
    let created = 0;

    const definition = defineModule('sample', {
      config: readEmptyConfig,
      setup({ resource }) {
        const database = resource('database', () => {
          created += 1;
          return { ready: true };
        });

        expect(database.ready).toBe(true);
        return {};
      }
    });

    expect(created).toBe(0);

    const module = definition({ config: {}, connect: testConnect() });

    expect(created).toBe(1);
    expect(Object.keys(module)).toEqual(['start', 'stop']);
  });

  it('keeps resource lifecycle inside resource creation', async () => {
    const calls: string[] = [];
    let database: { ready: boolean } | undefined;
    const definition = defineModule('sample', {
      config: readEmptyConfig,
      setup({ resource }) {
        database = resource('database', ({ shutdown, startup }) => {
          const resource = {
            ready: false
          };

          startup(() => {
            calls.push('start:database');
            resource.ready = true;
            return undefined;
          });
          shutdown(() => {
            calls.push('stop:database');
            resource.ready = false;
            return undefined;
          });

          return resource;
        });

        return {};
      }
    });
    const module = definition({ config: {}, connect: testConnect() });

    expect(database?.ready).toBe(false);
    await module.start();
    expect(database?.ready).toBe(true);
    await module.stop();

    expect(database?.ready).toBe(false);
    expect(calls).toEqual(['start:database', 'stop:database']);
  });

  it('runs resource startup cleanup before explicit resource shutdown', async () => {
    const calls: string[] = [];
    const definition = defineModule('sample', {
      config: readEmptyConfig,
      setup({ resource }) {
        resource('database', ({ shutdown, startup }) => {
          startup(() => {
            calls.push('start:database');
            return () => {
              calls.push('stop:database-startup');
              return undefined;
            };
          });
          shutdown(() => {
            calls.push('shutdown:database');
            return undefined;
          });

          return {};
        });

        return {};
      }
    });
    const module = definition({ config: {}, connect: testConnect() });

    await module.start();
    await module.stop();

    expect(calls).toEqual(['start:database', 'stop:database-startup', 'shutdown:database']);
  });

  it('starts resource background work after RPC exposure', async () => {
    const calls: string[] = [];
    const definition = defineModule('sample', {
      config: readEmptyConfig,
      setup({ resource }) {
        resource('files', ({ background }) => {
          background(() => {
            calls.push('background:files');
            return () => {
              calls.push('stop:files');
              return undefined;
            };
          });
          return {};
        });
        return {
          status: () => ({ ready: true })
        };
      }
    });
    const module = definition({
      config: {},
      connect: testConnectWithCalls(calls)
    });

    await module.start();

    expect(calls).toEqual(['events:start', 'rpc:start', 'background:files']);

    await module.stop();

    expect(calls).toEqual([
      'events:start',
      'rpc:start',
      'background:files',
      'stop:files',
      'rpc:stop',
      'events:stop'
    ]);
  });

  it('starts modules without RPC when no public procedures are exposed', async () => {
    const calls: string[] = [];
    const definition = defineModule('sample', {
      config: readEmptyConfig,
      setup({ background }) {
        background('worker', () => {
          calls.push('background:worker');
          return () => {
            calls.push('stop:worker');
            return undefined;
          };
        });
        return {};
      }
    });
    const module = definition({
      config: {},
      connect: {
        events: () => ({
          start() {
            calls.push('events:start');
            return Promise.resolve();
          },
          stop() {
            calls.push('events:stop');
            return Promise.resolve();
          },
          publish() {
            return;
          },
          subscribe() {
            return {
              unsubscribe() {
                return;
              }
            };
          }
        })
      }
    });

    await module.start();

    expect(calls).toEqual(['events:start', 'background:worker']);

    await module.stop();

    expect(calls).toEqual(['events:start', 'background:worker', 'stop:worker', 'events:stop']);
  });

  it('allows duplicate resource background names', async () => {
    const calls: string[] = [];
    const definition = defineModule('sample', {
      config: readEmptyConfig,
      setup({ resource }) {
        resource('files', ({ background }) => {
          background(() => {
            calls.push('files:1');
            return undefined;
          });
          background(() => {
            calls.push('files:2');
            return undefined;
          });
          background('queue', () => {
            calls.push('queue:1');
            return undefined;
          });
          background('queue', () => {
            calls.push('queue:2');
            return undefined;
          });
          return {};
        });
        return {};
      }
    });
    const module = definition({ config: {}, connect: testConnect() });

    await module.start();
    await module.stop();

    expect(calls).toEqual(['files:1', 'files:2', 'queue:1', 'queue:2']);
  });

  it('provides config during module instance creation', () => {
    let greeting: string | undefined;
    const readConfig = defineConfig({
      greeting: string('GREETING')
    });

    const definition = defineModule('sample', {
      config: readConfig,
      setup({ config }) {
        greeting = config.greeting;
        return {};
      }
    });

    definition({ config: { greeting: 'hello' }, connect: testConnect() });

    expect(greeting).toBe('hello');
  });

  it('preserves returned procedure types', () => {
    const definition = defineModule('sample', {
      config: readEmptyConfig,
      setup: () => ({
        greeting: () => 'hello'
      })
    });
    const procedure: ProceduresOf<typeof definition>['greeting'] = () => 'hello';

    expect(typeof definition).toBe('function');
    expect(procedure()).toBe('hello');
  });

  it('extracts procedure types from configured module definitions', () => {
    const readConfig = defineConfig({
      greeting: string('GREETING')
    });
    const definition = defineModule('sample', {
      config: readConfig,
      setup({ config }) {
        return {
          greeting: (input: { name: string }) => `${config.greeting} ${input.name}`
        };
      }
    });

    const procedure: ProceduresOf<typeof definition>['greeting'] = (input: { name: string }) =>
      `hello ${input.name}`;

    expect(typeof definition).toBe('function');
    expect(procedure({ name: 'Pavel' })).toBe('hello Pavel');
  });

  it('starts startup work before background work and stops both in reverse order', async () => {
    const calls: string[] = [];
    const definition = defineModule('sample', {
      config: readEmptyConfig,
      setup({ background, startup }) {
        startup('database', () => {
          calls.push('start:database');
          return () => {
            calls.push('stop:database');
            return undefined;
          };
        });
        background('worker', () => {
          calls.push('start:worker');
          return {
            stop() {
              calls.push('stop:worker');
              return undefined;
            }
          };
        });
        return {};
      }
    });
    const module = definition({ config: {}, connect: testConnect() });

    await module.start();
    await module.stop();

    expect(calls).toEqual(['start:database', 'start:worker', 'stop:worker', 'stop:database']);
  });

  it('exposes the module RPC only after startup work succeeds', async () => {
    const calls: string[] = [];
    const definition = defineModule('sample', {
      config: readEmptyConfig,
      setup({ background, startup }) {
        startup('database', () => {
          calls.push('startup:database');
          return () => {
            calls.push('stop:database');
            return undefined;
          };
        });
        background('worker', () => {
          calls.push('background:worker');
          return () => {
            calls.push('stop:worker');
            return undefined;
          };
        });
        return {
          ping: () => 'pong'
        };
      }
    });
    const module = definition({
      config: {},
      connect: {
        events: () => ({
          start() {
            calls.push('events:start');
            return Promise.resolve();
          },
          stop() {
            calls.push('events:stop');
            return Promise.resolve();
          },
          publish() {
            return;
          },
          subscribe() {
            return {
              unsubscribe() {
                return;
              }
            };
          }
        }),
        rpc: {
          start() {
            calls.push('rpc:start');
            return Promise.resolve({
              stop() {
                calls.push('rpc:stop');
                return Promise.resolve();
              },
              url: 'http://sample.test'
            });
          }
        }
      }
    });

    await module.start();

    expect(calls).toEqual(['events:start', 'startup:database', 'rpc:start', 'background:worker']);

    await module.stop();

    expect(calls).toEqual([
      'events:start',
      'startup:database',
      'rpc:start',
      'background:worker',
      'stop:worker',
      'rpc:stop',
      'stop:database',
      'events:stop'
    ]);
  });

  it('starts only once when a module has no processes', async () => {
    let starts = 0;
    let stops = 0;
    const definition = defineModule('sample', {
      config: readEmptyConfig,
      setup: () => ({
        ping: () => 'pong'
      })
    });
    const module = definition({
      config: {},
      connect: testConnect({
        events: () => ({
          start() {
            starts += 1;
            return Promise.resolve();
          },
          stop() {
            stops += 1;
            return Promise.resolve();
          },
          publish() {
            return;
          },
          subscribe() {
            return {
              unsubscribe() {
                return;
              }
            };
          }
        })
      })
    });

    await module.start();
    await module.start();
    await module.stop();
    await module.stop();

    expect(starts).toBe(1);
    expect(stops).toBe(1);
  });

  it('stops already started startup work when a later startup fails', async () => {
    const calls: string[] = [];
    const definition = defineModule('sample', {
      config: readEmptyConfig,
      setup({ startup }) {
        startup('started', () => {
          calls.push('start:started');
          return () => {
            calls.push('stop:started');
            return undefined;
          };
        });
        startup('failed', () => {
          calls.push('start:failed');
          throw new Error('boom');
        });
        return {};
      }
    });
    const module = definition({ config: {}, connect: testConnect() });

    await expect(module.start()).rejects.toThrow('boom');

    expect(calls).toEqual(['start:started', 'start:failed', 'stop:started']);
  });

  it('passes returned procedures to the rpc factory', async () => {
    const listChats = () => ['chat'];
    let exposedProcedures: Record<string, unknown> | undefined;
    const definition = defineModule('sample', {
      config: readEmptyConfig,
      setup: () => ({
        listChats
      })
    });
    const module = definition({
      config: {},
      connect: {
        events: testEventBus(),
        rpc: {
          start(procedures) {
            exposedProcedures = procedures;
            return Promise.resolve({
              stop() {
                return Promise.resolve();
              },
              url: 'http://sample.test'
            });
          }
        }
      }
    });

    await module.start();
    expect(exposedProcedures).toEqual({ listChats });
    await module.stop();
  });

  it('rejects public RPC procedures without an RPC connector', async () => {
    const definition = defineModule('sample', {
      config: readEmptyConfig,
      setup: () => ({
        listChats: () => ['chat']
      })
    });
    const module = definition({
      config: {},
      connect: {
        events: testEventBus()
      }
    });

    await expect(module.start()).rejects.toThrow(
      'Module sample exposes RPC procedures, but connect.rpc is not configured'
    );
  });

  it('serves module procedures through one JSON endpoint', async () => {
    const definition = defineModule('sample', {
      config: readEmptyConfig,
      setup: () => ({
        echo: (input: { text: string }) => ({ text: input.text })
      })
    });
    const runtime: { server?: ProcedureServer | undefined } = {};
    const module = definition({
      config: {},
      connect: testConnectWithProcedureServer('sample', runtime)
    });

    try {
      await module.start();
      const response = await fetch(`${String(runtime.server?.url)}/rpc`, {
        body: JSON.stringify({
          input: {
            text: 'hello'
          },
          procedure: 'echo'
        }),
        headers: {
          'content-type': 'application/json'
        },
        method: 'POST'
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        ok: true,
        result: {
          text: 'hello'
        }
      });
    } finally {
      await module.stop();
    }
  });

  it('calls module procedures through the framework client', async () => {
    const definition = defineModule('sample', {
      config: readEmptyConfig,
      setup: () => ({
        echo: (input: { text: string }) => ({ text: input.text })
      })
    });
    const runtime: { server?: ProcedureServer | undefined } = {};
    const module = definition({
      config: {},
      connect: testConnectWithProcedureServer('sample', runtime)
    });

    try {
      await module.start();
      await expect(
        callProcedure(
          String(runtime.server?.url),
          'echo',
          {
            text: 'hello'
          },
          { service: 'sample' }
        )
      ).resolves.toEqual({
        text: 'hello'
      });
    } finally {
      await module.stop();
    }
  });

  it('calls another module through a static typed rpc domain client', async () => {
    const profileDefinition = defineModule('profile', {
      config: readEmptyConfig,
      setup: () => ({
        getUser: (input: { id: string }) => ({
          id: input.id,
          name: 'Pavel'
        })
      })
    });
    const runtime: { server?: ProcedureServer | undefined } = {};
    const profile = profileDefinition({
      config: {},
      connect: testConnectWithProcedureServer('profile', runtime)
    });

    try {
      await profile.start();
      const profileClient =
        defineInternalRpcDomain<ProceduresOf<typeof profileDefinition>>('profile');
      const profileApi = profileClient({ url: String(runtime.server?.url) });

      await expect(profileApi.getUser({ id: '42' })).resolves.toEqual({
        id: '42',
        name: 'Pavel'
      });
    } finally {
      await profile.stop();
    }
  });
});

function testEventBus(): EventBusFactory {
  return () => ({
    start() {
      return Promise.resolve();
    },
    stop() {
      return Promise.resolve();
    },
    publish() {
      return;
    },
    subscribe() {
      return {
        unsubscribe() {
          return;
        }
      };
    }
  });
}

function testConnect(overrides: { events?: EventBusFactory | undefined } = {}) {
  return {
    events: overrides.events ?? testEventBus(),
    rpc: httpRpc({ port: 0, service: 'sample' })
  };
}

function testConnectWithProcedureServer(
  service: string,
  runtime: { server?: ProcedureServer | undefined }
) {
  return {
    events: testEventBus(),
    rpc: {
      async start(procedures: Record<string, (...args: never[]) => unknown>) {
        runtime.server = await startProcedureServer(procedures, {
          port: 0,
          service
        });
        return runtime.server;
      }
    }
  };
}

function testConnectWithCalls(calls: string[]) {
  return {
    events: () => ({
      start() {
        calls.push('events:start');
        return Promise.resolve();
      },
      stop() {
        calls.push('events:stop');
        return Promise.resolve();
      },
      publish() {
        return;
      },
      subscribe() {
        return {
          unsubscribe() {
            return;
          }
        };
      }
    }),
    rpc: {
      start() {
        calls.push('rpc:start');
        return Promise.resolve({
          stop() {
            calls.push('rpc:stop');
            return Promise.resolve();
          },
          url: 'http://sample.test'
        });
      }
    }
  };
}
