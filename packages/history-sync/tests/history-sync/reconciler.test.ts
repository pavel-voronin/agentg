import { describe, expect, it } from 'vitest';

import { TELEGRAM_HISTORY_PAST_BOUNDARY } from '../../src/constants.js';
import { isOneShotHistorySyncTarget, projectSyncIntervalsForChat } from '../../src/reconciler.js';
import { absoluteBoundary, expressionBoundary, historySyncRange } from '../../src/ranges.js';
import type { HistorySyncTarget } from '../../src/types.js';

describe('history sync projection', () => {
  it('projects an absolute target to a Telegram interval', () => {
    expect(project({ targets: [target('2026-01-01', '2026-01-31')] })).toEqual([
      interval('2026-01-01', '2026-01-31')
    ]);
  });

  it('uses the union of multiple targets for the same chat', () => {
    expect(
      project({
        targets: [target('2026-01-01', '2026-01-15'), target('2026-01-15', '2026-01-31')]
      })
    ).toEqual([interval('2026-01-01', '2026-01-31')]);
  });

  it('projects a relative target using the provided current time', () => {
    expect(
      project({
        targets: [
          {
            chatId,
            id: 'target-1',
            range: historySyncRange(expressionBoundary('now-30d'), expressionBoundary('now'))
          }
        ]
      })
    ).toEqual([interval('2026-03-29', '2026-04-28')]);
  });

  it('splits a large interval into sync windows', () => {
    expect(
      project({
        syncWindowMilliseconds: 10 * dayMilliseconds,
        targets: [target('2026-01-01', '2026-01-31')]
      })
    ).toEqual([
      interval('2026-01-21', '2026-01-31'),
      interval('2026-01-11', '2026-01-21'),
      interval('2026-01-01', '2026-01-11')
    ]);
  });

  it('normalizes intervals to Telegram-second boundaries', () => {
    expect(
      project({
        targets: [
          {
            chatId,
            id: 'target-1',
            range: historySyncRange(
              absoluteBoundary('2026-01-01T00:00:00.250Z'),
              absoluteBoundary('2026-01-01T00:00:01.250Z')
            )
          }
        ]
      })
    ).toEqual([intervalAt('2026-01-01T00:00:00.000Z', '2026-01-01T00:00:02.000Z')]);
  });

  it('identifies standalone absolute targets as one-shot targets', () => {
    expect(isOneShotHistorySyncTarget(target('2026-01-01', '2026-01-31'))).toBe(true);
    expect(
      isOneShotHistorySyncTarget({
        chatId,
        id: 'relative',
        range: historySyncRange(expressionBoundary('now-30d'), expressionBoundary('now'))
      })
    ).toBe(false);
    expect(
      isOneShotHistorySyncTarget({
        ...target('2026-01-01', '2026-01-31'),
        templateId: 'template-1'
      })
    ).toBe(false);
  });
});

const chatId = 'chat-a';
const dayMilliseconds = 24 * 60 * 60 * 1000;

function project(options: {
  now?: Date;
  syncWindowMilliseconds?: number;
  targets: HistorySyncTarget[];
}) {
  return projectSyncIntervalsForChat({
    chatId,
    literals: {
      past: TELEGRAM_HISTORY_PAST_BOUNDARY
    },
    now: options.now ?? date('2026-04-28'),
    targets: options.targets,
    ...(options.syncWindowMilliseconds === undefined
      ? {}
      : { syncWindowMilliseconds: options.syncWindowMilliseconds })
  });
}

function target(startAt: string, endAt: string): HistorySyncTarget {
  return {
    chatId,
    id: `${startAt}:${endAt}`,
    range: historySyncRange(absoluteBoundary(date(startAt)), absoluteBoundary(date(endAt)))
  };
}

function interval(startAt: string, endAt: string) {
  return intervalAt(`${startAt}T00:00:00.000Z`, `${endAt}T00:00:00.000Z`);
}

function intervalAt(startAt: string, endAt: string) {
  return {
    endAt: new Date(endAt),
    startAt: new Date(startAt)
  };
}

function date(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}
