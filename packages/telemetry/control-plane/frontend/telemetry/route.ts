export type TelemetryTabId = 'nats' | 'operations' | 'updates';

const defaultTab: TelemetryTabId = 'operations';
const tabs = new Set<TelemetryTabId>(['nats', 'operations', 'updates']);

export function telemetryTabFromSegment(segment: string | null): TelemetryTabId | null {
  if (segment === null) {
    return defaultTab;
  }
  return isTelemetryTab(segment) ? segment : null;
}

export function telemetryRouteSegments(tab: TelemetryTabId): string[] {
  return tab === defaultTab ? [] : [tab];
}

function isTelemetryTab(value: string | null): value is TelemetryTabId {
  return value !== null && tabs.has(value as TelemetryTabId);
}
