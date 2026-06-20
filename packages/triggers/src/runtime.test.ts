import { httpRpc } from '@agentg/framework';
import { describe, expect, it, vi } from 'vitest';

import {
  createRpcDispatcher,
  type DispatchOutcome,
  type Dispatcher
} from './dispatcher/dispatcher.js';
import type { TriggerEventPublisher } from './events.js';
import type { TriggerRegistrationInput } from './registrations/types.js';
import { createTriggerRuntime, startTriggerRuntimeLoop } from './runtime.js';
import { replaceRegistrationsInputSchema } from './schema.js';
import { createMemoryTriggerStore, type TriggerStore } from './store.js';

describe('trigger registration contract', () => {
  it('validates registration inputs and rejects non-procedure names', () => {
    expect(() =>
      replaceRegistrationsInputSchema.parse({
        owner: { key: 'daily-digest', module: 'pipelines' },
        registrations: [registration('hourly')]
      })
    ).not.toThrow();

    expect(() =>
      replaceRegistrationsInputSchema.parse({
        owner: { key: 'daily-digest', module: 'pipelines' },
        registrations: [
          registration('hourly', {}, { module: 'pipelines', procedure: 'run-triggered' })
        ]
      })
    ).toThrow();
  });

  it('uses unambiguous keys when owner keys or names contain separators', async () => {
    const runtime = runtimeWithMemory();

    await runtime.replaceRegistrations(
      {
        owner: { key: 'a:b', module: 'pipelines' },
        registrations: [registration('c')]
      },
      date('2026-06-20T00:00:00.000Z')
    );
    await runtime.replaceRegistrations(
      {
        owner: { key: 'a', module: 'pipelines' },
        registrations: [registration('b:c')]
      },
      date('2026-06-20T00:00:00.000Z')
    );

    const result = await runtime.listTriggerRegistrations();

    expect(result.registrations.map((item) => item.key).sort()).toEqual([
      'pipelines:a%3Ab:c',
      'pipelines:a:b%3Ac'
    ]);
  });

  it('replaces registrations by owner without touching another owner', async () => {
    const runtime = runtimeWithMemory();

    await runtime.replaceRegistrations(
      {
        owner: { key: 'first', module: 'pipelines' },
        registrations: [registration('hourly')]
      },
      date('2026-06-20T00:00:00.000Z')
    );
    await runtime.replaceRegistrations(
      {
        owner: { key: 'second', module: 'pipelines' },
        registrations: [registration('daily')]
      },
      date('2026-06-20T00:00:00.000Z')
    );
    await runtime.replaceRegistrations(
      {
        owner: { key: 'first', module: 'pipelines' },
        registrations: []
      },
      date('2026-06-20T00:01:00.000Z')
    );

    await expect(runtime.listTriggerRegistrations()).resolves.toEqual({
      registrations: [
        {
          action: {
            input: { pipelineName: 'sample', triggerName: 'daily' },
            module: 'pipelines',
            procedure: 'runTriggered'
          },
          anchorAt: '2026-06-20T00:00:00.000Z',
          key: 'pipelines:second:daily',
          name: 'daily',
          owner: { key: 'second', module: 'pipelines' },
          schedule: { everySeconds: 60, kind: 'periodic' }
        }
      ]
    });
  });

  it('preserves anchors, honors explicit startAt changes, and cancels removed future work', async () => {
    const start = date('2026-06-20T00:00:00.000Z');
    const shifted = date('2026-06-20T01:00:00.000Z');
    const runtime = runtimeWithMemory();

    await runtime.replaceRegistrations(
      {
        owner: owner('sample'),
        registrations: [registration('daily', { startAt: start.toISOString() })]
      },
      start
    );
    await runtime.replaceRegistrations(
      {
        owner: owner('sample'),
        registrations: [registration('daily', { everySeconds: 120 })]
      },
      date('2026-06-20T00:00:01.000Z')
    );
    await expect(runtime.listTriggerRegistrations()).resolves.toMatchObject({
      registrations: [{ anchorAt: start.toISOString(), schedule: { everySeconds: 120 } }]
    });

    await runtime.replaceRegistrations(
      {
        owner: owner('sample'),
        registrations: [
          registration('daily', { everySeconds: 120, startAt: shifted.toISOString() })
        ]
      },
      date('2026-06-20T00:00:02.000Z')
    );
    await expect(runtime.listTriggerRegistrations()).resolves.toMatchObject({
      registrations: [{ anchorAt: shifted.toISOString() }]
    });

    await runtime.reconcile(shifted);
    await runtime.replaceRegistrations({ owner: owner('sample'), registrations: [] }, shifted);

    await expect(runtime.listOccurrences()).resolves.toMatchObject({
      occurrences: [{ status: 'cancelled' }]
    });
  });
});

describe('trigger occurrence runtime', () => {
  it('bounds missed periodic occurrences by lookback', async () => {
    const runtime = runtimeWithMemory({ lookbackSeconds: 180 });
    await runtime.replaceRegistrations(
      {
        owner: owner('sample'),
        registrations: [registration('minute', { startAt: '2026-06-20T00:00:00.000Z' })]
      },
      date('2026-06-20T00:00:00.000Z')
    );

    await runtime.reconcile(date('2026-06-20T00:10:00.000Z'));

    await expect(runtime.listOccurrences()).resolves.toMatchObject({
      occurrences: [
        { scheduledAt: '2026-06-20T00:07:00.000Z' },
        { scheduledAt: '2026-06-20T00:08:00.000Z' },
        { scheduledAt: '2026-06-20T00:09:00.000Z' },
        { scheduledAt: '2026-06-20T00:10:00.000Z' }
      ]
    });
  });

  it('dispatches one due occurrence and keeps occurrence idempotency', async () => {
    const calls: string[] = [];
    const runtime = runtimeWithMemory({
      dispatcher: dispatcher(() => {
        calls.push('called');
        return accepted('run_1');
      })
    });
    const now = date('2026-06-20T00:00:00.000Z');
    await runtime.replaceRegistrations(
      {
        owner: owner('sample'),
        registrations: [registration('minute', { startAt: now.toISOString() })]
      },
      now
    );

    await expect(runtime.runDueTriggers(now)).resolves.toEqual({ claimed: 1, dispatched: 1 });
    await expect(runtime.runDueTriggers(now)).resolves.toEqual({ claimed: 0, dispatched: 0 });

    expect(calls).toHaveLength(1);
    await expect(runtime.listOccurrences()).resolves.toMatchObject({
      occurrences: [{ providerRunId: 'run_1', status: 'accepted' }]
    });
  });

  it('keeps stored occurrence action snapshots when registrations change', async () => {
    const calls: unknown[] = [];
    const now = date('2026-06-20T00:00:00.000Z');
    const runtime = runtimeWithMemory({
      dispatcher: dispatcher((occurrence) => {
        calls.push(occurrence.action.input);
        return accepted('run_1');
      })
    });

    await runtime.replaceRegistrations(
      {
        owner: owner('sample'),
        registrations: [
          registration('minute', { startAt: now.toISOString() }, { input: { version: 1 } })
        ]
      },
      now
    );
    await runtime.reconcile(now);
    await runtime.replaceRegistrations(
      {
        owner: owner('sample'),
        registrations: [
          registration('minute', { startAt: now.toISOString() }, { input: { version: 2 } })
        ]
      },
      now
    );
    await runtime.runDueTriggers(now);

    expect(calls).toEqual([{ version: 1 }]);
  });

  it('retries transport failures before accepting the occurrence', async () => {
    const outcomes = [retryableFailure('network'), accepted('run_2')];
    const runtime = runtimeWithMemory({
      dispatcher: dispatcher(() => outcomes.shift() ?? accepted('unexpected')),
      maxDispatchAttempts: 2
    });
    const now = date('2026-06-20T00:00:00.000Z');
    await runtime.replaceRegistrations(
      {
        owner: owner('sample'),
        registrations: [registration('minute', { startAt: now.toISOString() })]
      },
      now
    );

    await runtime.runDueTriggers(now);
    await runtime.runDueTriggers(date('2026-06-20T00:00:01.500Z'));

    await expect(runtime.listOccurrences()).resolves.toMatchObject({
      occurrences: [{ attemptCount: 2, providerRunId: 'run_2', status: 'accepted' }]
    });
  });

  it('fails an occurrence after retry attempts are exhausted', async () => {
    const runtime = runtimeWithMemory({
      dispatcher: dispatcher(() => retryableFailure('network')),
      maxDispatchAttempts: 2
    });
    const now = date('2026-06-20T00:00:00.000Z');
    await runtime.replaceRegistrations(
      {
        owner: owner('sample'),
        registrations: [registration('minute', { startAt: now.toISOString() })]
      },
      now
    );

    await runtime.runDueTriggers(now);
    await runtime.runDueTriggers(date('2026-06-20T00:00:01.500Z'));

    await expect(runtime.listOccurrences()).resolves.toMatchObject({
      occurrences: [
        { attemptCount: 2, failureCode: 'procedure_transport_failed', status: 'failed' }
      ]
    });
  });

  it('records provider rejections as terminal occurrences', async () => {
    const runtime = runtimeWithMemory({
      dispatcher: dispatcher(() => rejected('bad_request', 'payload rejected'))
    });
    const now = date('2026-06-20T00:00:00.000Z');
    await runtime.replaceRegistrations(
      {
        owner: owner('sample'),
        registrations: [registration('minute', { startAt: now.toISOString() })]
      },
      now
    );

    await runtime.runDueTriggers(now);

    await expect(runtime.listOccurrences()).resolves.toMatchObject({
      occurrences: [{ failureCode: 'bad_request', status: 'rejected' }]
    });
  });

  it('fails non-retryable dispatch failures without retrying', async () => {
    const runtime = runtimeWithMemory({
      dispatcher: dispatcher(() =>
        Promise.resolve({
          failure: {
            code: 'unknown_action_module',
            message: 'missing target',
            retryable: false
          },
          status: 'failure'
        })
      )
    });
    const now = date('2026-06-20T00:00:00.000Z');
    await runtime.replaceRegistrations(
      {
        owner: owner('sample'),
        registrations: [registration('minute', { startAt: now.toISOString() })]
      },
      now
    );

    await runtime.runDueTriggers(now);

    await expect(runtime.listOccurrences()).resolves.toMatchObject({
      occurrences: [{ attemptCount: 1, failureCode: 'unknown_action_module', status: 'failed' }]
    });
  });

  it('filters occurrence reads by registration key and status', async () => {
    const now = date('2026-06-20T00:00:00.000Z');
    const runtime = runtimeWithMemory();
    await runtime.replaceRegistrations(
      {
        owner: owner('sample'),
        registrations: [
          registration('daily', { startAt: now.toISOString() }),
          registration('hourly', { startAt: now.toISOString() })
        ]
      },
      now
    );

    await runtime.runDueTriggers(now);

    await expect(
      runtime.listOccurrences({
        registrationKey: 'pipelines:sample:daily',
        status: 'accepted'
      })
    ).resolves.toMatchObject({
      occurrences: [{ registrationKey: 'pipelines:sample:daily', status: 'accepted' }]
    });
  });

  it('reuses stored registration and occurrence state after runtime restart', async () => {
    const now = date('2026-06-20T00:00:00.000Z');
    const store = createMemoryTriggerStore();
    const first = runtimeWithMemory({ store });
    await first.replaceRegistrations(
      {
        owner: owner('sample'),
        registrations: [registration('minute', { startAt: now.toISOString() })]
      },
      now
    );
    await first.reconcile(now);

    const second = runtimeWithMemory({ leaseOwner: 'second', store });
    await second.reconcile(now);

    await expect(second.listTriggerRegistrations()).resolves.toHaveProperty(
      'registrations.length',
      1
    );
    await expect(second.listOccurrences()).resolves.toMatchObject({
      occurrences: [
        { key: 'pipelines:sample:minute:2026-06-20T00:00:00.000Z', status: 'scheduled' }
      ]
    });
  });
});

describe('trigger leases, events, and loop behavior', () => {
  it('uses leases so only one worker dispatches one due occurrence', async () => {
    const now = date('2026-06-20T00:00:00.000Z');
    const store = createMemoryTriggerStore();
    await store.replaceRegistrations({
      now,
      owner: owner('sample'),
      registrations: [registration('minute', { startAt: now.toISOString() })]
    });
    const [stored] = await store.listRegistrations();
    if (stored === undefined) throw new Error('Expected stored registration');
    await store.createOccurrences({
      now,
      registrations: [{ registration: stored, scheduledAt: now }]
    });

    const calls: string[] = [];
    const create = (leaseOwner: string) =>
      runtimeWithMemory({
        dispatcher: dispatcher(() => {
          calls.push(leaseOwner);
          return accepted(`run_${leaseOwner}`);
        }),
        leaseOwner,
        store
      });
    const [left, right] = await Promise.all([
      create('left').runDueTriggers(now),
      create('right').runDueTriggers(now)
    ]);

    expect(left.claimed + right.claimed).toBe(1);
    expect(left.dispatched + right.dispatched).toBe(1);
    expect(calls).toHaveLength(1);
  });

  it('reclaims expired leases for the same stored occurrence', async () => {
    const now = date('2026-06-20T00:00:00.000Z');
    const store = createMemoryTriggerStore();
    await store.replaceRegistrations({
      now,
      owner: owner('sample'),
      registrations: [registration('minute', { startAt: now.toISOString() })]
    });
    const [stored] = await store.listRegistrations();
    if (stored === undefined) throw new Error('Expected stored registration');
    await store.createOccurrences({
      now,
      registrations: [{ registration: stored, scheduledAt: now }]
    });

    await expect(
      store.claimDue({ leaseOwner: 'first', leaseSeconds: 30, limit: 1, now })
    ).resolves.toHaveLength(1);
    await expect(
      store.claimDue({ leaseOwner: 'second', leaseSeconds: 30, limit: 1, now })
    ).resolves.toHaveLength(0);
    await expect(
      store.claimDue({
        leaseOwner: 'second',
        leaseSeconds: 30,
        limit: 1,
        now: date('2026-06-20T00:00:31.000Z')
      })
    ).resolves.toMatchObject([
      {
        key: 'pipelines:sample:minute:2026-06-20T00:00:00.000Z',
        status: 'claimed'
      }
    ]);
  });

  it('reclaims dispatching occurrences after their lease expires', async () => {
    const now = date('2026-06-20T00:00:00.000Z');
    const store = createMemoryTriggerStore();
    await store.replaceRegistrations({
      now,
      owner: owner('sample'),
      registrations: [registration('minute', { startAt: now.toISOString() })]
    });
    const [stored] = await store.listRegistrations();
    if (stored === undefined) throw new Error('Expected stored registration');
    await store.createOccurrences({
      now,
      registrations: [{ registration: stored, scheduledAt: now }]
    });
    const [claimed] = await store.claimDue({
      leaseOwner: 'first',
      leaseSeconds: 30,
      limit: 1,
      now
    });
    if (claimed === undefined) throw new Error('Expected claimed occurrence');
    await store.markDispatching({ key: claimed.key, now });

    await expect(
      store.claimDue({ leaseOwner: 'second', leaseSeconds: 30, limit: 1, now })
    ).resolves.toHaveLength(0);
    await expect(
      store.claimDue({
        leaseOwner: 'second',
        leaseSeconds: 30,
        limit: 1,
        now: date('2026-06-20T00:00:31.000Z')
      })
    ).resolves.toMatchObject([
      {
        attemptCount: 1,
        key: 'pipelines:sample:minute:2026-06-20T00:00:00.000Z',
        status: 'claimed'
      }
    ]);
  });

  it('publishes registration and occurrence events without raw action input', async () => {
    const now = date('2026-06-20T00:00:00.000Z');
    const recorder = eventRecorder();
    const runtime = runtimeWithMemory({ events: recorder });

    await runtime.replaceRegistrations(
      {
        owner: owner('sample'),
        registrations: [
          registration(
            'minute',
            { startAt: now.toISOString() },
            { input: { secret: 'do not emit' } }
          )
        ]
      },
      now
    );
    await runtime.replaceRegistrations(
      {
        owner: owner('sample'),
        registrations: [
          registration(
            'minute',
            { startAt: now.toISOString() },
            { input: { secret: 'do not emit' } }
          )
        ]
      },
      now
    );
    await runtime.runDueTriggers(now);
    await runtime.replaceRegistrations({ owner: owner('sample'), registrations: [] }, now);

    expect(recorder.registrations.map((event) => event.operation)).toEqual(['upserted', 'removed']);
    expect(recorder.occurrences.map((event) => event.status)).toEqual([
      'scheduled',
      'dispatching',
      'accepted'
    ]);
    expect(JSON.stringify(recorder)).not.toContain('do not emit');
    expect(JSON.stringify(recorder)).not.toContain('actionInput');
  });

  it('waits for the active scheduler tick during shutdown', async () => {
    let finish: (() => void) | undefined;
    let stopped = false;
    const stop = startTriggerRuntimeLoop({
      intervalMs: 60_000,
      runtime: {
        runDueTriggers() {
          return new Promise((resolve) => {
            finish = () => resolve({ claimed: 0, dispatched: 0 });
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
});

describe('trigger RPC dispatch', () => {
  it('maps RPC action target failures into terminal or retryable occurrences', async () => {
    const provider = await httpRpc({ port: 0, service: 'action-provider' }).start({
      invalidResult: () => ({ status: 'invalid' }),
      rejectAction: () => ({
        error: { code: 'rejected_by_provider', message: 'rejected' },
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
          targets: { 'action-provider': provider.url }
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
          targets: { 'action-provider': provider.url }
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
          targets: { 'action-provider': provider.url }
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

function runtimeWithMemory(
  input: {
    dispatcher?: Dispatcher | undefined;
    events?: TriggerEventPublisher | undefined;
    leaseOwner?: string | undefined;
    leaseSeconds?: number | undefined;
    lookbackSeconds?: number | undefined;
    maxDispatchAttempts?: number | undefined;
    store?: TriggerStore | undefined;
  } = {}
) {
  return createTriggerRuntime({
    dispatcher: input.dispatcher ?? dispatcher(),
    events: input.events ?? eventRecorder(),
    leaseOwner: input.leaseOwner ?? 'test',
    leaseSeconds: input.leaseSeconds ?? 30,
    lookbackSeconds: input.lookbackSeconds ?? 3600,
    maxDispatchAttempts: input.maxDispatchAttempts ?? 3,
    store: input.store ?? createMemoryTriggerStore()
  });
}

function owner(key: string) {
  return { key, module: 'pipelines' };
}

function registration(
  name: string,
  condition: Partial<TriggerRegistrationInput['condition']> = {},
  action: Partial<TriggerRegistrationInput['action']> = {}
): TriggerRegistrationInput {
  return {
    action: {
      input: { pipelineName: 'sample', triggerName: name },
      module: 'pipelines',
      procedure: 'runTriggered',
      ...action
    },
    condition: {
      everySeconds: 60,
      kind: 'periodic',
      ...condition
    },
    name
  };
}

function dispatcher(dispatch?: Dispatcher['dispatch']): Dispatcher {
  return {
    dispatch:
      dispatch ??
      vi.fn(() =>
        Promise.resolve({
          result: { runId: 'pipeline-run', status: 'accepted' as const },
          status: 'result' as const
        })
      )
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

function accepted(runId: string): Promise<DispatchOutcome> {
  return Promise.resolve({
    result: { runId, status: 'accepted' },
    status: 'result'
  });
}

function rejected(code: string, message: string): Promise<DispatchOutcome> {
  return Promise.resolve({
    result: {
      error: { code, message },
      status: 'rejected'
    },
    status: 'result'
  });
}

function retryableFailure(message: string): Promise<DispatchOutcome> {
  return Promise.resolve({
    failure: {
      code: 'procedure_transport_failed',
      message,
      retryable: true
    },
    status: 'failure'
  });
}

async function runSingleRpcDispatch(input: {
  module: string;
  procedure: string;
  targets: Record<string, string>;
}) {
  const now = date('2026-06-20T00:00:00.000Z');
  const runtime = runtimeWithMemory({
    dispatcher: createRpcDispatcher({ targets: input.targets, timeoutMs: 1000 })
  });
  await runtime.replaceRegistrations(
    {
      owner: owner('sample'),
      registrations: [
        registration(
          'minute',
          { startAt: now.toISOString() },
          {
            module: input.module,
            procedure: input.procedure
          }
        )
      ]
    },
    now
  );

  await runtime.runDueTriggers(now);
  return (await runtime.listOccurrences()).occurrences[0];
}

function date(value: string): Date {
  return new Date(value);
}

function nextTick(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
