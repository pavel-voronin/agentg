import { describe, expect, it } from 'vitest';

import { applyHistorySyncTimelineEvent } from '../../src/control-plane/selectedHistorySyncEvents.js';
import type { ControlPlaneEvent, SelectedHistorySyncState } from '../../src/control-plane/views.js';

describe('selected history events', () => {
  it('applies Telegram coverage changes to the selected chat', () => {
    const state = selectedState();

    expect(
      applyHistorySyncTimelineEvent(
        state,
        event('telegram.history.coverage.changed', {
          intervals: [
            {
              chat: { _model: 'telegram.chat', id: 'chat-a' },
              endAt: '2026-05-01T02:00:00.000Z',
              messageCount: 12,
              startAt: '2026-05-01T00:00:00.000Z'
            }
          ]
        })
      )
    ).toBe(true);

    expect(state.coverage).toEqual([
      {
        endAt: '2026-05-01T02:00:00.000Z',
        messageCount: 12,
        startAt: '2026-05-01T00:00:00.000Z'
      }
    ]);
  });

  it('ignores Telegram coverage changes for another chat', () => {
    const state = selectedState();

    expect(
      applyHistorySyncTimelineEvent(
        state,
        event('telegram.history.coverage.changed', {
          intervals: [
            {
              chat: { _model: 'telegram.chat', id: 'chat-b' },
              endAt: '2026-05-01T02:00:00.000Z',
              startAt: '2026-05-01T00:00:00.000Z'
            }
          ]
        })
      )
    ).toBe(false);

    expect(state.coverage).toEqual([]);
  });
});

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

function event(type: string, data: unknown): ControlPlaneEvent {
  return {
    data,
    type
  };
}
