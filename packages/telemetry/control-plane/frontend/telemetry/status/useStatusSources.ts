import { computed, onBeforeUnmount, onMounted, ref, type ComputedRef } from 'vue';

import { NATS_REPORT_EVENT_TYPE, REPORT_EVENT_TYPE } from '../contracts.js';
import {
  telemetryStatusSourceView,
  type TelemetryStatusSourceRegistration,
  type TelemetryStatusSourceState,
  type TelemetryStatusSourceView
} from './statusSources.js';
import type { ReportTabView } from '../types.js';

const statusTimeline = [
  { durationMs: 5_000, label: 'Live', tone: 'ok' },
  { durationMs: 10_000, label: 'Delayed', tone: 'warn' },
  { durationMs: 60_000, label: 'Stale', tone: 'neutral' }
] satisfies TelemetryStatusSourceRegistration['timeline'];

const builtInStatusSources = [
  {
    eventType: REPORT_EVENT_TYPE,
    id: 'telemetry.report',
    label: 'Telemetry report',
    timeline: statusTimeline
  },
  {
    eventType: NATS_REPORT_EVENT_TYPE,
    id: 'telemetry.nats',
    label: 'NATS telemetry',
    timeline: statusTimeline
  }
] satisfies readonly TelemetryStatusSourceRegistration[];

type SourceDetails = {
  generatedAt?: string | undefined;
  generatedInMs?: number | undefined;
};

export function useTelemetryStatusSources(externalTabs: ComputedRef<readonly ReportTabView[]>): {
  markEventSourceAccepted: (source: TelemetryStatusSourceRegistration | undefined) => void;
  markSourceAccepted: (sourceId: string, details?: SourceDetails) => void;
  markSourceError: (sourceId: string, error: string, details?: SourceDetails) => void;
  sourceIndicators: ComputedRef<TelemetryStatusSourceView[]>;
  statusSources: ComputedRef<TelemetryStatusSourceRegistration[]>;
} {
  const nowMs = ref(Date.now());
  const sourceStates = ref<Record<string, TelemetryStatusSourceState>>({});
  const statusSources = computed(() => [
    ...builtInStatusSources,
    ...externalTabs.value
      .map((tab) => tab.statusSource)
      .filter((source): source is TelemetryStatusSourceRegistration => source !== null)
  ]);
  const sourceIndicators = computed(() =>
    statusSources.value.map((source) =>
      telemetryStatusSourceView(source, sourceStates.value[source.id], nowMs.value)
    )
  );
  let clockInterval: ReturnType<typeof setInterval> | null = null;

  onMounted(() => {
    clockInterval = setInterval(() => {
      nowMs.value = Date.now();
    }, 1000);
  });

  onBeforeUnmount(() => {
    if (clockInterval !== null) {
      clearInterval(clockInterval);
      clockInterval = null;
    }
  });

  function markEventSourceAccepted(source: TelemetryStatusSourceRegistration | undefined): void {
    if (source === undefined) {
      return;
    }
    markSourceAccepted(source.id);
  }

  function markSourceAccepted(sourceId: string, details: SourceDetails = {}): void {
    sourceStates.value = {
      ...sourceStates.value,
      [sourceId]: {
        acceptedAtMs: Date.now(),
        error: null,
        ...(details.generatedAt === undefined ? {} : { generatedAt: details.generatedAt }),
        ...(details.generatedInMs === undefined ? {} : { generatedInMs: details.generatedInMs })
      }
    };
  }

  function markSourceError(sourceId: string, error: string, details: SourceDetails = {}): void {
    const current = sourceStates.value[sourceId];
    sourceStates.value = {
      ...sourceStates.value,
      [sourceId]: {
        acceptedAtMs:
          current?.acceptedAtMs ?? (details.generatedAt === undefined ? null : Date.now()),
        error,
        ...(details.generatedAt === undefined
          ? current?.generatedAt === undefined
            ? {}
            : { generatedAt: current.generatedAt }
          : { generatedAt: details.generatedAt }),
        ...(details.generatedInMs === undefined
          ? current?.generatedInMs === undefined
            ? {}
            : { generatedInMs: current.generatedInMs }
          : { generatedInMs: details.generatedInMs })
      }
    };
  }

  return {
    markEventSourceAccepted,
    markSourceAccepted,
    markSourceError,
    sourceIndicators,
    statusSources
  };
}
