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
  recordNodeDispatched,
  recordRunStarted,
  recordStats,
  timeNode
} from './telemetry.js';

describe('pipeline telemetry', () => {
  beforeEach(() => {
    vi.mocked(incrementTelemetryCounter).mockReset();
    vi.mocked(recordTelemetryHistogram).mockReset();
    vi.mocked(setTelemetryGauge).mockReset();
    vi.mocked(telemetryEnabled).mockReset();
    vi.mocked(telemetryEnabled).mockReturnValue(true);
  });

  it('records current-state gauges for all run and node statuses', () => {
    recordStats({
      definitionCount: 2,
      nodeStatusCounts: [
        { count: 3, status: 'running' },
        { count: 1, status: 'waiting' }
      ],
      runStatusCounts: [
        { count: 4, status: 'completed' },
        { count: 1, status: 'failed' }
      ]
    });

    expect(setTelemetryGauge).toHaveBeenCalledWith('pipelines.definitions', 2);
    expect(setTelemetryGauge).toHaveBeenCalledWith('pipelines.runs', 4, {
      'pipeline.run.status': 'completed'
    });
    expect(setTelemetryGauge).toHaveBeenCalledWith('pipelines.runs', 0, {
      'pipeline.run.status': 'accepted'
    });
    expect(setTelemetryGauge).toHaveBeenCalledWith('pipelines.nodes', 3, {
      'pipeline.node.status': 'running'
    });
    expect(setTelemetryGauge).toHaveBeenCalledWith('pipelines.nodes', 0, {
      'pipeline.node.status': 'skipped'
    });

    const calls = JSON.stringify(vi.mocked(setTelemetryGauge).mock.calls);
    expect(calls).not.toContain('run_');
    expect(calls).not.toContain('nodeId');
    expect(calls).not.toContain('pipelineName');
  });

  it('records run starts, dispatches, and node duration with bounded labels', async () => {
    recordRunStarted('triggered');
    recordNodeDispatched('llm.run', 'accepted');
    await expect(
      timeNode('data.render', () =>
        Promise.resolve({
          dataset: {
            rows: []
          },
          status: 'ready' as const
        })
      )
    ).resolves.toEqual({
      dataset: {
        rows: []
      },
      status: 'ready'
    });

    expect(incrementTelemetryCounter).toHaveBeenCalledWith('pipelines.runs.started', 1, {
      'pipeline.run.source': 'triggered'
    });
    expect(incrementTelemetryCounter).toHaveBeenCalledWith('pipelines.node.dispatches', 1, {
      'pipeline.node.action': 'llm.run',
      'pipeline.node.result': 'accepted'
    });
    expect(recordTelemetryHistogram).toHaveBeenCalledWith(
      'pipelines.node.duration',
      expect.any(Number),
      {
        'pipeline.node.action': 'data.render',
        'pipeline.node.result': 'ready'
      },
      {
        description: 'Pipeline node dispatch duration by action and bounded result.',
        unit: 's'
      }
    );
  });

  it('does not read storage stats when telemetry is disabled', async () => {
    vi.mocked(telemetryEnabled).mockReturnValue(false);
    const read = vi.fn(() =>
      Promise.resolve({
        definitionCount: 0,
        nodeStatusCounts: [],
        runStatusCounts: []
      })
    );

    await recordCurrentStats(read);

    expect(read).not.toHaveBeenCalled();
  });
});
