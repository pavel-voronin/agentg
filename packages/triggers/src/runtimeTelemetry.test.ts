import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./telemetry.js', () => ({
  recordDispatch: vi.fn(),
  recordOccurrencesCreated: vi.fn(),
  recordTriggerStats: vi.fn(),
  timeTriggerDispatch: vi.fn((_operation: () => Promise<unknown>) => _operation()),
  timeTriggerRuntime: vi.fn((_operation: string, work: () => Promise<unknown>) => work())
}));

import type { TriggerRule } from '../policies/policies.js';
import type { Dispatcher } from './dispatcher/dispatcher.js';
import type { TriggerEventPublisher } from './events.js';
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
    const now = new Date('2026-01-01T00:00:00.000Z');
    const runtime = createTriggerRuntime({
      dispatcher: dispatcher(),
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

    expect(telemetry.timeTriggerRuntime).toHaveBeenCalledWith('run_due', expect.any(Function));
    expect(telemetry.timeTriggerDispatch).toHaveBeenCalledWith(expect.any(Function));
    expect(telemetry.recordOccurrencesCreated).toHaveBeenCalledWith(1);
    expect(telemetry.recordDispatch).toHaveBeenCalledWith('accepted');
    expect(telemetry.recordTriggerStats).toHaveBeenLastCalledWith({
      dueOccurrenceCount: 0,
      occurrenceStatusCounts: [
        {
          count: 1,
          status: 'accepted'
        }
      ],
      oldestDueOccurrenceAgeSeconds: 0,
      registrationCount: 1
    });

    const calls = JSON.stringify(vi.mocked(telemetry.recordTriggerStats).mock.calls);
    expect(calls).not.toContain('TriggerRule:daily');
    expect(calls).not.toContain('run_1');
  });
});

function rule(
  name: string,
  condition: Partial<TriggerRule['spec']['condition']> = {}
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
        procedure: 'runTriggered'
      },
      condition: {
        everySeconds: 60,
        kind: 'periodic',
        ...condition
      }
    }
  };
}

function dispatcher(): Dispatcher {
  return {
    dispatch: () =>
      Promise.resolve({
        result: {
          runId: 'run_1',
          status: 'accepted'
        },
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
