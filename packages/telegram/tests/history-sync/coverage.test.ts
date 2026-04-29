import { describe, expect, it } from 'vitest';

import { addCoverageFromLiveUpdate, addCoverageInterval } from '../../src/history-sync/coverage.js';
import type { HistoryCoverageInterval } from '../../src/history-sync/types.js';

describe('history coverage', () => {
  it('creates the first coverage interval for a chat', () => {
    expect(addCoverageInterval([], interval('chat-a', '2026-01-01', '2026-01-02'))).toEqual([
      interval('chat-a', '2026-01-01', '2026-01-02')
    ]);
  });

  it('keeps separated intervals separate', () => {
    expect(
      addCoverageInterval(
        [interval('chat-a', '2026-01-01', '2026-01-02')],
        interval('chat-a', '2026-01-03', '2026-01-04')
      )
    ).toEqual([
      interval('chat-a', '2026-01-01', '2026-01-02'),
      interval('chat-a', '2026-01-03', '2026-01-04')
    ]);
  });

  it('merges overlapping intervals for the same chat', () => {
    expect(
      addCoverageInterval(
        [interval('chat-a', '2026-01-01', '2026-01-10')],
        interval('chat-a', '2026-01-05', '2026-01-12')
      )
    ).toEqual([interval('chat-a', '2026-01-01', '2026-01-12')]);
  });

  it('merges touching intervals for the same chat', () => {
    expect(
      addCoverageInterval(
        [interval('chat-a', '2026-01-01', '2026-01-10')],
        interval('chat-a', '2026-01-10', '2026-01-12')
      )
    ).toEqual([interval('chat-a', '2026-01-01', '2026-01-12')]);
  });

  it('normalizes coverage to Telegram-second boundaries', () => {
    expect(
      addCoverageInterval(
        [],
        intervalAt('chat-a', '2026-01-01T00:00:00.250Z', '2026-01-01T00:00:01.250Z')
      )
    ).toEqual([intervalAt('chat-a', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:02.000Z')]);
  });

  it('merges coverage intervals separated by one Telegram tick', () => {
    expect(
      addCoverageInterval(
        [intervalAt('chat-a', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:05.000Z')],
        intervalAt('chat-a', '2026-01-01T00:00:06.000Z', '2026-01-01T00:00:10.000Z')
      )
    ).toEqual([intervalAt('chat-a', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:10.000Z')]);
  });

  it('bridges two existing intervals when new coverage fills the gap', () => {
    expect(
      addCoverageInterval(
        [
          interval('chat-a', '2026-01-01', '2026-01-05'),
          interval('chat-a', '2026-01-10', '2026-01-15')
        ],
        interval('chat-a', '2026-01-05', '2026-01-10')
      )
    ).toEqual([interval('chat-a', '2026-01-01', '2026-01-15')]);
  });

  it('does not merge intervals from different chats', () => {
    expect(
      addCoverageInterval(
        [interval('chat-b', '2026-01-01', '2026-01-10')],
        interval('chat-a', '2026-01-05', '2026-01-12')
      )
    ).toEqual([
      interval('chat-a', '2026-01-05', '2026-01-12'),
      interval('chat-b', '2026-01-01', '2026-01-10')
    ]);
  });

  it('stores coverage without source or provenance', () => {
    expect(Object.keys(interval('chat-a', '2026-01-01', '2026-01-02')).sort()).toEqual([
      'chatId',
      'endAt',
      'startAt'
    ]);
  });

  it('extends coverage from accepted live message-history updates', () => {
    expect(
      addCoverageFromLiveUpdate([interval('chat-a', '2026-01-01', '2026-01-10')], {
        chatId: 'chat-a',
        kind: 'message-history',
        messageDate: date('2026-01-10'),
        observedUntil: date('2026-01-12')
      })
    ).toEqual([interval('chat-a', '2026-01-01', '2026-01-12')]);
  });

  it('covers at least one Telegram second for live messages observed on the same second', () => {
    expect(
      addCoverageFromLiveUpdate([], {
        chatId: 'chat-a',
        kind: 'message-history',
        messageDate: new Date('2026-01-10T00:00:00.000Z'),
        observedUntil: new Date('2026-01-10T00:00:00.000Z')
      })
    ).toEqual([intervalAt('chat-a', '2026-01-10T00:00:00.000Z', '2026-01-10T00:00:01.000Z')]);
  });

  it('does not extend coverage from non-message live updates', () => {
    const existing = [interval('chat-a', '2026-01-01', '2026-01-10')];
    expect(addCoverageFromLiveUpdate(existing, { kind: 'non-message' })).toEqual(existing);
  });
});

function interval(chatId: string, startAt: string, endAt: string): HistoryCoverageInterval {
  return {
    chatId,
    endAt: date(endAt),
    startAt: date(startAt)
  };
}

function intervalAt(chatId: string, startAt: string, endAt: string): HistoryCoverageInterval {
  return {
    chatId,
    endAt: new Date(endAt),
    startAt: new Date(startAt)
  };
}

function date(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}
