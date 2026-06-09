import { eventGroupForEvent } from '../domain/events.js';
import {
  RPC_CALL_EVENT_LIFECYCLES,
  rpcCallEventTarget,
  type AppEventItem,
  type AppRpcEventItem,
  type AppRpcLifecycleItem,
  type AppStandardEventItem,
  type DashboardEvent,
  type DashboardStreamEvent
} from '../stores/dashboardTypes.js';
import { eventBodyView, type EventYamlViewOptions } from './eventYamlView.js';
import { formatEventTime, formatOptionalValue } from './formatters.js';

export type EventListItemsOptions = {
  yaml?: EventYamlViewOptions;
};

type EventListSourceEvent = DashboardEvent | DashboardStreamEvent;

export function eventListItem(
  event: EventListSourceEvent,
  index: number,
  options: EventListItemsOptions = {}
): AppStandardEventItem {
  const group = eventGroupForEvent(event);
  const type = event.type ?? '';
  return {
    body: eventBodyView(event.data ?? {}, eventYamlViewOptions(event, options)),
    color: group.color,
    kind: 'event',
    key: event.id ?? `${formatOptionalValue(event.occurredAt)}:${type}:${String(index)}`,
    occurredAt: formatEventTime(event.occurredAt),
    type
  };
}

export function eventListItems(
  events: EventListSourceEvent[],
  options: EventListItemsOptions = {}
): AppEventItem[] {
  const items: AppEventItem[] = [];
  const rpcItems = new Map<string, AppRpcEventItem>();

  events.forEach((event, index) => {
    const type = event.type ?? '';
    const group = eventGroupForEvent(event);
    const rpcLifecycle = group.id === 'rpc' ? rpcCallLifecycle(event, type) : null;
    if (rpcLifecycle === null) {
      items.push(eventListItem(event, index, options));
      return;
    }

    const itemKey = rpcEventItemKey(rpcLifecycle.target, rpcLifecycle.callId);
    let item = rpcItems.get(itemKey);
    if (item === undefined) {
      item = {
        callId: rpcLifecycle.callId,
        color: group.color,
        kind: 'rpc',
        key: itemKey,
        lifecycles: [],
        target: rpcLifecycle.target
      };
      rpcItems.set(itemKey, item);
      items.push(item);
    }

    item.lifecycles.unshift(rpcLifecycleItem(event, index, rpcLifecycle, options));
  });

  for (const item of rpcItems.values()) {
    item.lifecycles = item.lifecycles.map((lifecycle, index, lifecycles) => ({
      ...lifecycle,
      occurredAt: rpcLifecycleTimeLabel(lifecycle, lifecycles[index - 1] ?? null)
    }));
  }

  return items;
}

function rpcCallLifecycle(
  event: DashboardEvent,
  type: string
): {
  callId: string;
  lifecycle: (typeof RPC_CALL_EVENT_LIFECYCLES)[number];
  target: string;
} | null {
  const lifecycle = RPC_CALL_EVENT_LIFECYCLES.find(({ suffix }) => type.endsWith(`.${suffix}`));
  const callId = rpcCallId(event.data);
  const target = rpcCallEventTarget(type);
  if (lifecycle === undefined) {
    return null;
  }
  if (callId === null) {
    return null;
  }
  if (target === null) {
    return null;
  }
  return {
    callId,
    lifecycle,
    target
  };
}

function rpcLifecycleItem(
  event: EventListSourceEvent,
  index: number,
  rpcLifecycle: {
    callId: string;
    lifecycle: (typeof RPC_CALL_EVENT_LIFECYCLES)[number];
    target: string;
  },
  options: EventListItemsOptions
): AppRpcLifecycleItem {
  const type = event.type ?? '';
  return {
    body: eventBodyView(event.data ?? {}, eventYamlViewOptions(event, options)),
    key:
      event.id ??
      `${rpcEventItemKey(rpcLifecycle.target, rpcLifecycle.callId)}:${type}:${formatOptionalValue(event.occurredAt)}:${String(index)}`,
    label: rpcLifecycle.lifecycle.label,
    occurredAt: '',
    occurredAtMs: eventTimeMs(event.occurredAt),
    suffix: rpcLifecycle.lifecycle.suffix,
    title: rpcLifecycle.lifecycle.title,
    type
  };
}

function rpcLifecycleTimeLabel(
  lifecycle: AppRpcLifecycleItem,
  previous: AppRpcLifecycleItem | null
): string {
  if (previous === null) {
    return formatFullEventTimestamp(lifecycle.occurredAtMs);
  }
  if (lifecycle.occurredAtMs === null || previous.occurredAtMs === null) {
    return '';
  }
  return `+${String(Math.max(0, lifecycle.occurredAtMs - previous.occurredAtMs))} ms`;
}

function eventTimeMs(value: string | undefined): number | null {
  const date = new Date(value ?? '');
  const timestamp = date.getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function formatFullEventTimestamp(timestamp: number | null): string {
  return timestamp === null ? '' : new Date(timestamp).toISOString().replace('T', ' ').slice(0, 23);
}

function eventYamlViewOptions(
  event: EventListSourceEvent,
  options: EventListItemsOptions
): EventYamlViewOptions | undefined {
  if (!('yamlListItemLimit' in event)) {
    return options.yaml;
  }
  return {
    ...options.yaml,
    listItemLimit: event.yamlListItemLimit
  };
}

function rpcEventItemKey(target: string, callId: string): string {
  return `rpc:${target}:${callId}`;
}

function rpcCallId(data: unknown): string | null {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return null;
  }
  const callId = (data as { callId?: unknown }).callId;
  return typeof callId === 'string' && callId.length > 0 ? callId : null;
}
