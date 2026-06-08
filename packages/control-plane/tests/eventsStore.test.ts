import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CONTROL_PLANE_STORAGE_KEYS } from '../src/stores/controlPlaneStorage.js';
import { useEventsStore } from '../src/stores/events.js';
import {
  DEFAULT_EVENT_YAML_LIST_LIMIT,
  type ControlPlaneEvent
} from '../src/stores/controlPlaneTypes.js';

describe('events store', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      removeItem: vi.fn(),
      setItem: vi.fn()
    });
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts unpaused and drops incoming panel events while paused', () => {
    const store = useEventsStore();
    const firstEvent = event('beta.sync.started');
    const pausedEvent = event('beta.sync.completed');
    const resumedEvent = event('beta.sync.failed');

    expect(store.eventsPaused).toBe(false);
    expect(store.pushEvent(firstEvent)).toBe(true);

    store.toggleEventsPaused();

    expect(store.eventsPaused).toBe(true);
    expect(store.pushEvent(pausedEvent)).toBe(false);
    expect(store.events.map((item) => item.type)).toEqual(['beta.sync.started']);

    store.toggleEventsPaused();

    expect(store.eventsPaused).toBe(false);
    expect(store.pushEvent(resumedEvent)).toBe(true);
    expect(store.events.map((item) => item.type)).toEqual([
      'beta.sync.failed',
      'beta.sync.started'
    ]);
  });

  it('persists and restores the paused state', () => {
    const storage = localStorage as Storage & {
      getItem: ReturnType<typeof vi.fn>;
      setItem: ReturnType<typeof vi.fn>;
    };

    vi.mocked(storage.getItem).mockImplementation((key: string) =>
      key === CONTROL_PLANE_STORAGE_KEYS.eventsPaused ? '1' : null
    );

    const store = useEventsStore();

    vi.mocked(storage.setItem).mockClear();

    expect(store.eventsPaused).toBe(true);

    store.setEventsPaused(false);

    expect(storage.setItem).toHaveBeenCalledWith(CONTROL_PLANE_STORAGE_KEYS.eventsPaused, '0');
  });

  it('keeps all event types while stream is running', () => {
    const store = useEventsStore();
    const firstEvent = event('alpha.status');
    const otherEvent = event('beta.sync.started');

    expect(store.pushEvent(firstEvent)).toBe(true);
    expect(store.pushEvent(otherEvent)).toBe(true);
    expect(store.events.map((item) => item.type)).toEqual(['beta.sync.started', 'alpha.status']);
  });

  it('persists positive event limits without an upper cap and trims current events', () => {
    const store = useEventsStore();
    const storage = localStorage as Storage & {
      setItem: ReturnType<typeof vi.fn>;
    };

    store.setEvents([
      event('beta.sync.failed'),
      event('beta.sync.completed'),
      event('beta.sync.started')
    ]);

    store.setEventLimit(2);

    expect(store.eventLimit).toBe(2);
    expect(storage.setItem).toHaveBeenCalledWith(CONTROL_PLANE_STORAGE_KEYS.eventLimit, '2');
    expect(store.events.map((item) => item.type)).toEqual([
      'beta.sync.failed',
      'beta.sync.completed'
    ]);

    store.setEventLimit(2501);

    expect(store.eventLimit).toBe(2501);
    expect(storage.setItem).toHaveBeenCalledWith(CONTROL_PLANE_STORAGE_KEYS.eventLimit, '2501');
  });

  it('persists positive YAML list item limits without trimming current events', () => {
    const store = useEventsStore();
    const storage = localStorage as Storage & {
      setItem: ReturnType<typeof vi.fn>;
    };

    store.setEvents([event('beta.sync.failed'), event('beta.sync.completed')]);

    expect(store.eventYamlListLimit).toBe(DEFAULT_EVENT_YAML_LIST_LIMIT);

    store.setEventYamlListLimit(5);

    expect(store.eventYamlListLimit).toBe(5);
    expect(storage.setItem).toHaveBeenCalledWith(
      CONTROL_PLANE_STORAGE_KEYS.eventYamlListLimit,
      '5'
    );
    expect(store.events.map((item) => item.type)).toEqual([
      'beta.sync.failed',
      'beta.sync.completed'
    ]);
  });

  it('snapshots YAML list item limits onto stream events', () => {
    const store = useEventsStore();

    store.setEventYamlListLimit(5);
    expect(store.pushEvent(event('beta.sync.started'))).toBe(true);

    store.setEventYamlListLimit(2);
    expect(store.pushEvent(event('beta.sync.completed'))).toBe(true);

    expect(store.events.map((item) => item.type)).toEqual([
      'beta.sync.completed',
      'beta.sync.started'
    ]);
    expect(store.events.map((item) => item.yamlListItemLimit)).toEqual([2, 5]);
  });
});

function event(type: string): ControlPlaneEvent {
  return {
    id: `event-${type}`,
    occurredAt: '2026-05-05T00:00:00.000Z',
    type
  };
}
