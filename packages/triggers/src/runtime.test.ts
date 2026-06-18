import { httpRpc } from '@agentg/framework';
import { describe, expect, it } from 'vitest';

import type { TriggerRule } from '../policies/policies.js';
import { triggerRulePolicy, triggerRuleSpec } from '../policies/policies.js';
import { createRpcDispatcher, type Dispatcher } from './dispatcher/dispatcher.js';
import type { TriggerEventPublisher } from './events.js';
import { createTriggerRuntime, startTriggerRuntimeLoop } from './runtime.js';
import { createMemoryTriggerStore } from './store.js';

describe('TriggerRule policy', () => {
  it('validates schedule and action in the policy spec', () => {
    expect(() =>
      triggerRuleSpec.parse({
        action: {
          input: {
            artifactKey: 'daily',
            instructions: 'Summarize unread signals.',
            profile: 'default',
            sourceSelector: {
              domain: 'telegram',
              selector: {
                chatId: '10'
              }
            }
          },
          module: 'llm-runner',
          procedure: 'runTriggered'
        },
        condition: {
          everySeconds: 60,
          kind: 'periodic'
        }
      })
    ).not.toThrow();

    expect(() =>
      triggerRuleSpec.parse({
        action: {
          input: null,
          module: 'llm-runner',
          procedure: 'runTriggered'
        },
        condition: {
          everySeconds: 0,
          kind: 'periodic'
        }
      })
    ).toThrow();

    expect(() =>
      triggerRuleSpec.parse({
        action: {
          module: 'llm-runner',
          procedure: 'runTriggered'
        },
        condition: {
          everySeconds: 60,
          kind: 'periodic'
        }
      })
    ).toThrow();

    expect(() =>
      triggerRuleSpec.parse({
        action: {
          input: {},
          module: 'llm-runner',
          procedure: 'run-triggered'
        },
        condition: {
          everySeconds: 60,
          kind: 'periodic'
        }
      })
    ).toThrow();
  });

  it('resolves policy instances into named trigger rules', () => {
    expect(
      triggerRulePolicy.resolve([
        {
          metadata: {
            labels: {
              area: 'telegram'
            },
            name: 'daily'
          },
          spec: rule('daily').spec
        }
      ])
    ).toEqual([
      {
        labels: {
          area: 'telegram'
        },
        name: 'daily',
        spec: rule('daily').spec
      }
    ]);
  });
});

describe('trigger runtime', () => {
  it('materializes, updates, and removes trigger registrations', async () => {
    const start = new Date('2026-01-01T00:00:00.000Z');
    let rules: readonly TriggerRule[] = [rule('daily', { startAt: start.toISOString() })];
    const runtime = createTriggerRuntime({
      dispatcher: dispatcher(),
      events: eventRecorder(),
      getRules: () => rules,
      leaseOwner: 'test',
      leaseSeconds: 30,
      lookbackSeconds: 3600,
      maxDispatchAttempts: 3,
      store: createMemoryTriggerStore()
    });

    await runtime.reconcile(start);
    await expect(runtime.listTriggerRegistrations()).resolves.toMatchObject({
      registrations: [
        {
          anchorAt: start.toISOString(),
          key: 'TriggerRule:daily',
          rule: {
            kind: 'TriggerRule',
            name: 'daily'
          }
        }
      ]
    });

    rules = [rule('daily', { everySeconds: 120 })];
    await runtime.reconcile(new Date(start.getTime() + 1000));
    await expect(runtime.listTriggerRegistrations()).resolves.toMatchObject({
      registrations: [
        {
          anchorAt: start.toISOString(),
          key: 'TriggerRule:daily',
          schedule: {
            everySeconds: 120
          }
        }
      ]
    });

    const shifted = new Date('2026-01-01T01:00:00.000Z');
    rules = [rule('daily', { everySeconds: 120, startAt: shifted.toISOString() })];
    await runtime.reconcile(new Date(start.getTime() + 2000));
    await expect(runtime.listTriggerRegistrations()).resolves.toMatchObject({
      registrations: [
        {
          anchorAt: shifted.toISOString(),
          key: 'TriggerRule:daily'
        }
      ]
    });

    rules = [];
    await runtime.reconcile(new Date(start.getTime() + 3000));
    await expect(runtime.listTriggerRegistrations()).resolves.toEqual({
      registrations: []
    });
  });

  it('bounds missed periodic occurrences by lookback', async () => {
    const start = new Date('2026-01-01T00:00:00.000Z');
    const now = new Date('2026-01-01T00:10:00.000Z');
    const runtime = createTriggerRuntime({
      dispatcher: dispatcher(),
      events: eventRecorder(),
      getRules: () => [rule('daily', { everySeconds: 60, startAt: start.toISOString() })],
      leaseOwner: 'test',
      leaseSeconds: 30,
      lookbackSeconds: 180,
      maxDispatchAttempts: 3,
      store: createMemoryTriggerStore()
    });

    await runtime.reconcile(now);

    await expect(runtime.listOccurrences()).resolves.toMatchObject({
      occurrences: [
        {
          scheduledAt: '2026-01-01T00:07:00.000Z'
        },
        {
          scheduledAt: '2026-01-01T00:08:00.000Z'
        },
        {
          scheduledAt: '2026-01-01T00:09:00.000Z'
        },
        {
          scheduledAt: '2026-01-01T00:10:00.000Z'
        }
      ]
    });
  });

  it('dispatches one due occurrence and keeps occurrence idempotency', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const calls: unknown[] = [];
    const runtime = createTriggerRuntime({
      dispatcher: dispatcher(() => {
        calls.push('called');
        return Promise.resolve({
          result: {
            runId: 'run_1',
            status: 'accepted'
          },
          status: 'result'
        });
      }),
      events: eventRecorder(),
      getRules: () => [rule('daily', { startAt: now.toISOString() })],
      leaseOwner: 'test',
      leaseSeconds: 30,
      lookbackSeconds: 3600,
      maxDispatchAttempts: 3,
      store: createMemoryTriggerStore()
    });

    await expect(runtime.runDueTriggers(now)).resolves.toEqual({
      claimed: 1,
      dispatched: 1
    });
    await expect(runtime.runDueTriggers(now)).resolves.toEqual({
      claimed: 0,
      dispatched: 0
    });

    expect(calls).toHaveLength(1);
    await expect(runtime.listOccurrences()).resolves.toMatchObject({
      occurrences: [
        {
          providerRunId: 'run_1',
          status: 'accepted'
        }
      ]
    });
  });

  it('cancels future occurrences when a rule is removed', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    let rules: readonly TriggerRule[] = [rule('daily', { startAt: now.toISOString() })];
    const runtime = createTriggerRuntime({
      dispatcher: dispatcher(),
      events: eventRecorder(),
      getRules: () => rules,
      leaseOwner: 'test',
      leaseSeconds: 30,
      lookbackSeconds: 3600,
      maxDispatchAttempts: 3,
      store: createMemoryTriggerStore()
    });

    await runtime.reconcile(now);
    rules = [];
    await runtime.reconcile(now);
    await runtime.reconcile(new Date(now.getTime() + 60_000));

    await expect(runtime.listOccurrences()).resolves.toMatchObject({
      occurrences: [
        {
          status: 'cancelled'
        }
      ]
    });
  });

  it('keeps stored occurrence action snapshots when registrations change', async () => {
    const start = new Date('2026-01-01T00:00:00.000Z');
    const calls: unknown[] = [];
    let rules: readonly TriggerRule[] = [
      rule('daily', { startAt: start.toISOString() }, { input: { version: 1 } })
    ];
    const runtime = createTriggerRuntime({
      dispatcher: dispatcher((occurrence) => {
        calls.push(occurrence.action.input);
        return Promise.resolve({
          result: {
            runId: 'run_1',
            status: 'accepted'
          },
          status: 'result'
        });
      }),
      events: eventRecorder(),
      getRules: () => rules,
      leaseOwner: 'test',
      leaseSeconds: 30,
      lookbackSeconds: 3600,
      maxDispatchAttempts: 3,
      store: createMemoryTriggerStore()
    });

    await runtime.reconcile(start);
    rules = [rule('daily', { startAt: start.toISOString() }, { input: { version: 2 } })];
    await runtime.runDueTriggers(start);

    expect(calls).toEqual([{ version: 1 }]);
  });

  it('retries transport failures before accepting the occurrence', async () => {
    const start = new Date('2026-01-01T00:00:00.000Z');
    const outcomes: Dispatcher['dispatch'][] = [
      () =>
        Promise.resolve({
          failure: {
            code: 'procedure_transport_failed',
            message: 'network',
            retryable: true
          },
          status: 'failure'
        }),
      () =>
        Promise.resolve({
          result: {
            runId: 'run_2',
            status: 'accepted'
          },
          status: 'result'
        })
    ];
    const runtime = createTriggerRuntime({
      dispatcher: dispatcher((occurrence) => {
        const next = outcomes.shift();
        if (next === undefined) {
          throw new Error(`Unexpected occurrence: ${occurrence.key}`);
        }
        return next(occurrence);
      }),
      events: eventRecorder(),
      getRules: () => [rule('daily', { startAt: start.toISOString() })],
      leaseOwner: 'test',
      leaseSeconds: 30,
      lookbackSeconds: 3600,
      maxDispatchAttempts: 2,
      store: createMemoryTriggerStore()
    });

    await expect(runtime.runDueTriggers(start)).resolves.toEqual({
      claimed: 1,
      dispatched: 1
    });
    await expect(runtime.runDueTriggers(new Date(start.getTime() + 1500))).resolves.toEqual({
      claimed: 1,
      dispatched: 1
    });

    await expect(runtime.listOccurrences()).resolves.toMatchObject({
      occurrences: [
        {
          attemptCount: 2,
          providerRunId: 'run_2',
          status: 'accepted'
        }
      ]
    });
  });

  it('fails an occurrence after retry attempts are exhausted', async () => {
    const start = new Date('2026-01-01T00:00:00.000Z');
    const runtime = createTriggerRuntime({
      dispatcher: dispatcher(() =>
        Promise.resolve({
          failure: {
            code: 'procedure_transport_failed',
            message: 'network',
            retryable: true
          },
          status: 'failure'
        })
      ),
      events: eventRecorder(),
      getRules: () => [rule('daily', { startAt: start.toISOString() })],
      leaseOwner: 'test',
      leaseSeconds: 30,
      lookbackSeconds: 3600,
      maxDispatchAttempts: 2,
      store: createMemoryTriggerStore()
    });

    await runtime.runDueTriggers(start);
    await runtime.runDueTriggers(new Date(start.getTime() + 1500));

    await expect(runtime.listOccurrences()).resolves.toMatchObject({
      occurrences: [
        {
          attemptCount: 2,
          failureCode: 'procedure_transport_failed',
          status: 'failed'
        }
      ]
    });
  });

  it('records provider rejections as terminal occurrences', async () => {
    const start = new Date('2026-01-01T00:00:00.000Z');
    const runtime = createTriggerRuntime({
      dispatcher: dispatcher(() =>
        Promise.resolve({
          result: {
            error: {
              code: 'bad_request',
              message: 'payload rejected'
            },
            status: 'rejected'
          },
          status: 'result'
        })
      ),
      events: eventRecorder(),
      getRules: () => [rule('daily', { startAt: start.toISOString() })],
      leaseOwner: 'test',
      leaseSeconds: 30,
      lookbackSeconds: 3600,
      maxDispatchAttempts: 3,
      store: createMemoryTriggerStore()
    });

    await runtime.runDueTriggers(start);

    await expect(runtime.listOccurrences()).resolves.toMatchObject({
      occurrences: [
        {
          failureCode: 'bad_request',
          status: 'rejected'
        }
      ]
    });
  });

  it('fails non-retryable dispatch failures without retrying', async () => {
    const start = new Date('2026-01-01T00:00:00.000Z');
    const runtime = createTriggerRuntime({
      dispatcher: dispatcher(() =>
        Promise.resolve({
          failure: {
            code: 'unknown_action_module',
            message: 'missing target',
            retryable: false
          },
          status: 'failure'
        })
      ),
      events: eventRecorder(),
      getRules: () => [rule('daily', { startAt: start.toISOString() })],
      leaseOwner: 'test',
      leaseSeconds: 30,
      lookbackSeconds: 3600,
      maxDispatchAttempts: 3,
      store: createMemoryTriggerStore()
    });

    await runtime.runDueTriggers(start);

    await expect(runtime.listOccurrences()).resolves.toMatchObject({
      occurrences: [
        {
          attemptCount: 1,
          failureCode: 'unknown_action_module',
          status: 'failed'
        }
      ]
    });
  });

  it('uses leases so only one worker dispatches one due occurrence', async () => {
    const start = new Date('2026-01-01T00:00:00.000Z');
    const store = createMemoryTriggerStore();
    const calls: string[] = [];
    const create = (leaseOwner: string) =>
      createTriggerRuntime({
        dispatcher: dispatcher(() => {
          calls.push(leaseOwner);
          return Promise.resolve({
            result: {
              runId: `run_${leaseOwner}`,
              status: 'accepted'
            },
            status: 'result'
          });
        }),
        events: eventRecorder(),
        getRules: () => [rule('daily', { startAt: start.toISOString() })],
        leaseOwner,
        leaseSeconds: 30,
        lookbackSeconds: 3600,
        maxDispatchAttempts: 3,
        store
      });

    const [left, right] = await Promise.all([
      create('left').runDueTriggers(start),
      create('right').runDueTriggers(start)
    ]);

    expect(left.claimed + right.claimed).toBe(1);
    expect(left.dispatched + right.dispatched).toBe(1);
    expect(calls).toHaveLength(1);
  });

  it('reclaims expired leases for the same stored occurrence', async () => {
    const start = new Date('2026-01-01T00:00:00.000Z');
    const store = createMemoryTriggerStore();
    await store.replaceRegistrations({
      now: start,
      rules: [rule('daily', { startAt: start.toISOString() })]
    });
    const [registration] = await store.listRegistrations();
    if (registration === undefined) {
      throw new Error('Expected trigger registration');
    }
    await store.createOccurrences({
      now: start,
      registrations: [
        {
          registration,
          scheduledAt: start
        }
      ]
    });

    await expect(
      store.claimDue({
        leaseOwner: 'first',
        leaseSeconds: 30,
        limit: 1,
        now: start
      })
    ).resolves.toHaveLength(1);
    await expect(
      store.claimDue({
        leaseOwner: 'second',
        leaseSeconds: 30,
        limit: 1,
        now: start
      })
    ).resolves.toHaveLength(0);
    await expect(
      store.claimDue({
        leaseOwner: 'second',
        leaseSeconds: 30,
        limit: 1,
        now: new Date(start.getTime() + 31_000)
      })
    ).resolves.toMatchObject([
      {
        key: 'TriggerRule:daily:2026-01-01T00:00:00.000Z',
        status: 'claimed'
      }
    ]);
  });

  it('publishes registration and occurrence events without raw action input', async () => {
    const start = new Date('2026-01-01T00:00:00.000Z');
    const events = eventRecorder();
    const runtime = createTriggerRuntime({
      dispatcher: dispatcher(),
      events,
      getRules: () => [rule('daily', { startAt: start.toISOString() })],
      leaseOwner: 'test',
      leaseSeconds: 30,
      lookbackSeconds: 3600,
      maxDispatchAttempts: 3,
      store: createMemoryTriggerStore()
    });

    await runtime.runDueTriggers(start);

    expect(events.registrations).toHaveLength(1);
    expect(events.occurrences.map((event) => event.status)).toEqual([
      'scheduled',
      'dispatching',
      'accepted'
    ]);
    expect(JSON.stringify(events)).not.toContain('Summarize unread signals');
    expect(JSON.stringify(events)).not.toContain('sourceSelector');
  });

  it('filters occurrence reads by registration key and status', async () => {
    const start = new Date('2026-01-01T00:00:00.000Z');
    const runtime = createTriggerRuntime({
      dispatcher: dispatcher(),
      events: eventRecorder(),
      getRules: () => [
        rule('daily', { startAt: start.toISOString() }),
        rule('hourly', { startAt: start.toISOString() })
      ],
      leaseOwner: 'test',
      leaseSeconds: 30,
      lookbackSeconds: 3600,
      maxDispatchAttempts: 3,
      store: createMemoryTriggerStore()
    });

    await runtime.runDueTriggers(start);

    await expect(
      runtime.listOccurrences({
        registrationKey: 'TriggerRule:daily',
        status: 'accepted'
      })
    ).resolves.toMatchObject({
      occurrences: [
        {
          registrationKey: 'TriggerRule:daily',
          status: 'accepted'
        }
      ]
    });
  });

  it('reuses stored registration and occurrence state after runtime restart', async () => {
    const start = new Date('2026-01-01T00:00:00.000Z');
    const store = createMemoryTriggerStore();
    const rules = [rule('daily', { startAt: start.toISOString() })];
    const first = createTriggerRuntime({
      dispatcher: dispatcher(),
      events: eventRecorder(),
      getRules: () => rules,
      leaseOwner: 'first',
      leaseSeconds: 30,
      lookbackSeconds: 3600,
      maxDispatchAttempts: 3,
      store
    });

    await first.reconcile(start);

    const second = createTriggerRuntime({
      dispatcher: dispatcher(),
      events: eventRecorder(),
      getRules: () => rules,
      leaseOwner: 'second',
      leaseSeconds: 30,
      lookbackSeconds: 3600,
      maxDispatchAttempts: 3,
      store
    });
    await second.reconcile(start);

    await expect(second.listTriggerRegistrations()).resolves.toHaveProperty(
      'registrations.length',
      1
    );
    await expect(second.listOccurrences()).resolves.toMatchObject({
      occurrences: [
        {
          key: 'TriggerRule:daily:2026-01-01T00:00:00.000Z',
          status: 'scheduled'
        }
      ]
    });
  });

  it('waits for the active scheduler tick during shutdown', async () => {
    let finish: (() => void) | undefined;
    let stopped = false;
    const stop = startTriggerRuntimeLoop({
      intervalMs: 60_000,
      runtime: {
        runDueTriggers() {
          return new Promise((resolve) => {
            finish = () => {
              resolve({
                claimed: 0,
                dispatched: 0
              });
            };
          });
        }
      }
    });

    const stopPromise = stop().then(() => {
      stopped = true;
    });
    await nextTick();
    expect(stopped).toBe(false);

    finish?.();
    await stopPromise;
    expect(stopped).toBe(true);
  });

  it('maps RPC action target failures into terminal or retryable occurrences', async () => {
    const provider = await httpRpc({
      port: 0,
      service: 'action-provider'
    }).start({
      invalidResult: () => ({
        status: 'invalid'
      }),
      rejectAction: () => ({
        error: {
          code: 'rejected_by_provider',
          message: 'rejected'
        },
        status: 'rejected'
      })
    });

    try {
      await expect(
        runSingleRpcDispatch({
          module: 'missing-provider',
          procedure: 'runTriggered',
          targets: {}
        })
      ).resolves.toMatchObject({
        failureCode: 'unknown_action_module',
        status: 'failed'
      });
      await expect(
        runSingleRpcDispatch({
          module: 'action-provider',
          procedure: 'missingProcedure',
          targets: {
            'action-provider': provider.url
          }
        })
      ).resolves.toMatchObject({
        attemptCount: 1,
        failureCode: 'unknown_action_procedure',
        status: 'failed'
      });
      await expect(
        runSingleRpcDispatch({
          module: 'action-provider',
          procedure: 'invalidResult',
          targets: {
            'action-provider': provider.url
          }
        })
      ).resolves.toMatchObject({
        attemptCount: 1,
        failureCode: 'procedure_result_invalid',
        status: 'failed'
      });
      await expect(
        runSingleRpcDispatch({
          module: 'action-provider',
          procedure: 'rejectAction',
          targets: {
            'action-provider': provider.url
          }
        })
      ).resolves.toMatchObject({
        failureCode: 'rejected_by_provider',
        status: 'rejected'
      });
    } finally {
      await provider.stop();
    }
  });
});

function rule(
  name: string,
  condition: Partial<TriggerRule['spec']['condition']> = {},
  action: Partial<TriggerRule['spec']['action']> = {}
): TriggerRule {
  return {
    name,
    spec: {
      action: {
        input: {
          artifactKey: 'daily',
          instructions: 'Summarize unread signals.',
          profile: 'default',
          sourceSelector: {
            domain: 'telegram',
            selector: {
              chatId: '10'
            }
          }
        },
        module: 'llm-runner',
        procedure: 'runTriggered',
        ...action
      },
      condition: {
        everySeconds: 60,
        kind: 'periodic',
        ...condition
      }
    }
  };
}

function dispatcher(dispatch?: Dispatcher['dispatch']): Dispatcher {
  return {
    dispatch:
      dispatch ??
      (() =>
        Promise.resolve({
          result: {
            runId: 'run_default',
            status: 'accepted'
          },
          status: 'result'
        }))
  };
}

function eventRecorder(): TriggerEventPublisher & {
  occurrences: Parameters<TriggerEventPublisher['occurrence']>[0][];
  registrations: Parameters<TriggerEventPublisher['registration']>[0][];
} {
  const occurrences: Parameters<TriggerEventPublisher['occurrence']>[0][] = [];
  const registrations: Parameters<TriggerEventPublisher['registration']>[0][] = [];
  return {
    occurrence: (event) => {
      occurrences.push(event);
    },
    occurrences,
    registration: (event) => {
      registrations.push(event);
    },
    registrations
  };
}

async function runSingleRpcDispatch(input: {
  module: string;
  procedure: string;
  targets: Record<string, string>;
}) {
  const start = new Date('2026-01-01T00:00:00.000Z');
  const runtime = createTriggerRuntime({
    dispatcher: createRpcDispatcher({
      targets: input.targets,
      timeoutMs: 1000
    }),
    events: eventRecorder(),
    getRules: () => [
      rule(
        'daily',
        {
          startAt: start.toISOString()
        },
        {
          module: input.module,
          procedure: input.procedure
        }
      )
    ],
    leaseOwner: 'test',
    leaseSeconds: 30,
    lookbackSeconds: 3600,
    maxDispatchAttempts: 3,
    store: createMemoryTriggerStore()
  });

  await runtime.runDueTriggers(start);
  return (await runtime.listOccurrences()).occurrences[0];
}

function nextTick(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
