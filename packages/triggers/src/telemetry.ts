import {
  incrementTelemetryCounter,
  setTelemetryGauge,
  timeTelemetrySpan,
  type TelemetryAttributes
} from '@agentg/framework';

import { occurrenceStatuses, type OccurrenceStatus } from './schema.js';
import type { TriggerStats } from './store.js';

type RuntimeOperation = 'reconcile' | 'run_due';
type DispatchResult = 'accepted' | 'failed' | 'rejected' | 'retry_waiting';

const METRIC_REGISTRATIONS = 'triggers.registrations';
const METRIC_OCCURRENCES = 'triggers.occurrences';
const METRIC_DUE_OCCURRENCES = 'triggers.due_occurrences';
const METRIC_OLDEST_DUE_AGE = 'triggers.oldest_due_age';
const METRIC_OCCURRENCES_CREATED = 'triggers.occurrences.created';
const METRIC_DISPATCHES = 'triggers.dispatches';
const METRIC_RUNTIME_DURATION = 'triggers.runtime.duration';
const METRIC_DISPATCH_DURATION = 'triggers.dispatch.duration';

export function recordTriggerStats(stats: TriggerStats): void {
  setTelemetryGauge(METRIC_REGISTRATIONS, stats.registrationCount);
  setTelemetryGauge(METRIC_DUE_OCCURRENCES, stats.dueOccurrenceCount);
  setTelemetryGauge(METRIC_OLDEST_DUE_AGE, stats.oldestDueOccurrenceAgeSeconds);

  const counts = new Map(stats.occurrenceStatusCounts.map((row) => [row.status, row.count]));
  for (const status of occurrenceStatuses) {
    setTelemetryGauge(METRIC_OCCURRENCES, counts.get(status) ?? 0, {
      'trigger.occurrence.status': status
    });
  }
}

export function recordOccurrencesCreated(count: number): void {
  incrementTelemetryCounter(METRIC_OCCURRENCES_CREATED, count);
}

export function recordDispatch(result: DispatchResult): void {
  incrementTelemetryCounter(METRIC_DISPATCHES, 1, {
    'trigger.dispatch.result': result
  });
}

export function timeTriggerRuntime<T>(
  operation: RuntimeOperation,
  work: () => Promise<T>
): Promise<T> {
  const attributes: TelemetryAttributes = {
    'trigger.runtime.operation': operation
  };
  return timeTelemetrySpan(
    {
      attributes,
      metric: {
        attributes,
        name: METRIC_RUNTIME_DURATION
      },
      name: `triggers.${operation}`
    },
    work
  );
}

export function timeTriggerDispatch<T>(work: () => Promise<T>): Promise<T> {
  return timeTelemetrySpan(
    {
      metric: {
        name: METRIC_DISPATCH_DURATION
      },
      name: 'triggers.dispatch'
    },
    work
  );
}

export type { DispatchResult, OccurrenceStatus };
