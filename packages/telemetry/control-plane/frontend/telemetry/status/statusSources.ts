export type TelemetryStatusTone = 'bad' | 'neutral' | 'ok' | 'warn';

export type TelemetryStatusTimelineStep = {
  durationMs: number;
  label: string;
  tone: Exclude<TelemetryStatusTone, 'bad'>;
};

export type TelemetryStatusSourceRegistration = {
  eventType: string;
  id: string;
  label: string;
  timeline: readonly TelemetryStatusTimelineStep[];
};

export type TelemetryStatusSourceState = {
  acceptedAtMs: number | null;
  error: string | null;
  generatedAt?: string | undefined;
  generatedInMs?: number | undefined;
};

export type TelemetryStatusSourceView = {
  ariaLabel: string;
  details: string[];
  id: string;
  label: string;
  status: string;
  tone: TelemetryStatusTone;
};

const waitingTimelineStep = {
  durationMs: 0,
  label: 'Waiting',
  tone: 'neutral'
} satisfies TelemetryStatusTimelineStep;

export function telemetryStatusSourceView(
  registration: TelemetryStatusSourceRegistration,
  state: TelemetryStatusSourceState | undefined,
  nowMs: number
): TelemetryStatusSourceView {
  const sourceState = state ?? {
    acceptedAtMs: null,
    error: null
  };

  if (sourceState.error !== null) {
    return {
      ariaLabel: `${registration.label}: Error`,
      details: sourceDetails(sourceState, nowMs, sourceState.error),
      id: registration.id,
      label: registration.label,
      status: 'Error',
      tone: 'bad'
    };
  }

  if (sourceState.acceptedAtMs === null) {
    return {
      ariaLabel: `${registration.label}: ${waitingTimelineStep.label}`,
      details: ['No data accepted yet'],
      id: registration.id,
      label: registration.label,
      status: waitingTimelineStep.label,
      tone: waitingTimelineStep.tone
    };
  }

  const elapsedMs = Math.max(0, nowMs - sourceState.acceptedAtMs);
  const step = timelineStep(registration.timeline, elapsedMs);
  return {
    ariaLabel: `${registration.label}: ${step.label}`,
    details: sourceDetails(sourceState, nowMs),
    id: registration.id,
    label: registration.label,
    status: step.label,
    tone: step.tone
  };
}

export function parseTelemetryStatusSourceRegistration(
  value: unknown
): TelemetryStatusSourceRegistration | null {
  if (!isRecord(value) || !Array.isArray(value.timeline)) {
    return null;
  }

  const id = nonEmptyString(value.sourceId);
  const eventType = nonEmptyString(value.eventType);
  const label = nonEmptyString(value.label);
  const timeline = value.timeline
    .map(timelineStepFromValue)
    .filter((step): step is TelemetryStatusTimelineStep => step !== null);
  if (id === null || eventType === null || label === null || timeline.length === 0) {
    return null;
  }

  return {
    eventType,
    id,
    label,
    timeline
  };
}

function timelineStep(
  timeline: readonly TelemetryStatusTimelineStep[],
  elapsedMs: number
): TelemetryStatusTimelineStep {
  let remainingMs = elapsedMs;
  for (const step of timeline) {
    if (remainingMs <= step.durationMs) {
      return step;
    }
    remainingMs -= step.durationMs;
  }
  return timeline[timeline.length - 1] ?? waitingTimelineStep;
}

function sourceDetails(
  state: TelemetryStatusSourceState,
  nowMs: number,
  error: string | null = null
): string[] {
  const details: string[] = [];
  if (error !== null) {
    details.push(error);
  }
  if (state.acceptedAtMs !== null) {
    details.push(`accepted ${formatElapsed(Math.max(0, nowMs - state.acceptedAtMs))} ago`);
  }
  if (state.generatedAt !== undefined) {
    const generatedIn =
      state.generatedInMs === undefined ? '' : ` in ${formatMs(state.generatedInMs)}`;
    details.push(`generated ${formatDateTime(state.generatedAt)}${generatedIn}`);
  }
  return details.length === 0 ? ['No data accepted yet'] : details;
}

function timelineStepFromValue(value: unknown): TelemetryStatusTimelineStep | null {
  if (!isRecord(value)) {
    return null;
  }

  const label = nonEmptyString(value.label);
  const tone = telemetryTone(value.tone);
  if (
    label === null ||
    tone === null ||
    typeof value.durationMs !== 'number' ||
    !Number.isFinite(value.durationMs) ||
    value.durationMs <= 0
  ) {
    return null;
  }

  return {
    durationMs: value.durationMs,
    label,
    tone
  };
}

function telemetryTone(value: unknown): Exclude<TelemetryStatusTone, 'bad'> | null {
  if (value === 'neutral' || value === 'ok' || value === 'warn') {
    return value;
  }
  return null;
}

function formatElapsed(value: number): string {
  if (value >= 60_000) {
    return `${Math.floor(value / 60_000).toLocaleString()}m`;
  }
  return `${Math.floor(value / 1000).toLocaleString()}s`;
}

function formatMs(value: number): string {
  if (!Number.isFinite(value)) {
    return '-';
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)}s`;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)}ms`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit'
  }).format(date);
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
