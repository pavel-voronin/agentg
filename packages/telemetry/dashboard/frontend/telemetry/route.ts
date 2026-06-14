export type TelemetryTabId =
  | 'files'
  | 'get-messages'
  | 'history-reconciler'
  | 'nats'
  | 'overview'
  | 'postgres'
  | 'telegram'
  | 'updates';

const defaultTab: TelemetryTabId = 'overview';
const tabs = new Set<TelemetryTabId>([
  'files',
  'get-messages',
  'history-reconciler',
  'nats',
  'overview',
  'postgres',
  'telegram',
  'updates'
]);

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
