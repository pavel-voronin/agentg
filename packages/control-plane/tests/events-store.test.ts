import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    const firstEvent = event('history.sync.started');
    const pausedEvent = event('history.sync.completed');
    const resumedEvent = event('history.sync.failed');

    expect(store.eventsPaused).toBe(false);
    expect(store.pushEvent(firstEvent)).toBe(true);

    store.toggleEventsPaused();

    expect(store.eventsPaused).toBe(true);
    expect(store.pushEvent(pausedEvent)).toBe(false);
    expect(store.events.map((item) => item.type)).toEqual(['history.sync.started']);

    store.toggleEventsPaused();

    expect(store.eventsPaused).toBe(false);
    expect(store.pushEvent(resumedEvent)).toBe(true);
    expect(store.events.map((item) => item.type)).toEqual([
      'history.sync.failed',
      'history.sync.started'
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
});

function event(type: string): ControlPlaneEvent {
  return {
    id: `event-${type}`,
    occurredAt: '2026-05-05T00:00:00.000Z',
    type
  };
}
