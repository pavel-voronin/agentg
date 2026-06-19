import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@agentg/framework', () => ({
  incrementTelemetryCounter: vi.fn(),
  setTelemetryGauge: vi.fn(),
  timeTelemetrySpan: vi.fn((_input: unknown, operation: () => Promise<unknown>) => operation())
}));

import { incrementTelemetryCounter, setTelemetryGauge, timeTelemetrySpan } from '@agentg/framework';
import {
  recordDispatch,
  recordOccurrencesCreated,
  recordTriggerStats,
  timeTriggerDispatch,
  timeTriggerRuntime
} from './telemetry.js';

describe('trigger telemetry', () => {
  beforeEach(() => {
    vi.mocked(incrementTelemetryCounter).mockReset();
    vi.mocked(setTelemetryGauge).mockReset();
    vi.mocked(timeTelemetrySpan).mockClear();
  });

  it('records bounded current-state gauges for all occurrence statuses', () => {
    recordTriggerStats({
      dueOccurrenceCount: 2,
      occurrenceStatusCounts: [
        {
          count: 3,
          status: 'scheduled'
        },
        {
          count: 1,
          status: 'accepted'
        }
      ],
      oldestDueOccurrenceAgeSeconds: 42,
      registrationCount: 4
    });

    expect(setTelemetryGauge).toHaveBeenCalledWith('triggers.registrations', 4);
    expect(setTelemetryGauge).toHaveBeenCalledWith('triggers.due_occurrences', 2);
    expect(setTelemetryGauge).toHaveBeenCalledWith('triggers.oldest_due_age', 42);
    expect(setTelemetryGauge).toHaveBeenCalledWith('triggers.occurrences', 3, {
      'trigger.occurrence.status': 'scheduled'
    });
    expect(setTelemetryGauge).toHaveBeenCalledWith('triggers.occurrences', 0, {
      'trigger.occurrence.status': 'failed'
    });

    const calls = JSON.stringify(vi.mocked(setTelemetryGauge).mock.calls);
    expect(calls).not.toContain('registrationKey');
    expect(calls).not.toContain('TriggerRule:daily');
    expect(calls).not.toContain('llm-runner');
  });

  it('records dispatch counters and duration spans with bounded labels', async () => {
    recordOccurrencesCreated(2);
    recordDispatch('accepted');
    await expect(timeTriggerRuntime('run_due', () => Promise.resolve('done'))).resolves.toBe(
      'done'
    );
    await expect(timeTriggerDispatch(() => Promise.resolve('sent'))).resolves.toBe('sent');

    expect(incrementTelemetryCounter).toHaveBeenCalledWith('triggers.occurrences.created', 2);
    expect(incrementTelemetryCounter).toHaveBeenCalledWith('triggers.dispatches', 1, {
      'trigger.dispatch.result': 'accepted'
    });
    expect(timeTelemetrySpan).toHaveBeenCalledWith(
      {
        attributes: {
          'trigger.runtime.operation': 'run_due'
        },
        metric: {
          attributes: {
            'trigger.runtime.operation': 'run_due'
          },
          name: 'triggers.runtime.duration'
        },
        name: 'triggers.run_due'
      },
      expect.any(Function)
    );
    expect(timeTelemetrySpan).toHaveBeenCalledWith(
      {
        metric: {
          name: 'triggers.dispatch.duration'
        },
        name: 'triggers.dispatch'
      },
      expect.any(Function)
    );
  });
});
