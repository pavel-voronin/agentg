import {
  DEFAULT_EVENT_LIMIT,
  MIN_EVENT_LIMIT,
  rpcCallEventTarget,
  type ControlPlaneEvent,
  type EventFiltersState,
  type EventGroup
} from '../stores/controlPlaneTypes.js';

export type EventFilterSource = {
  eventFilters: EventFiltersState;
  events: ControlPlaneEvent[];
};

export function defaultEventFilters(): EventFiltersState {
  return {
    groups: {},
    types: {}
  };
}

export function enabledEventFiltersCountInState(state: EventFilterSource): number {
  return filterableEventGroupsInState(state).reduce(
    (count, group) =>
      count +
      eventTypesForGroupInState(state, group).filter((type) =>
        isEventTypeEnabledInState(state, group, type)
      ).length,
    0
  );
}

export function eventGroupFilterStateInState(
  state: EventFilterSource,
  group: EventGroup
): { checked: boolean; indeterminate: boolean } {
  const types = eventTypesForGroupInState(state, group);
  const enabled = types.filter((type) => isEventTypeEnabledInState(state, group, type)).length;
  return {
    checked: types.length > 0 && enabled === types.length,
    indeterminate: enabled > 0 && enabled < types.length
  };
}

export function eventGroupForEvent(event: ControlPlaneEvent): EventGroup {
  return eventGroupForType(event.type ?? '');
}

export function eventGroupForType(type: string): EventGroup {
  const normalizedType = type.trim();
  if (rpcCallEventTarget(normalizedType) !== null) {
    return {
      color: '#6366f1',
      eventTypes: [],
      id: 'rpc',
      label: 'RPC calls',
      match: (candidate) => rpcCallEventTarget(candidate) !== null
    };
  }

  const source = eventSourceFromType(normalizedType);
  const group = {
    color: colorForEventSource(source),
    eventTypes: [],
    id: `events:${source}`,
    label: labelForEventSource(source),
    match: (candidate: string) => eventSourceFromType(candidate) === source
  };
  return source === 'ui' || source === 'other' ? { ...group, filterable: false } : group;
}

export function eventTypesForGroupInState(state: EventFilterSource, group: EventGroup): string[] {
  const observed = state.events
    .filter((event) => eventGroupForEvent(event).id === group.id)
    .map((event) => event.type ?? 'unknown');
  const configured = Object.keys(state.eventFilters.types).filter((type) => group.match(type));
  return [...new Set([...group.eventTypes, ...observed, ...configured])].sort();
}

export function filterableEventGroupsInState(state: EventFilterSource): EventGroup[] {
  const types = [
    ...state.events.map((event) => event.type ?? ''),
    ...Object.keys(state.eventFilters.types)
  ];
  const groups = new Map<string, EventGroup>();

  for (const type of types) {
    const group = eventGroupForType(type);
    if (group.filterable !== false) {
      groups.set(group.id, group);
    }
  }

  return [...groups.values()].sort(compareEventGroups);
}

export function isEventEnabledInState(state: EventFilterSource, event: ControlPlaneEvent): boolean {
  const type = event.type ?? '';
  const group = eventGroupForType(type);
  if (group.filterable === false) {
    return true;
  }
  return isEventTypeEnabledInState(state, group, type);
}

export function isEventTypeEnabledInState(
  state: EventFilterSource,
  group: EventGroup,
  type: string
): boolean {
  if (group.filterable === false) {
    return true;
  }
  const stored = state.eventFilters.types[type];
  if (typeof stored === 'boolean') {
    return stored;
  }
  return state.eventFilters.groups[group.id] !== false;
}

export function normalizeEventLimit(value: number | string): number {
  const limit = Number(value);
  if (!Number.isFinite(limit) || limit <= 0) {
    return DEFAULT_EVENT_LIMIT;
  }
  return Math.max(MIN_EVENT_LIMIT, Math.round(limit));
}

function eventSourceFromType(type: string): string {
  const source = type.split('.')[0]?.trim();
  if (source === undefined || source.length === 0) {
    return 'other';
  }
  return source;
}

function labelForEventSource(source: string): string {
  return source
    .split(/[-_]/)
    .filter((part) => part.length > 0)
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
    .join(' ');
}

function colorForEventSource(source: string): string {
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
  for (const char of source) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return palette[hash % palette.length] ?? '#2563eb';
}

function compareEventGroups(left: EventGroup, right: EventGroup): number {
  if (left.id === 'rpc') {
    return -1;
  }
  if (right.id === 'rpc') {
    return 1;
  }
  return left.label.localeCompare(right.label) || left.id.localeCompare(right.id);
}
