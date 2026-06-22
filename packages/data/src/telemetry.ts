import { performance } from 'node:perf_hooks';

import {
  incrementTelemetryCounter,
  recordTelemetryHistogram,
  type TelemetryAttributes
} from '@agentg/framework';

type Operation =
  | 'action_expand'
  | 'action_get'
  | 'action_render'
  | 'action_select'
  | 'action_write_annotation'
  | 'action_write_collection_item'
  | 'browse_annotations'
  | 'browse_collection'
  | 'expand'
  | 'get'
  | 'get_annotation'
  | 'get_collection_item'
  | 'list_annotations'
  | 'list_collection'
  | 'overview'
  | 'render'
  | 'select'
  | 'select_page'
  | 'write_annotation'
  | 'write_collection_item';

type OperationResult = 'failed' | 'missing' | 'ok' | 'ready' | 'rejected';
type WriteKind = 'annotation' | 'collection_item';
type WriteMode = 'append' | 'merge' | 'replace';

const METRIC_OPERATION_DURATION = 'data.operation.duration';
const METRIC_WRITES = 'data.writes';

export async function timeOperation<T>(
  operation: Operation,
  work: () => Promise<T>,
  resultOf: (value: T) => OperationResult = () => 'ok'
): Promise<T> {
  const startedAt = performance.now();
  try {
    const value = await work();
    recordOperationDuration(operation, resultOf(value), startedAt);
    return value;
  } catch (error) {
    recordOperationDuration(operation, 'failed', startedAt, error);
    throw error;
  }
}

export function recordWrite(kind: WriteKind, mode: WriteMode, count: number): void {
  incrementTelemetryCounter(METRIC_WRITES, count, {
    'data.write.kind': kind,
    'data.write.mode': mode
  });
}

function recordOperationDuration(
  operation: Operation,
  result: OperationResult,
  startedAt: number,
  error?: unknown
): void {
  recordTelemetryHistogram(
    METRIC_OPERATION_DURATION,
    Math.max(0, performance.now() - startedAt) / 1000,
    {
      'data.operation': operation,
      'data.operation.result': result,
      ...errorAttributes(error)
    },
    {
      description: 'Data operation runtime by bounded operation and result.',
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
