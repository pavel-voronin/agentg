import { performance } from 'node:perf_hooks';

import {
  incrementTelemetryCounter,
  recordTelemetryHistogram,
  setTelemetryGauge,
  telemetryEnabled,
  type TelemetryAttributes
} from '@agentg/framework';

import { nodeStatuses, runStatuses, type NodeStatus, type RunStatus } from './database/schema.js';
import type { ProviderResult } from './schema.js';
import type { Stats } from './store.js';

type RunSource = 'manual' | 'triggered';
type NodeResult = 'accepted' | 'failed' | 'ready' | 'rejected';

const METRIC_DEFINITIONS = 'pipelines.definitions';
const METRIC_NODES = 'pipelines.nodes';
const METRIC_NODE_DISPATCHES = 'pipelines.node.dispatches';
const METRIC_NODE_DURATION = 'pipelines.node.duration';
const METRIC_RUNS = 'pipelines.runs';
const METRIC_RUNS_STARTED = 'pipelines.runs.started';

export function recordRunStarted(source: RunSource): void {
  incrementTelemetryCounter(METRIC_RUNS_STARTED, 1, {
    'pipeline.run.source': source
  });
}

export function recordNodeDispatched(actionId: string, result: NodeResult): void {
  incrementTelemetryCounter(METRIC_NODE_DISPATCHES, 1, {
    'pipeline.node.action': actionId,
    'pipeline.node.result': result
  });
}

export function recordStats(stats: Stats): void {
  setTelemetryGauge(METRIC_DEFINITIONS, stats.definitionCount);

  const runCounts = new Map(stats.runStatusCounts.map((row) => [row.status, row.count]));
  for (const status of runStatuses) {
    setTelemetryGauge(METRIC_RUNS, runCounts.get(status) ?? 0, {
      'pipeline.run.status': status
    });
  }

  const nodeCounts = new Map(stats.nodeStatusCounts.map((row) => [row.status, row.count]));
  for (const status of nodeStatuses) {
    setTelemetryGauge(METRIC_NODES, nodeCounts.get(status) ?? 0, {
      'pipeline.node.status': status
    });
  }
}

export async function recordCurrentStats(read: () => Promise<Stats>): Promise<void> {
  if (!telemetryEnabled()) {
    return;
  }
  recordStats(await read());
}

export async function timeNode<T extends ProviderResult>(
  actionId: string,
  work: () => Promise<T>
): Promise<T> {
  const startedAt = performance.now();
  try {
    const result = await work();
    recordNodeDuration(actionId, result.status, startedAt);
    return result;
  } catch (error) {
    recordNodeDuration(actionId, 'failed', startedAt, error);
    throw error;
  }
}

function recordNodeDuration(
  actionId: string,
  result: NodeResult,
  startedAt: number,
  error?: unknown
): void {
  recordTelemetryHistogram(
    METRIC_NODE_DURATION,
    Math.max(0, performance.now() - startedAt) / 1000,
    {
      'pipeline.node.action': actionId,
      'pipeline.node.result': result,
      ...errorAttributes(error)
    },
    {
      description: 'Pipeline node dispatch duration by action and bounded result.',
      unit: 's'
    }
  );
}

function errorAttributes(error: unknown): TelemetryAttributes {
  if (error === undefined) {
    return {};
  }
  return {
    'error.type': error instanceof Error && error.name.length > 0 ? error.name : typeof error
  };
}

export type { NodeStatus, RunStatus };
