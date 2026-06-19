import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@agentg/framework', () => ({
  incrementTelemetryCounter: vi.fn(),
  setTelemetryGauge: vi.fn(),
  timeTelemetrySpan: vi.fn((_input: unknown, operation: () => Promise<unknown>) => operation())
}));

import { incrementTelemetryCounter, setTelemetryGauge, timeTelemetrySpan } from '@agentg/framework';
import {
  recordArtifactsUpdated,
  recordRunRequest,
  recordStats,
  timeRun,
  timeStage,
  timeWorker
} from './telemetry.js';

describe('LLM runner telemetry', () => {
  beforeEach(() => {
    vi.mocked(incrementTelemetryCounter).mockReset();
    vi.mocked(setTelemetryGauge).mockReset();
    vi.mocked(timeTelemetrySpan).mockClear();
  });

  it('records bounded current-state gauges for all run statuses', () => {
    recordStats({
      artifactCount: 5,
      oldestProcessableRunAgeSeconds: 60,
      processableRunCount: 2,
      runStatusCounts: [
        {
          count: 2,
          status: 'accepted'
        },
        {
          count: 1,
          status: 'failed'
        }
      ]
    });

    expect(setTelemetryGauge).toHaveBeenCalledWith('llm_runner.processable_runs', 2);
    expect(setTelemetryGauge).toHaveBeenCalledWith('llm_runner.oldest_processable_age', 60);
    expect(setTelemetryGauge).toHaveBeenCalledWith('llm_runner.artifacts', 5);
    expect(setTelemetryGauge).toHaveBeenCalledWith('llm_runner.runs', 2, {
      'llm.run.status': 'accepted'
    });
    expect(setTelemetryGauge).toHaveBeenCalledWith('llm_runner.runs', 0, {
      'llm.run.status': 'processing'
    });

    const calls = JSON.stringify(vi.mocked(setTelemetryGauge).mock.calls);
    expect(calls).not.toContain('run_');
    expect(calls).not.toContain('profile');
    expect(calls).not.toContain('telegram.message');
  });

  it('records run request, artifact, worker, run, and stage telemetry', async () => {
    recordRunRequest({
      source: 'triggered',
      status: 'created'
    });
    recordArtifactsUpdated(3);
    await expect(timeWorker('process_queued', () => Promise.resolve('worker'))).resolves.toBe(
      'worker'
    );
    await expect(timeRun(() => Promise.resolve('run'))).resolves.toBe('run');
    await expect(timeStage('profile_processing', () => Promise.resolve('stage'))).resolves.toBe(
      'stage'
    );

    expect(incrementTelemetryCounter).toHaveBeenCalledWith('llm_runner.run_requests', 1, {
      'llm.run.request_source': 'triggered',
      'llm.run.request_status': 'created'
    });
    expect(incrementTelemetryCounter).toHaveBeenCalledWith('llm_runner.artifacts.updated', 3);
    expect(timeTelemetrySpan).toHaveBeenCalledWith(
      {
        attributes: {
          'llm.runner.operation': 'process_queued'
        },
        metric: {
          attributes: {
            'llm.runner.operation': 'process_queued'
          },
          name: 'llm_runner.worker.duration'
        },
        name: 'llm_runner.process_queued'
      },
      expect.any(Function)
    );
    expect(timeTelemetrySpan).toHaveBeenCalledWith(
      {
        metric: {
          name: 'llm_runner.run.duration'
        },
        name: 'llm_runner.process_run'
      },
      expect.any(Function)
    );
    expect(timeTelemetrySpan).toHaveBeenCalledWith(
      {
        attributes: {
          'llm.runner.stage': 'profile_processing'
        },
        metric: {
          attributes: {
            'llm.runner.stage': 'profile_processing'
          },
          name: 'llm_runner.stage.duration'
        },
        name: 'llm_runner.profile_processing'
      },
      expect.any(Function)
    );
  });
});
