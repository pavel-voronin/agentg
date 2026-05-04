import {
  DEFAULT_EVENT_LIMIT,
  EVENT_GROUPS,
  MAX_EVENT_LIMIT,
  MIN_EVENT_LIMIT,
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
    groups: Object.fromEntries(EVENT_GROUPS.map((group) => [group.id, true])),
    types: {}
  };
}

export function enabledEventFiltersCountInState(state: EventFilterSource): number {
  return filterableEventGroups().reduce(
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
  const fallbackGroup = EVENT_GROUPS.at(-1);
  if (fallbackGroup === undefined) {
    throw new Error('EVENT_GROUPS must contain a fallback group');
  }
  return EVENT_GROUPS.find((group) => group.match(type)) ?? fallbackGroup;
}

export function eventTypesForGroupInState(state: EventFilterSource, group: EventGroup): string[] {
  const observed = state.events
    .filter((event) => eventGroupForEvent(event).id === group.id)
    .map((event) => event.type ?? 'unknown');
  const configured = Object.keys(state.eventFilters.types).filter(
    (type) => eventGroupForType(type).id === group.id
  );
  return [...new Set([...group.eventTypes, ...observed, ...configured])].sort();
}

export function filterableEventGroups(): EventGroup[] {
  return EVENT_GROUPS.filter((group) => group.filterable !== false);
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
  if (!Number.isFinite(limit)) {
    return DEFAULT_EVENT_LIMIT;
  }
  return Math.min(MAX_EVENT_LIMIT, Math.max(MIN_EVENT_LIMIT, Math.round(limit)));
}
