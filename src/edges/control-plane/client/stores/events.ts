import { acceptHMRUpdate, defineStore } from 'pinia';

import {
  defaultEventFilters,
  eventGroupFilterStateInState,
  eventGroupForEvent,
  eventGroupForType,
  eventTypesForGroupInState,
  filterableEventGroups,
  isEventEnabledInState,
  normalizeEventLimit
} from '../domain/events.js';
import {
  CONTROL_PLANE_STORAGE_KEYS,
  isPlainRecord,
  readStorage,
  writeStorage
} from './controlPlaneStorage.js';
import {
  DEFAULT_EVENT_LIMIT,
  EVENT_GROUPS,
  type ControlPlaneEvent,
  type EventFiltersState,
  type EventsPanelMode
} from './controlPlaneTypes.js';

type EventsState = {
  eventFilters: EventFiltersState;
  eventLimit: number;
  events: ControlPlaneEvent[];
  eventsPanelMode: EventsPanelMode;
};

export const useEventsStore = defineStore('controlPlane.events', {
  actions: {
    clearEvents() {
      this.events = [];
    },
    isEventEnabled(event: ControlPlaneEvent): boolean {
      return isEventEnabledInState(this, event);
    },
    pushEvent(event: ControlPlaneEvent): boolean {
      if (!isEventEnabledInState(this, event)) {
        return false;
      }
      this.events = [event, ...this.events].slice(0, this.eventLimit);
      return true;
    },
    setEventGroupEnabled(groupId: string, enabled: boolean) {
      const group = EVENT_GROUPS.find((item) => item.id === groupId);
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
      this.events = events.slice(0, this.eventLimit);
    },
    setEventsPanelMode(mode: EventsPanelMode) {
      this.eventsPanelMode = mode === 'filters' ? 'filters' : 'events';
    },
    toggleEventsPanelMode() {
      this.eventsPanelMode = this.eventsPanelMode === 'filters' ? 'events' : 'filters';
    }
  },
  state: (): EventsState => ({
    eventFilters: readStoredEventFilters(),
    eventLimit: readStoredEventLimit(),
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
      for (const group of filterableEventGroups()) {
        const enabled = parsed.groups[group.id];
        if (typeof enabled === 'boolean') {
          filters.groups[group.id] = enabled;
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

function writeStoredEventFilters(filters: EventFiltersState): void {
  writeStorage(
    CONTROL_PLANE_STORAGE_KEYS.eventFilters,
    JSON.stringify({
      groups: Object.fromEntries(
        filterableEventGroups().map((group) => [group.id, filters.groups[group.id] !== false])
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
