import { describe, expect, it } from 'vitest';

import { applyHistoryTimelineEvent } from '../../src/control-plane/selectedHistoryEvents.js';
import type { ControlPlaneEvent, SelectedHistoryState } from '../../src/control-plane/views.js';

describe('selected history event reducer', () => {
  it('adds coverage intervals for the selected chat and recomputes missing coverage', () => {
    const state = selectedHistoryState({
      targets: [
        target({
          endAt: '2026-05-01T10:00:00.000Z',
          id: 'target-a',
          startAt: '2026-05-01T00:00:00.000Z'
        })
      ]
    });

    expect(
      applyHistoryTimelineEvent(
        state,
        event('history.coverage.changed', {
          intervals: [
            {
              chatId: 'chat-a',
              endAt: '2026-05-01T04:00:00.000Z',
              startAt: '2026-05-01T00:00:00.000Z'
            },
            {
              chatId: 'chat-b',
              endAt: '2026-05-01T10:00:00.000Z',
              startAt: '2026-05-01T00:00:00.000Z'
            }
          ]
        })
      )
    ).toBe(true);

    expect(state.coverage).toEqual([
      {
        endAt: '2026-05-01T04:00:00.000Z',
        startAt: '2026-05-01T00:00:00.000Z'
      }
    ]);
    expect(state.desired).toEqual([
      {
        endAt: '2026-05-01T10:00:00.000Z',
        startAt: '2026-05-01T00:00:00.000Z'
      }
    ]);
    expect(state.missing).toEqual([
      {
        endAt: '2026-05-01T10:00:00.000Z',
        startAt: '2026-05-01T04:00:00.000Z'
      }
    ]);
  });

  it('upserts and deletes selected chat targets without changing other chats', () => {
    const state = selectedHistoryState();

    expect(
      applyHistoryTimelineEvent(
        state,
        event('history.target.upserted', {
          target: target({
            chatId: 'chat-b',
            endAt: '2026-05-01T10:00:00.000Z',
            id: 'target-b',
            startAt: '2026-05-01T00:00:00.000Z'
          })
        })
      )
    ).toBe(false);
    expect(state.targets).toEqual([]);

    expect(
      applyHistoryTimelineEvent(
        state,
        event('history.target.upserted', {
          target: target({
            endAt: '2026-05-01T10:00:00.000Z',
            id: 'target-a',
            startAt: '2026-05-01T00:00:00.000Z'
          })
        })
      )
    ).toBe(true);
    expect(state.targets.map((item) => item.id)).toEqual(['target-a']);
    expect(state.desired).toEqual([
      {
        endAt: '2026-05-01T10:00:00.000Z',
        startAt: '2026-05-01T00:00:00.000Z'
      }
    ]);

    expect(
      applyHistoryTimelineEvent(
        state,
        event('history.target.deleted', {
          target: {
            chatId: 'chat-a',
            id: 'target-a'
          }
        })
      )
    ).toBe(true);
    expect(state.targets).toEqual([]);
    expect(state.desired).toEqual([]);
    expect(state.missing).toEqual([]);
  });

  it('applies job lifecycle events to the selected chat only', () => {
    const state = selectedHistoryState();

    expect(
      applyHistoryTimelineEvent(
        state,
        event('history.job.created', {
          chatId: 'chat-a',
          jobEnd: '2026-05-01T10:00:00.000Z',
          jobId: '42',
          jobStart: '2026-05-01T00:00:00.000Z'
        })
      )
    ).toBe(true);
    expect(state.jobs).toMatchObject([
      {
        endAt: '2026-05-01T10:00:00.000Z',
        id: '42',
        startAt: '2026-05-01T00:00:00.000Z',
        status: 'pending'
      }
    ]);

    expect(
      applyHistoryTimelineEvent(
        state,
        event('history.job.started', {
          chatId: 'chat-a',
          jobEnd: '2026-05-01T10:00:00.000Z',
          jobId: '42',
          jobStart: '2026-05-01T00:00:00.000Z'
        })
      )
    ).toBe(true);
    expect(state.jobs).toMatchObject([
      {
        endAt: '2026-05-01T10:00:00.000Z',
        id: '42',
        startAt: '2026-05-01T00:00:00.000Z',
        status: 'running'
      }
    ]);

    applyHistoryTimelineEvent(
      state,
      event('history.job.progress', {
        chatId: 'chat-a',
        cursorMessageId: 9001,
        jobEnd: '2026-05-01T06:00:00.000Z',
        jobId: '42',
        jobStart: '2026-05-01T00:00:00.000Z'
      })
    );
    expect(state.jobs[0]).toMatchObject({
      cursor: { messageId: 9001 },
      endAt: '2026-05-01T06:00:00.000Z',
      status: 'running'
    });

    applyHistoryTimelineEvent(
      state,
      event('history.job.failed', {
        chatId: 'chat-a',
        jobEnd: '2026-05-01T10:00:00.000Z',
        jobId: '42',
        jobStart: '2026-05-01T00:00:00.000Z'
      })
    );
    expect(state.jobs[0]).toMatchObject({
      endAt: '2026-05-01T06:00:00.000Z',
      status: 'pending'
    });

    applyHistoryTimelineEvent(
      state,
      event('history.coverage.changed', {
        intervals: [
          {
            chatId: 'chat-a',
            endAt: '2026-05-01T06:00:00.000Z',
            startAt: '2026-05-01T00:00:00.000Z'
          }
        ]
      })
    );
    expect(state.coverage[0]).toMatchObject({
      endAt: '2026-05-01T06:00:00.000Z',
      startAt: '2026-05-01T00:00:00.000Z'
    });
    expect(state.coverage[0]?.messageCount).toBeUndefined();

    expect(
      applyHistoryTimelineEvent(
        state,
        event('history.job.completed', {
          chatId: 'chat-b',
          jobEnd: '2026-05-01T06:00:00.000Z',
          jobId: '42',
          jobStart: '2026-05-01T00:00:00.000Z'
        })
      )
    ).toBe(false);
    expect(state.jobs).toHaveLength(1);

    expect(
      applyHistoryTimelineEvent(
        state,
        event('history.job.completed', {
          chatId: 'chat-a',
          jobEnd: '2026-05-01T06:00:00.000Z',
          jobId: '42',
          jobStart: '2026-05-01T00:00:00.000Z',
          reachedBeginning: true,
          storedMessages: 30
        })
      )
    ).toBe(true);
    expect(state.jobs).toEqual([]);
    expect(state.coverage[0]?.messageCount).toBe(30);
    expect(state.chat?.historyBeginningReached).toBe(true);
  });

  it('preserves adjacent coverage counts when a completed gap job merges intervals', () => {
    const state = selectedHistoryState({
      coverage: [
        {
          endAt: '2026-05-01T01:00:00.000Z',
          messageCount: 0,
          startAt: '2026-05-01T00:00:00.000Z'
        },
        {
          endAt: '2026-05-01T03:00:00.000Z',
          messageCount: 43,
          startAt: '2026-05-01T02:00:00.000Z'
        }
      ],
      jobs: [
        {
          endAt: '2026-05-01T02:00:00.000Z',
          id: 'gap-job',
          startAt: '2026-05-01T01:00:00.000Z',
          status: 'running',
          updatedAt: '2026-05-01T12:00:00.000Z'
        }
      ]
    });

    applyHistoryTimelineEvent(
      state,
      event('history.coverage.changed', {
        intervals: [
          {
            chatId: 'chat-a',
            endAt: '2026-05-01T02:00:00.000Z',
            startAt: '2026-05-01T01:00:00.000Z'
          }
        ]
      })
    );

    expect(state.coverage).toEqual([
      {
        endAt: '2026-05-01T03:00:00.000Z',
        messageCount: 43,
        startAt: '2026-05-01T00:00:00.000Z'
      }
    ]);

    applyHistoryTimelineEvent(
      state,
      event('history.job.completed', {
        chatId: 'chat-a',
        jobEnd: '2026-05-01T02:00:00.000Z',
        jobId: 'gap-job',
        jobStart: '2026-05-01T01:00:00.000Z',
        storedMessages: 0
      })
    );

    expect(state.jobs).toEqual([]);
    expect(state.coverage).toEqual([
      {
        endAt: '2026-05-01T03:00:00.000Z',
        messageCount: 43,
        startAt: '2026-05-01T00:00:00.000Z'
      }
    ]);
  });

  it('updates the selected chat history start when a job reaches the beginning', () => {
    const state = selectedHistoryState({
      coverage: [
        {
          endAt: '2026-05-01T06:00:00.000Z',
          startAt: '2013-08-14T00:00:00.000Z'
        }
      ],
      jobs: [
        {
          endAt: '2026-05-01T06:00:00.000Z',
          id: 'beginning-job',
          startAt: '2013-08-14T00:00:00.000Z',
          status: 'running',
          updatedAt: '2026-05-01T12:00:00.000Z'
        }
      ],
      targets: [
        target({
          endAt: '2026-05-01T10:00:00.000Z',
          id: 'target-a',
          startAt: '2013-08-14T00:00:00.000Z'
        })
      ]
    });

    expect(
      applyHistoryTimelineEvent(
        state,
        event('history.job.completed', {
          chatId: 'chat-a',
          historyStartAt: '2026-04-30T22:00:00.000Z',
          jobEnd: '2026-05-01T06:00:00.000Z',
          jobId: 'beginning-job',
          jobStart: '2013-08-14T00:00:00.000Z',
          reachedBeginning: true,
          storedMessages: 12
        })
      )
    ).toBe(true);

    expect(state.chat).toMatchObject({
      historyBeginningReached: true,
      historyStartAt: '2026-04-30T22:00:00.000Z'
    });
    expect(state.coverage).toEqual([
      {
        endAt: '2026-05-01T06:00:00.000Z',
        messageCount: 12,
        startAt: '2026-04-30T22:00:00.000Z'
      }
    ]);
    expect(state.desired).toEqual([
      {
        endAt: '2026-05-01T10:00:00.000Z',
        startAt: '2026-04-30T22:00:00.000Z'
      }
    ]);
    expect(state.missing).toEqual([
      {
        endAt: '2026-05-01T10:00:00.000Z',
        startAt: '2026-05-01T06:00:00.000Z'
      }
    ]);
  });
});

function selectedHistoryState(overrides: Partial<SelectedHistoryState> = {}): SelectedHistoryState {
  return {
    chat: {
      historyBeginningReached: false,
      historyStartAt: null,
      id: 'chat-a',
      isBot: false,
      messageCount: 0,
      title: 'Chat A',
      type: 'private',
      updatedAt: '2026-05-01T00:00:00.000Z'
    },
    coverage: [],
    desired: [],
    jobs: [],
    missing: [],
    targets: [],
    ...overrides
  };
}

function target(input: {
  chatId?: string;
  endAt: string;
  id: string;
  startAt: string;
}): SelectedHistoryState['targets'][number] {
  return {
    chatId: input.chatId ?? 'chat-a',
    id: input.id,
    projected: {
      endAt: input.endAt,
      startAt: input.startAt
    },
    range: {
      end: {
        at: input.endAt,
        kind: 'absolute'
      },
      start: {
        at: input.startAt,
        kind: 'absolute'
      }
    },
    templateId: null
  };
}

function event(type: string, data: unknown): ControlPlaneEvent {
  return {
    data,
    id: type,
    occurredAt: '2026-05-01T12:00:00.000Z',
    type
  };
}
