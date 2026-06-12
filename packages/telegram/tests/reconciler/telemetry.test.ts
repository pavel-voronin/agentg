import { afterEach, describe, expect, it, vi } from 'vitest';

const telemetry = vi.hoisted(() => ({
  incrementTelemetryCounter: vi.fn(),
  recordTelemetryHistogram: vi.fn(),
  setTelemetryGauge: vi.fn(),
  timeTelemetrySpan: vi.fn(
    async (_input: unknown, operation: () => Promise<unknown>): Promise<unknown> => operation()
  )
}));

vi.mock('@agentg/framework', async (importOriginal) => {
  const framework = await importOriginal<typeof import('@agentg/framework')>();
  return {
    ...framework,
    incrementTelemetryCounter: telemetry.incrementTelemetryCounter,
    recordTelemetryHistogram: telemetry.recordTelemetryHistogram,
    setTelemetryGauge: telemetry.setTelemetryGauge,
    timeTelemetrySpan: telemetry.timeTelemetrySpan
  };
});

import {
  recordGetMessagesRequest,
  recordJobDuration,
  recordStats,
  timeReconcilerSpan
} from '../../src/reconciler/telemetry.js';

describe('Telegram history reconciler telemetry', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('records getMessages demand with bounded labels only', () => {
    recordGetMessagesRequest({
      ownerKind: 'forum_topic',
      result: 'pending_enqueued',
      selectorKind: 'range'
    });

    expect(telemetry.incrementTelemetryCounter).toHaveBeenCalledWith(
      'telegram.get_messages.requests',
      1,
      {
        'owner.kind': 'forum_topic',
        result: 'pending_enqueued',
        'selector.kind': 'range'
      }
    );
    expect(JSON.stringify(telemetry.incrementTelemetryCounter.mock.calls)).not.toContain(
      'requestId'
    );
    expect(JSON.stringify(telemetry.incrementTelemetryCounter.mock.calls)).not.toContain('chatId');
  });

  it('records backlog gauges by status and owner kind', () => {
    recordStats({
      oldestJobAgeSeconds: [
        {
          ownerKind: 'chat',
          status: 'queued',
          value: 42
        }
      ],
      statusCounts: [
        {
          count: 3,
          ownerKind: 'chat',
          status: 'queued'
        }
      ]
    });

    expect(telemetry.setTelemetryGauge).toHaveBeenCalledWith(
      'telegram.history.reconciler.jobs',
      3,
      {
        'job.status': 'queued',
        'owner.kind': 'chat'
      }
    );
    expect(telemetry.setTelemetryGauge).toHaveBeenCalledWith(
      'telegram.history.reconciler.oldest_job_age',
      42,
      {
        'job.status': 'queued',
        'owner.kind': 'chat'
      }
    );
    expect(telemetry.setTelemetryGauge).toHaveBeenCalledWith(
      'telegram.history.reconciler.jobs',
      0,
      {
        'job.status': 'running',
        'owner.kind': 'chat'
      }
    );
    expect(telemetry.setTelemetryGauge).toHaveBeenCalledWith(
      'telegram.history.reconciler.jobs',
      0,
      {
        'job.status': 'queued',
        'owner.kind': 'forum_topic'
      }
    );
    expect(JSON.stringify(telemetry.setTelemetryGauge.mock.calls)).not.toContain('requestId');
    expect(JSON.stringify(telemetry.setTelemetryGauge.mock.calls)).not.toContain('chatId');
  });

  it('records job duration without request or owner keys', () => {
    recordJobDuration({
      ownerKind: 'saved_messages_topic',
      result: 'completed',
      seconds: 1.25
    });

    expect(telemetry.recordTelemetryHistogram).toHaveBeenCalledWith(
      'telegram.history.reconciler.job.duration',
      1.25,
      {
        'owner.kind': 'saved_messages_topic',
        result: 'completed'
      },
      { unit: 's' }
    );
  });

  it('wraps stage spans with stable low-cardinality names', async () => {
    await expect(
      timeReconcilerSpan(
        'telegram.history.reconciler.tdlib_fetch',
        {
          'owner.kind': 'chat',
          stage: 'tdlib_fetch'
        },
        () => Promise.resolve('ok')
      )
    ).resolves.toBe('ok');

    expect(telemetry.timeTelemetrySpan).toHaveBeenCalledWith(
      {
        attributes: {
          'owner.kind': 'chat',
          stage: 'tdlib_fetch'
        },
        name: 'telegram.history.reconciler.tdlib_fetch'
      },
      expect.any(Function)
    );
    expect(telemetry.recordTelemetryHistogram).toHaveBeenCalledWith(
      'telegram.history.reconciler.stage.duration',
      expect.any(Number),
      {
        stage: 'tdlib_fetch'
      },
      { unit: 's' }
    );
    expect(JSON.stringify(telemetry.timeTelemetrySpan.mock.calls)).not.toContain('requestId');
    expect(JSON.stringify(telemetry.recordTelemetryHistogram.mock.calls)).not.toContain(
      'owner.kind'
    );
  });

  it('records failed stage duration with bounded error type', async () => {
    telemetry.timeTelemetrySpan.mockImplementationOnce(() =>
      Promise.reject(new Error('TDLib unavailable'))
    );

    await expect(
      timeReconcilerSpan(
        'telegram.history.reconciler.tdlib_fetch',
        {
          'owner.kind': 'chat',
          stage: 'tdlib_fetch'
        },
        () => Promise.resolve('unreachable')
      )
    ).rejects.toThrow('TDLib unavailable');

    expect(telemetry.recordTelemetryHistogram).toHaveBeenCalledWith(
      'telegram.history.reconciler.stage.duration',
      expect.any(Number),
      {
        'error.type': 'tdlib_error',
        stage: 'tdlib_fetch'
      },
      { unit: 's' }
    );
  });
});
