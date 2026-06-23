import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@agentg/framework', () => ({
  incrementTelemetryCounter: vi.fn(),
  recordTelemetryHistogram: vi.fn(),
  setTelemetryGauge: vi.fn(),
  telemetryEnabled: vi.fn(() => true)
}));

import {
  incrementTelemetryCounter,
  recordTelemetryHistogram,
  setTelemetryGauge,
  telemetryEnabled
} from '@agentg/framework';
import {
  recordCurrentStats,
  recordRowsProcessed,
  recordRunDuration,
  recordRunStarted,
  recordStats,
  timeProviderCall
} from './telemetry.js';

describe('LLM runner telemetry', () => {
  beforeEach(() => {
    vi.mocked(incrementTelemetryCounter).mockReset();
    vi.mocked(recordTelemetryHistogram).mockReset();
    vi.mocked(setTelemetryGauge).mockReset();
    vi.mocked(telemetryEnabled).mockReset();
    vi.mocked(telemetryEnabled).mockReturnValue(true);
  });

  it('records current run gauges for every status', () => {
    recordStats({
      runStatusCounts: [
        { count: 2, status: 'processing' },
        { count: 1, status: 'failed' }
      ]
    });

    expect(setTelemetryGauge).toHaveBeenCalledWith('llm_runner.runs', 2, {
      'llm.run.status': 'processing'
    });
    expect(setTelemetryGauge).toHaveBeenCalledWith('llm_runner.runs', 0, {
      'llm.run.status': 'accepted'
    });
    expect(setTelemetryGauge).toHaveBeenCalledWith('llm_runner.runs', 0, {
      'llm.run.status': 'cancelled'
    });

    const calls = JSON.stringify(vi.mocked(setTelemetryGauge).mock.calls);
    expect(calls).not.toContain('run_');
    expect(calls).not.toContain('pipelineRunId');
    expect(calls).not.toContain('prompt');
  });

  it('records run and row counters with profile as the only dynamic business label', () => {
    recordRunStarted('openrouterCheapSummary');
    recordRowsProcessed('openrouterCheapSummary', 'completed', 3);

    expect(incrementTelemetryCounter).toHaveBeenCalledWith('llm_runner.runs.started', 1, {
      'llm.profile': 'openrouterCheapSummary'
    });
    expect(incrementTelemetryCounter).toHaveBeenCalledWith('llm_runner.rows.processed', 3, {
      'llm.profile': 'openrouterCheapSummary',
      'llm.run.result': 'completed'
    });
  });

  it('records provider and run duration with bounded result labels', async () => {
    await expect(
      timeProviderCall('openrouterCheapSummary', 'json', () =>
        Promise.resolve({ text: '{"ok":true}' })
      )
    ).resolves.toEqual({ text: '{"ok":true}' });
    recordRunDuration('openrouterCheapSummary', 'completed', 0);

    expect(recordTelemetryHistogram).toHaveBeenCalledWith(
      'llm_runner.provider.duration',
      expect.any(Number),
      {
        'llm.output.format': 'json',
        'llm.profile': 'openrouterCheapSummary',
        'llm.provider.result': 'completed'
      },
      {
        description: 'LLM provider call duration by profile, output format, and result.',
        unit: 's'
      }
    );
    expect(recordTelemetryHistogram).toHaveBeenCalledWith(
      'llm_runner.run.duration',
      expect.any(Number),
      {
        'llm.profile': 'openrouterCheapSummary',
        'llm.run.result': 'completed'
      },
      {
        description: 'LLM action run processing duration by profile and terminal result.',
        unit: 's'
      }
    );
  });

  it('does not read storage stats when telemetry is disabled', async () => {
    vi.mocked(telemetryEnabled).mockReturnValue(false);
    const read = vi.fn(() =>
      Promise.resolve({
        runStatusCounts: []
      })
    );

    await recordCurrentStats(read);

    expect(read).not.toHaveBeenCalled();
  });
});
