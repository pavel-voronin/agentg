import {
  enabledEventFiltersCountInState,
  eventGroupFilterStateInState,
  eventGroupForEvent,
  eventTypesForGroupInState,
  filterableEventGroupsInState,
  isEventTypeEnabledInState
} from '../domain/events.js';
import {
  RPC_CALL_EVENT_LIFECYCLES,
  rpcCallEventTarget,
  rpcCallLifecycleEventType,
  type AppEventItem,
  type AppRpcEventItem,
  type AppRpcLifecycleItem,
  type AppStandardEventItem,
  type ControlPlaneEvent,
  type ControlPlaneStreamEvent,
  type EventCatalogState,
  type EventFilterDomainView,
  type EventFilterGroupView,
  type EventFilterTypeView,
  type EventFiltersPanelView,
  type EventFiltersState,
  type EventGroup
} from '../stores/controlPlaneTypes.js';
import { eventBodyView, type EventYamlViewOptions } from './eventYamlView.js';
import { formatEventTime, formatOptionalValue } from './formatters.js';

export type EventsPanelViewSource = {
  eventCatalog: EventCatalogState;
  eventFilters: EventFiltersState;
  events: ControlPlaneEvent[];
};

export type EventTypeMutedLookup = (type: string) => boolean;

type EventFilterDomainId = string;

export type EventListItemsOptions = {
  yaml?: EventYamlViewOptions;
};

type EventListSourceEvent = ControlPlaneEvent | ControlPlaneStreamEvent;

export function eventListItem(
  event: EventListSourceEvent,
  index: number,
  muted: boolean,
  options: EventListItemsOptions = {}
): AppStandardEventItem {
  const group = eventGroupForEvent(event);
  const type = event.type ?? '';
  return {
    body: eventBodyView(event.data ?? {}, eventYamlViewOptions(event, options)),
    color: group.color,
    filterable: group.filterable !== false,
    kind: 'event',
    key: event.id ?? `${formatOptionalValue(event.occurredAt)}:${type}:${String(index)}`,
    muted,
    occurredAt: formatEventTime(event.occurredAt),
    type
  };
}

export function eventListItems(
  events: EventListSourceEvent[],
  isEventTypeMuted: EventTypeMutedLookup,
  options: EventListItemsOptions = {}
): AppEventItem[] {
  const items: AppEventItem[] = [];
  const rpcItems = new Map<string, AppRpcEventItem>();

  events.forEach((event, index) => {
    const type = event.type ?? '';
    const group = eventGroupForEvent(event);
    const rpcLifecycle = group.id === 'rpc' ? rpcCallLifecycle(event, type) : null;
    if (rpcLifecycle === null) {
      items.push(eventListItem(event, index, isEventTypeMuted(type), options));
      return;
    }

    const itemKey = rpcEventItemKey(rpcLifecycle.target, rpcLifecycle.callId);
    let item = rpcItems.get(itemKey);
    if (item === undefined) {
      item = {
        callId: rpcLifecycle.callId,
        color: group.color,
        filterable: group.filterable !== false,
        kind: 'rpc',
        key: itemKey,
        lifecycleTypes: [],
        lifecycles: [],
        muted: false,
        target: rpcLifecycle.target
      };
      rpcItems.set(itemKey, item);
      items.push(item);
    }

    item.lifecycles.unshift(
      rpcLifecycleItem(event, index, rpcLifecycle, isEventTypeMuted(type), options)
    );
  });

  for (const item of rpcItems.values()) {
    item.lifecycleTypes = [...new Set(item.lifecycles.map((lifecycle) => lifecycle.type))];
    item.lifecycles = item.lifecycles.map((lifecycle, index, lifecycles) => ({
      ...lifecycle,
      occurredAt: rpcLifecycleTimeLabel(lifecycle, lifecycles[index - 1] ?? null)
    }));
    item.muted =
      item.lifecycleTypes.length > 0 && item.lifecycleTypes.every((type) => isEventTypeMuted(type));
  }

  return items;
}

export function eventFiltersPanelView(source: EventsPanelViewSource): EventFiltersPanelView {
  const groups = filterableEventGroupsInState(source).map((group) =>
    eventFilterGroupView(source, group)
  );
  return {
    domains: eventFilterDomains(groups),
    enabledCount: String(enabledEventFiltersCountInState(source)),
    groups
  };
}

function eventFilterDomains(groups: EventFilterGroupView[]): EventFilterDomainView[] {
  const rpcGroup = groups.find((group) => group.kind === 'rpc');
  const domainIds = [
    ...new Set([
      ...groups.flatMap((group) => (group.kind === 'types' ? [eventGroupDomainId(group.id)] : [])),
      ...(rpcGroup?.rpcCalls
        .map((call) => rpcTargetDomainId(call.target))
        .filter((id): id is EventFilterDomainId => id !== null) ?? [])
    ])
  ].sort();

  return domainIds
    .map((domainId) => {
      const events = groups.flatMap((group) =>
        group.kind === 'types' && eventGroupDomainId(group.id) === domainId ? group.types : []
      );
      const rpc = rpcGroup === undefined ? [] : [eventFilterDomainRpcGroupView(rpcGroup, domainId)];
      const visibleRpc = rpc.filter((group) => group.rpcCalls.length > 0);
      const enabledEventCount = events.filter((type) => type.enabled).length;
      return {
        enabledCount: String(eventFilterDomainEnabledCount(events, visibleRpc)),
        events,
        eventsChecked: events.length > 0 && enabledEventCount === events.length,
        eventsIndeterminate: enabledEventCount > 0 && enabledEventCount < events.length,
        eventTypes: events.map((event) => event.type),
        id: domainId,
        label: eventDomainLabel(domainId),
        rpc: visibleRpc
      };
    })
    .filter((domain) => domain.events.length > 0 || domain.rpc.length > 0);
}

function eventFilterDomainEnabledCount(
  events: EventFilterTypeView[],
  rpc: EventFilterGroupView[]
): number {
  return (
    events.filter((type) => type.enabled).length +
    rpc.reduce(
      (count, group) =>
        count +
        group.rpcCalls.reduce(
          (callCount, call) =>
            callCount + call.lifecycles.filter((lifecycle) => lifecycle.enabled).length,
          0
        ),
      0
    )
  );
}

function eventFilterDomainRpcGroupView(
  group: EventFilterGroupView,
  domainId: EventFilterDomainId
): EventFilterGroupView {
  const rpcCalls = group.rpcCalls.filter((call) => rpcTargetDomainId(call.target) === domainId);
  const enabledCount = rpcCalls.reduce(
    (count, call) => count + call.lifecycles.filter((lifecycle) => lifecycle.enabled).length,
    0
  );
  const lifecycleCount = rpcCalls.reduce((count, call) => count + call.lifecycles.length, 0);
  return {
    ...group,
    checked: lifecycleCount > 0 && enabledCount === lifecycleCount,
    indeterminate: enabledCount > 0 && enabledCount < lifecycleCount,
    lifecycleColumns: RPC_CALL_EVENT_LIFECYCLES.map((lifecycle) => {
      const columnTypes = rpcCalls.flatMap((call) =>
        call.lifecycles.filter((item) => item.suffix === lifecycle.suffix)
      );
      const columnEnabledCount = columnTypes.filter((item) => item.enabled).length;
      return {
        ...lifecycle,
        checked: columnTypes.length > 0 && columnEnabledCount === columnTypes.length,
        indeterminate: columnEnabledCount > 0 && columnEnabledCount < columnTypes.length,
        types: columnTypes.map((item) => item.type)
      };
    }),
    rpcCalls
  };
}

function eventFilterGroupView(
  source: EventsPanelViewSource,
  group: EventGroup
): EventFilterGroupView {
  const filterState = eventGroupFilterStateInState(source, group);
  if (group.id === 'rpc') {
    return eventFilterRpcGroupView(source, group, filterState);
  }
  return {
    checked: filterState.checked,
    color: group.color,
    id: group.id,
    indeterminate: filterState.indeterminate,
    kind: 'types',
    label: group.label,
    lifecycleColumns: [],
    rpcCalls: [],
    types: eventTypesForGroupInState(source, group).map((type) => ({
      enabled: isEventTypeEnabledInState(source, group, type),
      groupId: group.id,
      type
    }))
  };
}

function eventFilterRpcGroupView(
  source: EventsPanelViewSource,
  group: EventGroup,
  filterState: { checked: boolean; indeterminate: boolean }
): EventFilterGroupView {
  const targets = rpcCallTargetsForGroup(source, group);
  const rpcCalls = targets.map((target) => {
    const lifecycles = RPC_CALL_EVENT_LIFECYCLES.map((lifecycle) => {
      const type = rpcCallLifecycleEventType(target, lifecycle.suffix);
      return {
        ...lifecycle,
        enabled: isEventTypeEnabledInState(source, group, type),
        type
      };
    });
    const enabledCount = lifecycles.filter((lifecycle) => lifecycle.enabled).length;
    return {
      checked: enabledCount === lifecycles.length,
      indeterminate: enabledCount > 0 && enabledCount < lifecycles.length,
      lifecycles,
      lifecycleTypes: lifecycles.map((lifecycle) => lifecycle.type),
      target
    };
  });
  return {
    checked: filterState.checked,
    color: group.color,
    id: group.id,
    indeterminate: filterState.indeterminate,
    kind: 'rpc',
    label: group.label,
    lifecycleColumns: RPC_CALL_EVENT_LIFECYCLES.map((lifecycle) => {
      const columnTypes = rpcCalls.flatMap((call) =>
        call.lifecycles.filter((item) => item.suffix === lifecycle.suffix)
      );
      const enabledCount = columnTypes.filter((item) => item.enabled).length;
      return {
        ...lifecycle,
        checked: columnTypes.length > 0 && enabledCount === columnTypes.length,
        indeterminate: enabledCount > 0 && enabledCount < columnTypes.length,
        types: columnTypes.map((item) => item.type)
      };
    }),
    rpcCalls,
    types: []
  };
}

function rpcCallTargetsForGroup(source: EventsPanelViewSource, group: EventGroup): string[] {
  return [
    ...new Set(
      eventTypesForGroupInState(source, group)
        .map((type) => rpcCallEventTarget(type))
        .filter((target): target is string => target !== null)
    )
  ];
}

function rpcCallLifecycle(
  event: ControlPlaneEvent,
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
  muted: boolean,
  options: EventListItemsOptions
): AppRpcLifecycleItem {
  const type = event.type ?? '';
  return {
    body: eventBodyView(event.data ?? {}, eventYamlViewOptions(event, options)),
    key:
      event.id ??
      `${rpcEventItemKey(rpcLifecycle.target, rpcLifecycle.callId)}:${type}:${formatOptionalValue(event.occurredAt)}:${String(index)}`,
    label: rpcLifecycle.lifecycle.label,
    muted,
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

function rpcTargetDomainId(target: string): EventFilterDomainId | null {
  const domainId = target.split('.')[0]?.trim();
  return domainId === undefined || domainId.length === 0 ? null : domainId;
}

function eventGroupDomainId(groupId: string): EventFilterDomainId {
  return groupId.startsWith('events:') ? groupId.slice('events:'.length) : groupId;
}

function eventDomainLabel(domainId: EventFilterDomainId): string {
  return domainId
    .split(/[-_]/)
    .filter((part) => part.length > 0)
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
    .join(' ');
}
