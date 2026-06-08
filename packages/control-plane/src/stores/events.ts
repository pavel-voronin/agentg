import { acceptHMRUpdate, defineStore } from 'pinia';

import { normalizeEventLimit, normalizeEventYamlListLimit } from '../domain/events.js';
import {
  CONTROL_PLANE_STORAGE_KEYS,
  readStoredBoolean,
  readStorage,
  writeStorage
} from './controlPlaneStorage.js';
import {
  DEFAULT_EVENT_LIMIT,
  DEFAULT_EVENT_YAML_LIST_LIMIT,
  type ControlPlaneEvent,
  type ControlPlaneStreamEvent,
  type EventsPanelMode
} from './controlPlaneTypes.js';

type EventsState = {
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
    pushEvent(event: ControlPlaneEvent): boolean {
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
      writeStorage(CONTROL_PLANE_STORAGE_KEYS.eventLimit, String(this.eventLimit));
      this.events = this.events.slice(0, this.eventLimit);
    },
    setEventYamlListLimit(value: number | string) {
      this.eventYamlListLimit = normalizeEventYamlListLimit(value);
      writeStorage(CONTROL_PLANE_STORAGE_KEYS.eventYamlListLimit, String(this.eventYamlListLimit));
    },
    setEvents(events: ControlPlaneEvent[]) {
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
    eventsPaused: readStoredBoolean(CONTROL_PLANE_STORAGE_KEYS.eventsPaused, false),
    events: [],
    eventsPanelMode: 'events'
  })
});

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

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useEventsStore, import.meta.hot));
}
