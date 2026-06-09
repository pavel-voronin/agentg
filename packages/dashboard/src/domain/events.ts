import {
  DEFAULT_EVENT_LIMIT,
  DEFAULT_EVENT_YAML_LIST_LIMIT,
  MIN_EVENT_LIMIT,
  MIN_EVENT_YAML_LIST_LIMIT,
  rpcCallEventTarget,
  type DashboardEvent,
  type EventGroup
} from '../stores/dashboardTypes.js';

export function eventGroupForEvent(event: DashboardEvent): EventGroup {
  return eventGroupForType(event.type ?? '');
}

export function eventGroupForType(type: string): EventGroup {
  const normalizedType = type.trim();
  if (rpcCallEventTarget(normalizedType) !== null) {
    return {
      color: '#6366f1',
      id: 'rpc',
      label: 'RPC calls'
    };
  }

  const domain = eventDomainFromType(normalizedType);
  const group = {
    color: colorForEventDomain(domain),
    id: `events:${domain}`,
    label: labelForEventDomain(domain)
  };
  return group;
}

export function normalizeEventLimit(value: number | string): number {
  const limit = Number(value);
  if (!Number.isFinite(limit) || limit <= 0) {
    return DEFAULT_EVENT_LIMIT;
  }
  return Math.max(MIN_EVENT_LIMIT, Math.round(limit));
}

export function normalizeEventYamlListLimit(value: number | string): number {
  const limit = Number(value);
  if (!Number.isFinite(limit) || limit <= 0) {
    return DEFAULT_EVENT_YAML_LIST_LIMIT;
  }
  return Math.max(MIN_EVENT_YAML_LIST_LIMIT, Math.round(limit));
}

function eventDomainFromType(type: string): string {
  const domain = type.split('.')[0]?.trim();
  if (domain === undefined || domain.length === 0) {
    return 'other';
  }
  return domain;
}

function labelForEventDomain(domain: string): string {
  return domain
    .split(/[-_]/)
    .filter((part) => part.length > 0)
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
    .join(' ');
}

function colorForEventDomain(domain: string): string {
  const palette = [
    '#0ea5e9',
    '#10b981',
    '#f59e0b',
    '#7c3aed',
    '#14b8a6',
    '#f97316',
    '#ef4444',
    '#2563eb'
  ] as const;
  let hash = 0;
  for (const char of domain) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return palette[hash % palette.length] ?? '#2563eb';
}
