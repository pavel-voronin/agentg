import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CONTROL_PLANE_STORAGE_KEYS } from '../src/stores/controlPlaneStorage.js';
import { useEventsStore } from '../src/stores/events.js';
import type { ControlPlaneEvent } from '../src/stores/controlPlaneTypes.js';

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

  it('does not persist the paused state', () => {
    const store = useEventsStore();
    const storage = localStorage as Storage & {
      setItem: ReturnType<typeof vi.fn>;
    };

    vi.mocked(storage.setItem).mockClear();

    store.setEventsPaused(true);

    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('mutes future events without removing existing events of that type', () => {
    const store = useEventsStore();
    const firstEvent = event('alpha.status');
    const mutedEvent = event('alpha.status');
    const otherEvent = event('beta.sync.started');
    const storage = localStorage as Storage & {
      setItem: ReturnType<typeof vi.fn>;
    };

    expect(store.pushEvent(firstEvent)).toBe(true);

    store.setEventTypeMuted('alpha.status', true);

    expect(store.isEventTypeMuted('alpha.status')).toBe(true);
    expect(store.eventFilters.types['alpha.status']).toBe(false);
    expect(storage.setItem).toHaveBeenCalled();
    expect(store.events.map((item) => item.type)).toEqual(['alpha.status']);
    expect(store.pushEvent(mutedEvent)).toBe(false);
    expect(store.pushEvent(otherEvent)).toBe(true);
    expect(store.events.map((item) => item.type)).toEqual(['beta.sync.started', 'alpha.status']);

    store.setEventTypeMuted('alpha.status', false);

    expect(store.isEventTypeMuted('alpha.status')).toBe(false);
    expect(store.eventFilters.types['alpha.status']).toBe(true);
    expect(store.pushEvent(mutedEvent)).toBe(true);
    expect(store.events.map((item) => item.type)).toEqual([
      'alpha.status',
      'beta.sync.started',
      'alpha.status'
    ]);
  });

  it('clears muted event types only when explicitly requested', () => {
    const store = useEventsStore();

    store.setEvents([event('alpha.status'), event('beta.sync.started'), event('alpha.status')]);
    store.setEventTypeMuted('alpha.status', true);

    expect(store.events.map((item) => item.type)).toEqual([
      'alpha.status',
      'beta.sync.started',
      'alpha.status'
    ]);

    store.clearEventsOfType('alpha.status');

    expect(store.events.map((item) => item.type)).toEqual(['beta.sync.started']);
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
});

function event(type: string): ControlPlaneEvent {
  return {
    id: `event-${type}`,
    occurredAt: '2026-05-05T00:00:00.000Z',
    type
  };
}
