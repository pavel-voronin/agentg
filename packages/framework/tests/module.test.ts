import { describe, expect, it } from 'vitest';

import {
  callProcedure,
  defineConfig,
  defineModule,
  httpRpc,
  nats,
  registry,
  registryModule,
  number,
  selfRegistry,
  string,
  type EventBusFactory,
  type ProceduresOf,
  type Snapshot
} from '../src/index.js';
import { startProcedureServer } from '../src/rpc/httpRpc.js';

const readEmptyConfig = defineConfig({});

describe('defineModule', () => {
  it('reads config through a schema-created reader', () => {
    const readConfig = defineConfig({
      host: string('HOST').optional(),
      natsUrl: string('NATS_URL'),
      port: number('PORT').default(8701),
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
    expect(Object.keys(module)).toEqual(['procedures', 'start', 'stop']);
  });

  it('keeps resource lifecycle inside resource creation', async () => {
    const calls: string[] = [];
    const definition = defineModule('sample', {
      config: readEmptyConfig,
      setup({ resource }) {
        const database = resource('database', ({ shutdown, startup }) => {
          const database = {
            ready: false
          };

          startup(() => {
            calls.push('start:database');
            database.ready = true;
            return undefined;
          });
          shutdown(() => {
            calls.push('stop:database');
            database.ready = false;
            return undefined;
          });

          return database;
        });

        return {
          procedures: {
            ready: () => database.ready
          }
        };
      }
    });
    const module = definition({ config: {}, connect: testConnect() });

    expect(module.procedures.ready()).toBe(false);
    await module.start();
    expect(module.procedures.ready()).toBe(true);
    await module.stop();

    expect(module.procedures.ready()).toBe(false);
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

  it('starts resource background work after registry registration', async () => {
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
        return {};
      }
    });
    const module = definition({
      config: {},
      connect: testConnectWithCalls(calls)
    });

    await module.start();

    expect(calls).toEqual(['events:start', 'rpc:start', 'registry:connect', 'background:files']);

    await module.stop();

    expect(calls).toEqual([
      'events:start',
      'rpc:start',
      'registry:connect',
      'background:files',
      'stop:files',
      'registry:close',
      'rpc:stop',
      'events:stop'
    ]);
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
        procedures: {
          greeting: () => 'hello'
        }
      })
    });
    const module = definition({ config: {}, connect: testConnect() });

    expect(module.procedures.greeting()).toBe('hello');
  });

  it('extracts procedure types from configured module definitions', () => {
    const readConfig = defineConfig({
      greeting: string('GREETING')
    });
    const definition = defineModule('sample', {
      config: readConfig,
      setup({ config }) {
        return {
          procedures: {
            greeting: (input: { name: string }) => `${config.greeting} ${input.name}`
          }
        };
      }
    });

    const procedure: ProceduresOf<typeof definition>['greeting'] = (input: { name: string }) =>
      `hello ${input.name}`;
    const module = definition({
      config: {
        greeting: 'hello'
      },
      connect: testConnect()
    });

    expect(procedure({ name: 'Pavel' })).toBe('hello Pavel');
    expect(module.procedures.greeting({ name: 'Pavel' })).toBe('hello Pavel');
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

  it('exposes the module only after startup work succeeds', async () => {
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
          procedures: {
            ping: () => 'pong'
          }
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
        registry: {
          connect() {
            calls.push('registry:connect');
            return Promise.resolve({
              close() {
                calls.push('registry:close');
              },
              getSnapshot() {
                return {
                  modules: [],
                  version: 0
                };
              }
            });
          }
        },
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

    expect(calls).toEqual([
      'events:start',
      'startup:database',
      'rpc:start',
      'registry:connect',
      'background:worker'
    ]);

    await module.stop();

    expect(calls).toEqual([
      'events:start',
      'startup:database',
      'rpc:start',
      'registry:connect',
      'background:worker',
      'stop:worker',
      'registry:close',
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
        procedures: {
          ping: () => 'pong'
        }
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

  it('exposes declared procedures', () => {
    const listChats = () => ['chat'];
    const definition = defineModule('sample', {
      config: readEmptyConfig,
      setup: () => ({
        procedures: {
          listChats
        }
      })
    });
    const module = definition({ config: {}, connect: testConnect() });

    expect(module.procedures).toEqual({ listChats });
  });

  it('serves module procedures through one JSON endpoint', async () => {
    const definition = defineModule('sample', {
      config: readEmptyConfig,
      setup: () => ({
        procedures: {
          echo: (input: { text: string }) => ({ text: input.text })
        }
      })
    });
    const module = definition({ config: {}, connect: testConnect() });
    const server = await startProcedureServer(module.procedures, { port: 0 });

    try {
      const response = await fetch(`${server.url}/rpc`, {
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
      await server.stop();
    }
  });

  it('calls module procedures through the framework client', async () => {
    const definition = defineModule('sample', {
      config: readEmptyConfig,
      setup: () => ({
        procedures: {
          echo: (input: { text: string }) => ({ text: input.text })
        }
      })
    });
    const module = definition({ config: {}, connect: testConnect() });
    const server = await startProcedureServer(module.procedures, { port: 0 });

    try {
      await expect(
        callProcedure(server.url, 'echo', {
          text: 'hello'
        })
      ).resolves.toEqual({
        text: 'hello'
      });
    } finally {
      await server.stop();
    }
  });

  it('calls another module through a lazy registry-backed rpc client', async () => {
    const registryApp = registryModule({
      config: {},
      connect: testConnect()
    });
    const registryServer = await startProcedureServer(registryApp.procedures, { port: 0 });
    const profileDefinition = defineModule('profile', {
      config: readEmptyConfig,
      setup: () => ({
        procedures: {
          getUser: (input: { id: string }) => ({
            id: input.id,
            name: 'Pavel'
          })
        }
      })
    });
    const telegramDefinition = defineModule('telegram', {
      config: readEmptyConfig,
      setup({ rpc }) {
        const profile = rpc<ProceduresOf<typeof profileDefinition>>('profile');

        return {
          procedures: {
            describeUser: async (input: { id: string }) => {
              const user = await profile.getUser({
                id: input.id
              });
              return `telegram sees ${user.name}`;
            }
          }
        };
      }
    });
    const profile = profileDefinition({
      config: {},
      connect: testConnect({
        registryUrl: registryServer.url
      })
    });
    const telegram = telegramDefinition({
      config: {},
      connect: testConnect({
        registryUrl: registryServer.url
      })
    });

    try {
      await profile.start();
      await telegram.start();
      const telegramRecord = (
        await callProcedure<Snapshot>(registryServer.url, 'getSnapshot')
      ).modules.find((moduleRecord) => moduleRecord.module === 'telegram');

      expect(telegramRecord).toBeDefined();
      await expect(
        callProcedure(telegramRecord?.rpcUrl ?? '', 'describeUser', {
          id: '42'
        })
      ).resolves.toBe('telegram sees Pavel');
    } finally {
      await telegram.stop();
      await profile.stop();
      await registryServer.stop();
    }
  });

  it('does not discover modules that join the registry after the caller starts', async () => {
    const events = testSharedEventBus();
    const registryApp = registryModule({
      config: {},
      connect: testConnect({
        events
      })
    });
    const registryServer = await startProcedureServer(registryApp.procedures, { port: 0 });
    const profileDefinition = defineModule('profile', {
      config: readEmptyConfig,
      setup: () => ({
        procedures: {
          getUser: (input: { id: string }) => ({
            id: input.id,
            name: 'Pavel'
          })
        }
      })
    });
    const telegramDefinition = defineModule('telegram', {
      config: readEmptyConfig,
      setup({ rpc }) {
        const profile = rpc<ProceduresOf<typeof profileDefinition>>('profile');

        return {
          procedures: {
            describeUser: async (input: { id: string }) => {
              const user = await profile.getUser({
                id: input.id
              });
              return `telegram sees ${user.name}`;
            }
          }
        };
      }
    });
    const telegram = telegramDefinition({
      config: {},
      connect: testConnect({
        events,
        registryUrl: registryServer.url
      })
    });
    const profile = profileDefinition({
      config: {},
      connect: testConnect({
        events,
        registryUrl: registryServer.url
      })
    });

    try {
      await telegram.start();
      const telegramRecord = (
        await callProcedure<Snapshot>(registryServer.url, 'getSnapshot')
      ).modules.find((moduleRecord) => moduleRecord.module === 'telegram');

      expect(telegramRecord).toBeDefined();
      await profile.start();
      await expect(
        callProcedure(telegramRecord?.rpcUrl ?? '', 'describeUser', {
          id: '42'
        })
      ).rejects.toThrow('Module is not registered: profile');
    } finally {
      await profile.stop();
      await telegram.stop();
      await registryServer.stop();
    }
  });

  it('fails lazy rpc calls before the module is connected', async () => {
    type ProfileProcedures = {
      getUser: (input: { id: string }) => { id: string };
    };
    const telegramDefinition = defineModule('telegram', {
      config: readEmptyConfig,
      setup({ rpc }) {
        const profile = rpc<ProfileProcedures>('profile');

        return {
          procedures: {
            getUser: (input: { id: string }) => profile.getUser(input)
          }
        };
      }
    });
    const telegram = telegramDefinition({
      config: {},
      connect: testConnect()
    });

    await expect(
      telegram.procedures.getUser({
        id: '42'
      })
    ).rejects.toThrow('Module RPC is not connected');
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

function testSharedEventBus(): EventBusFactory {
  const subscriptions: {
    handler: Parameters<ReturnType<EventBusFactory>['subscribe']>[1];
    subject: string;
  }[] = [];
  let eventId = 0;

  return () => ({
    start() {
      return Promise.resolve();
    },
    stop() {
      return Promise.resolve();
    },
    publish(type, data) {
      eventId += 1;
      const event = {
        at: new Date().toISOString(),
        data,
        id: String(eventId),
        type
      };

      for (const subscription of subscriptions) {
        if (subscription.subject === type) {
          void subscription.handler(event);
        }
      }
    },
    subscribe(subject, handler) {
      const subscription = {
        handler,
        subject
      };
      subscriptions.push(subscription);

      return {
        unsubscribe() {
          const index = subscriptions.indexOf(subscription);
          if (index !== -1) {
            subscriptions.splice(index, 1);
          }
        }
      };
    }
  });
}

function testConnect(
  overrides: { events?: EventBusFactory | undefined; registryUrl?: string | undefined } = {}
) {
  return {
    events: overrides.events ?? testEventBus(),
    rpc: httpRpc({ port: 0 }),
    registry: overrides.registryUrl === undefined ? selfRegistry() : registry(overrides.registryUrl)
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
    registry: {
      connect() {
        calls.push('registry:connect');
        return Promise.resolve({
          close() {
            calls.push('registry:close');
          },
          getSnapshot() {
            return {
              modules: [],
              version: 0
            };
          }
        });
      }
    },
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
