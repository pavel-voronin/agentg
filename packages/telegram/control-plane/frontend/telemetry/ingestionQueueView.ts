type IngestionQueueSignal = {
  pendingUpdateCount: number;
  runningUpdateCount: number;
  updateConcurrency: number;
};

export type IngestionQueueSignalView = {
  limit: string;
  pending: string;
  running: string;
  tone: 'bad' | 'neutral' | 'warn';
  updatedAt: string;
  utilization: string;
};

export function parseIngestionQueueSignal(value: unknown): IngestionQueueSignal {
  if (
    !isRecord(value) ||
    !isNonNegativeInteger(value.pendingUpdateCount) ||
    !isNonNegativeInteger(value.runningUpdateCount) ||
    !isPositiveInteger(value.updateConcurrency)
  ) {
    throw new Error('Ingestion queue signal shape is invalid');
  }

  return {
    pendingUpdateCount: value.pendingUpdateCount,
    runningUpdateCount: value.runningUpdateCount,
    updateConcurrency: value.updateConcurrency
  };
}

export function ingestionQueueSignalView(
  signal: IngestionQueueSignal,
  occurredAt: string | null
): IngestionQueueSignalView {
  const utilization =
    signal.updateConcurrency === 0 ? 0 : signal.runningUpdateCount / signal.updateConcurrency;
  return {
    limit: formatInteger(signal.updateConcurrency),
    pending: formatInteger(signal.pendingUpdateCount),
    running: formatInteger(signal.runningUpdateCount),
    tone: ingestionQueueTone(signal),
    updatedAt: formatDateTime(occurredAt),
    utilization: formatPercent(utilization)
  };
}

function ingestionQueueTone(signal: IngestionQueueSignal): 'bad' | 'neutral' | 'warn' {
  if (signal.pendingUpdateCount > signal.updateConcurrency) {
    return 'bad';
  }
  if (signal.pendingUpdateCount > 0) {
    return 'warn';
  }
  return 'neutral';
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat().format(Number.isFinite(value) ? value : 0);
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value) || value < 0) {
    return '0%';
  }
  return `${String(Math.round(value * 100))}%`;
}

function formatDateTime(value: string | null): string {
  if (value === null) {
    return '-';
  }
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
