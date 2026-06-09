import { acceptHMRUpdate, defineStore } from 'pinia';

import { normalizeEventLimit, normalizeEventYamlListLimit } from '../domain/events.js';
import {
  DASHBOARD_STORAGE_KEYS,
  readStoredBoolean,
  readStorage,
  writeStorage
} from './dashboardStorage.js';
import {
  DEFAULT_EVENT_LIMIT,
  DEFAULT_EVENT_YAML_LIST_LIMIT,
  type DashboardEvent,
  type DashboardStreamEvent,
  type EventsPanelMode
} from './dashboardTypes.js';

type EventsState = {
  eventLimit: number;
  eventYamlListLimit: number;
  eventsPaused: boolean;
  events: DashboardStreamEvent[];
  eventsPanelMode: EventsPanelMode;
};

export const useEventsStore = defineStore('dashboard.events', {
  actions: {
    clearEvents() {
      this.events = [];
    },
    pushEvent(event: DashboardEvent): boolean {
      if (this.eventsPaused) {
        return false;
      }
      this.events = [eventStreamSnapshot(event, this.eventYamlListLimit), ...this.events].slice(
        0,
        this.eventLimit
      );
      return true;
    },
    setEventLimit(value: number | string) {
      this.eventLimit = normalizeEventLimit(value);
      writeStorage(DASHBOARD_STORAGE_KEYS.eventLimit, String(this.eventLimit));
      this.events = this.events.slice(0, this.eventLimit);
    },
    setEventYamlListLimit(value: number | string) {
      this.eventYamlListLimit = normalizeEventYamlListLimit(value);
      writeStorage(DASHBOARD_STORAGE_KEYS.eventYamlListLimit, String(this.eventYamlListLimit));
    },
    setEvents(events: DashboardEvent[]) {
      this.events = events
        .map((event) => eventStreamSnapshot(event, this.eventYamlListLimit))
        .slice(0, this.eventLimit);
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
    eventLimit: readStoredEventLimit(),
    eventYamlListLimit: readStoredEventYamlListLimit(),
    eventsPaused: readStoredBoolean(DASHBOARD_STORAGE_KEYS.eventsPaused, false),
    events: [],
    eventsPanelMode: 'events'
  })
});

function readStoredEventLimit(): number {
  return normalizeEventLimit(readStorage(DASHBOARD_STORAGE_KEYS.eventLimit) ?? DEFAULT_EVENT_LIMIT);
}

function readStoredEventYamlListLimit(): number {
  return normalizeEventYamlListLimit(
    readStorage(DASHBOARD_STORAGE_KEYS.eventYamlListLimit) ?? DEFAULT_EVENT_YAML_LIST_LIMIT
  );
}

function writeStoredEventsPaused(paused: boolean): void {
  writeStorage(DASHBOARD_STORAGE_KEYS.eventsPaused, paused ? '1' : '0');
}

function eventStreamSnapshot(
  event: DashboardEvent,
  yamlListItemLimit: number
): DashboardStreamEvent {
  return {
    ...event,
    yamlListItemLimit
  };
}

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useEventsStore, import.meta.hot));
}
