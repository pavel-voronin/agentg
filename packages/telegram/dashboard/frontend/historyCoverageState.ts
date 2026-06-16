export const DEFAULT_VIEWPORT_DAYS = 30;

export const TIMELINE_SCALE_PRESETS = [
  { label: '7d', value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
  { label: '1y', value: 365 },
  { label: 'All', value: 0 }
] as const;

export type DashboardEvent = {
  data?: unknown;
  id?: string;
  meta?: unknown;
  occurredAt?: string;
  type?: string;
};

export type HistoryCoverageResult = {
  chatId?: unknown;
  coverage?: unknown;
};

export type HistoryCoverageChat = {
  historyStartAt: string | null;
  id: string;
};

export type HistoryCoverageInterval = {
  coveredAt: string;
  endAt: string;
  messageCount: number;
  startAt: string;
};

export type HistoryCoverageState = {
  chat: HistoryCoverageChat | null;
  coverage: HistoryCoverageInterval[];
};

export type HistoryCoverageStatus = 'failed' | 'idle' | 'loading' | 'ready' | 'unavailable';

export type TimelineScaleButtonView = {
  active: boolean;
  isDefault: boolean;
  label: string;
  value: number;
};

export function normalizeViewportDays(value: number | string): number {
  const days = Number(value);
  if (!Number.isFinite(days)) {
    return DEFAULT_VIEWPORT_DAYS;
  }
  return Math.max(0, Math.round(days));
}

export function readHistoryCoverageState(
  value: unknown,
  expectedChatId: string
): HistoryCoverageState | null {
  const input = asRecord(value);
  if (asString(input?.chatId) !== expectedChatId) {
    return null;
  }
  return {
    chat: {
      historyStartAt: null,
      id: expectedChatId
    },
    coverage: asArray(input?.coverage).map(normalizeHistoryCoverageInterval)
  };
}

export function timelineScaleButtons(input: {
  defaultViewportDays: number;
  viewportDays: number | null;
}): TimelineScaleButtonView[] {
  return TIMELINE_SCALE_PRESETS.map((preset) => ({
    active: input.viewportDays === preset.value,
    isDefault: input.defaultViewportDays === preset.value,
    label: preset.label,
    value: preset.value
  }));
}

function normalizeHistoryCoverageInterval(value: unknown): HistoryCoverageInterval {
  const input = asRecord(value);
  return {
    coveredAt: asString(input?.coveredAt) ?? '',
    endAt: asString(input?.endAt) ?? '',
    messageCount: asNonNegativeInteger(input?.messageCount),
    startAt: asString(input?.startAt) ?? ''
  };
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asNonNegativeInteger(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}
