import { acceptHMRUpdate, defineStore } from 'pinia';

import {
  defaultEventFilters,
  eventGroupFilterStateInState,
  eventGroupForEvent,
  eventGroupForType,
  eventTypesForGroupInState,
  filterableEventGroupsInState,
  isEventEnabledInState,
  isEventTypeEnabledInState,
  normalizeEventLimit,
  normalizeEventYamlListLimit
} from '../domain/events.js';
import {
  CONTROL_PLANE_STORAGE_KEYS,
  isPlainRecord,
  readStoredBoolean,
  readStorage,
  writeStorage
} from './controlPlaneStorage.js';
import {
  DEFAULT_EVENT_LIMIT,
  DEFAULT_EVENT_YAML_LIST_LIMIT,
  type ControlPlaneEvent,
  type ControlPlaneStreamEvent,
  type EventCatalogState,
  type EventFiltersState,
  type EventsPanelMode
} from './controlPlaneTypes.js';

type EventsState = {
  eventCatalog: EventCatalogState;
  eventFilters: EventFiltersState;
  eventLimit: number;
  eventYamlListLimit: number;
  eventsPaused: boolean;
  events: ControlPlaneStreamEvent[];
  eventsPanelMode: EventsPanelMode;
};

export const useEventsStore = defineStore('controlPlane.events', {
  actions: {
    clearEvents() {
      this.events = [];
    },
    setEventCatalog(catalog: EventCatalogState) {
      this.eventCatalog = catalog;
    },
    isEventEnabled(event: ControlPlaneEvent): boolean {
      return isEventEnabledInState(this, event);
    },
    isEventTypeMuted(type: string): boolean {
      const group = eventGroupForType(type);
      return group.filterable !== false && !isEventTypeEnabledInState(this, group, type);
    },
    pushEvent(event: ControlPlaneEvent): boolean {
      if (this.eventsPaused) {
        return false;
      }
      if (!isEventEnabledInState(this, event)) {
        return false;
      }
      this.events = [eventStreamSnapshot(event, this.eventYamlListLimit), ...this.events].slice(
        0,
        this.eventLimit
      );
      return true;
    },
    setEventGroupEnabled(groupId: string, enabled: boolean) {
      const group = filterableEventGroupsInState(this).find((item) => item.id === groupId);
      if (!group || group.filterable === false) {
        return;
      }
      this.eventFilters.groups[groupId] = enabled;
      for (const type of eventTypesForGroupInState(this, group)) {
        this.eventFilters.types[type] = enabled;
      }
      writeStoredEventFilters(this.eventFilters);
      if (!enabled) {
        this.events = this.events.filter((event) => eventGroupForEvent(event).id !== groupId);
      }
    },
    setEventLimit(value: number | string) {
      this.eventLimit = normalizeEventLimit(value);
      writeStorage(CONTROL_PLANE_STORAGE_KEYS.eventLimit, String(this.eventLimit));
      this.events = this.events.slice(0, this.eventLimit);
    },
    setEventYamlListLimit(value: number | string) {
      this.eventYamlListLimit = normalizeEventYamlListLimit(value);
      writeStorage(CONTROL_PLANE_STORAGE_KEYS.eventYamlListLimit, String(this.eventYamlListLimit));
    },
    setEventTypeEnabled(type: string, enabled: boolean) {
      const group = eventGroupForType(type);
      if (group.filterable === false) {
        return;
      }
      this.eventFilters.types[type] = enabled;
      const groupState = eventGroupFilterStateInState(this, group);
      this.eventFilters.groups[group.id] = groupState.checked || groupState.indeterminate;
      writeStoredEventFilters(this.eventFilters);
      if (!enabled) {
        this.events = this.events.filter((event) => (event.type ?? '') !== type);
      }
    },
    setEvents(events: ControlPlaneEvent[]) {
      this.events = events
        .map((event) => eventStreamSnapshot(event, this.eventYamlListLimit))
        .slice(0, this.eventLimit);
    },
    setEventTypeMuted(type: string, muted: boolean) {
      if (type.length === 0) {
        return;
      }
      const group = eventGroupForType(type);
      if (group.filterable === false) {
        return;
      }
      this.eventFilters.types[type] = !muted;
      const groupState = eventGroupFilterStateInState(this, group);
      this.eventFilters.groups[group.id] = groupState.checked || groupState.indeterminate;
      writeStoredEventFilters(this.eventFilters);
    },
    clearEventsOfType(type: string) {
      this.events = this.events.filter((event) => (event.type ?? '') !== type);
    },
    setEventsPaused(paused: boolean) {
      this.eventsPaused = paused;
      writeStoredEventsPaused(paused);
    },
    setEventsPanelMode(mode: EventsPanelMode) {
      this.eventsPanelMode = mode;
    },
    toggleEventsPaused() {
      this.setEventsPaused(!this.eventsPaused);
    },
    toggleEventsPanelMode(mode: Exclude<EventsPanelMode, 'events'>) {
      this.eventsPanelMode = this.eventsPanelMode === mode ? 'events' : mode;
    }
  },
  state: (): EventsState => ({
    eventCatalog: {
      services: [],
      version: 0
    },
    eventFilters: readStoredEventFilters(),
    eventLimit: readStoredEventLimit(),
    eventYamlListLimit: readStoredEventYamlListLimit(),
    eventsPaused: readStoredBoolean(CONTROL_PLANE_STORAGE_KEYS.eventsPaused, false),
    events: [],
    eventsPanelMode: 'events'
  })
});

function readStoredEventFilters(): EventFiltersState {
  const filters = defaultEventFilters();
  const raw = readStorage(CONTROL_PLANE_STORAGE_KEYS.eventFilters);
  if (raw === null) {
    return filters;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isPlainRecord(parsed)) {
      return filters;
    }
    if (isPlainRecord(parsed.groups)) {
      for (const [groupId, enabled] of Object.entries(parsed.groups)) {
        if (typeof enabled === 'boolean') {
          filters.groups[groupId] = enabled;
        }
      }
    }
    if (isPlainRecord(parsed.types)) {
      for (const [type, enabled] of Object.entries(parsed.types)) {
        if (typeof enabled === 'boolean' && eventGroupForType(type).filterable !== false) {
          filters.types[type] = enabled;
        }
      }
    }
  } catch {
    return filters;
  }
  return filters;
}

function readStoredEventLimit(): number {
  return normalizeEventLimit(
    readStorage(CONTROL_PLANE_STORAGE_KEYS.eventLimit) ?? DEFAULT_EVENT_LIMIT
  );
}

function readStoredEventYamlListLimit(): number {
  return normalizeEventYamlListLimit(
    readStorage(CONTROL_PLANE_STORAGE_KEYS.eventYamlListLimit) ?? DEFAULT_EVENT_YAML_LIST_LIMIT
  );
}

function writeStoredEventsPaused(paused: boolean): void {
  writeStorage(CONTROL_PLANE_STORAGE_KEYS.eventsPaused, paused ? '1' : '0');
}

function eventStreamSnapshot(
  event: ControlPlaneEvent,
  yamlListItemLimit: number
): ControlPlaneStreamEvent {
  return {
    ...event,
    yamlListItemLimit
  };
}

function writeStoredEventFilters(filters: EventFiltersState): void {
  writeStorage(
    CONTROL_PLANE_STORAGE_KEYS.eventFilters,
    JSON.stringify({
      groups: Object.fromEntries(
        Object.entries(filters.groups).filter(([, enabled]) => typeof enabled === 'boolean')
      ),
      types: Object.fromEntries(
        Object.entries(filters.types).filter(
          ([type]) => eventGroupForType(type).filterable !== false
        )
      )
    })
  );
}

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useEventsStore, import.meta.hot));
}
