import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./telemetry.js', () => ({
  recordDispatch: vi.fn(),
  recordOccurrencesCreated: vi.fn(),
  recordTriggerStats: vi.fn(),
  timeTriggerDispatch: vi.fn((operation: () => Promise<unknown>) => operation()),
  timeTriggerRuntime: vi.fn((_operation: string, work: () => Promise<unknown>) => work())
}));

import type { Dispatcher } from './dispatcher/dispatcher.js';
import type { TriggerEventPublisher } from './events.js';
import type { TriggerRegistrationInput } from './registrations/types.js';
import { createTriggerRuntime } from './runtime.js';
import { createMemoryTriggerStore } from './store.js';
import * as telemetry from './telemetry.js';

describe('trigger runtime telemetry', () => {
  beforeEach(() => {
    vi.mocked(telemetry.recordDispatch).mockReset();
    vi.mocked(telemetry.recordOccurrencesCreated).mockReset();
    vi.mocked(telemetry.recordTriggerStats).mockReset();
    vi.mocked(telemetry.timeTriggerDispatch).mockClear();
    vi.mocked(telemetry.timeTriggerRuntime).mockClear();
  });

  it('records runtime, queue, and dispatch telemetry from a real store tick', async () => {
    const now = new Date('2026-06-20T00:00:00.000Z');
    const runtime = createTriggerRuntime({
      dispatcher: dispatcher(),
      events: eventRecorder(),
      leaseOwner: 'test',
      leaseSeconds: 30,
      lookbackSeconds: 3600,
      maxDispatchAttempts: 3,
      store: createMemoryTriggerStore()
    });
    await runtime.replaceRegistrations(
      {
        owner: { key: 'sample', module: 'pipelines' },
        registrations: [registration('minute', { startAt: now.toISOString() })]
      },
      now
    );

    await expect(runtime.runDueTriggers(now)).resolves.toEqual({
      claimed: 1,
      dispatched: 1
    });

    expect(telemetry.timeTriggerRuntime).toHaveBeenCalledWith('run_due', expect.any(Function));
    expect(telemetry.timeTriggerDispatch).toHaveBeenCalledWith(expect.any(Function));
    expect(telemetry.recordOccurrencesCreated).toHaveBeenCalledWith(1);
    expect(telemetry.recordDispatch).toHaveBeenCalledWith('accepted');
    expect(telemetry.recordTriggerStats).toHaveBeenLastCalledWith({
      dueOccurrenceCount: 0,
      occurrenceStatusCounts: [{ count: 1, status: 'accepted' }],
      oldestDueOccurrenceAgeSeconds: 0,
      registrationCount: 1
    });

    const calls = JSON.stringify(vi.mocked(telemetry.recordTriggerStats).mock.calls);
    expect(calls).not.toContain('pipelines:sample:minute');
    expect(calls).not.toContain('pipeline-run');
  });
});

function registration(
  name: string,
  condition: Partial<TriggerRegistrationInput['condition']> = {}
): TriggerRegistrationInput {
  return {
    action: {
      input: { pipelineName: 'sample', triggerName: name },
      module: 'pipelines',
      procedure: 'runTriggered'
    },
    condition: {
      everySeconds: 60,
      kind: 'periodic',
      ...condition
    },
    name
  };
}

function dispatcher(): Dispatcher {
  return {
    dispatch: () =>
      Promise.resolve({
        result: { runId: 'pipeline-run', status: 'accepted' },
        status: 'result'
      })
  };
}

function eventRecorder(): TriggerEventPublisher {
  return {
    occurrence: () => undefined,
    registration: () => undefined
  };
}
