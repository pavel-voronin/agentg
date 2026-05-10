import { ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';

import { useTimelineInteraction } from '../src/control-plane/timeline/useTimelineInteraction.js';
import type { SelectedHistorySyncState } from '../src/control-plane/views.js';

describe('timeline interaction', () => {
  it('creates a target from the clicked gap data range', () => {
    const onAddTarget = vi.fn();
    const interaction = useTimelineInteraction({
      data: ref(selectedState()),
      onAddTarget,
      onFreeformScale: vi.fn(),
      viewportDays: ref(30)
    });
    interaction.track.value = trackElement();
    const target = closestTarget('[data-gap-start][data-gap-end]', {
      getAttribute(name: string) {
        if (name === 'data-gap-start') return '2026-05-01T00:00:00.000Z';
        if (name === 'data-gap-end') return '2026-05-02T00:00:00.000Z';
        return null;
      }
    });

    interaction.onTrackPointerDown(pointerEvent({ clientX: 120, pointerId: 1, target }));
    interaction.onTrackPointerUp(pointerEvent({ clientX: 120, pointerId: 1, target }));

    expect(onAddTarget).toHaveBeenCalledTimes(1);
    expect(onAddTarget).toHaveBeenCalledWith(
      '2026-05-01T00:00:00.000Z',
      '2026-05-02T00:00:00.000Z'
    );
  });

  it('does not create a drag target from coverage without Alt intent', () => {
    const onAddTarget = vi.fn();
    const interaction = useTimelineInteraction({
      data: ref(selectedState()),
      onAddTarget,
      onFreeformScale: vi.fn(),
      viewportDays: ref(30)
    });
    interaction.track.value = trackElement();
    const target = closestTarget('[data-kind="coverage"]', {});

    interaction.onTrackPointerDown(pointerEvent({ clientX: 40, pointerId: 1, target }));
    interaction.onTrackPointerUp(pointerEvent({ clientX: 120, pointerId: 1, target }));

    expect(onAddTarget).not.toHaveBeenCalled();
  });
});

function closestTarget(
  selector: string,
  element: object
): { closest: (input: string) => object | null } {
  return {
    closest(input: string) {
      return input === selector ? element : null;
    }
  };
}

function pointerEvent(input: { clientX: number; pointerId: number; target: unknown }): Event {
  return {
    altKey: false,
    button: 0,
    clientX: input.clientX,
    clientY: 0,
    pointerId: input.pointerId,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    target: input.target
  } as unknown as Event;
}

function selectedState(): SelectedHistorySyncState {
  return {
    chat: {
      historySyncBeginningReached: false,
      historySyncStartAt: null,
      id: 'chat-a',
      isBot: false,
      messageCount: 0,
      title: 'Saved Messages',
      type: 'private',
      updatedAt: '2026-05-01T00:00:00.000Z'
    },
    coverage: [],
    desired: [],
    missing: [],
    targets: []
  };
}

function trackElement(): {
  getBoundingClientRect: () => { height: number; left: number; top: number; width: number };
  releasePointerCapture: () => void;
  setPointerCapture: () => void;
} {
  return {
    getBoundingClientRect() {
      return {
        height: 48,
        left: 0,
        top: 0,
        width: 300
      };
    },
    releasePointerCapture: vi.fn(),
    setPointerCapture: vi.fn()
  };
}
