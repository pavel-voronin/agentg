export type TelemetryTabId =
  | 'data'
  | 'files'
  | 'get-messages'
  | 'history-reconciler'
  | 'llm-runner'
  | 'nats'
  | 'overview'
  | 'pipelines'
  | 'policies'
  | 'postgres'
  | 'telegram'
  | 'triggers'
  | 'updates';

const defaultTab: TelemetryTabId = 'overview';
const tabs = new Set<TelemetryTabId>([
  'data',
  'files',
  'get-messages',
  'history-reconciler',
  'llm-runner',
  'nats',
  'overview',
  'pipelines',
  'policies',
  'postgres',
  'telegram',
  'triggers',
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
