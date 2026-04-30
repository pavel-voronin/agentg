import { describe, expect, it } from 'vitest';

import { createLiveCoverageObserver } from '../../src/history-sync/live-coverage.js';
import type { HistoryCoverageInterval } from '../../src/history-sync/types.js';

describe('live history coverage observer', () => {
  it('covers all known chats with empty live intervals while connected', async () => {
    const coverage: HistoryCoverageInterval[] = [];
    const batches: HistoryCoverageInterval[][] = [];
    const published: HistoryCoverageInterval[][] = [];
    const observer = createLiveCoverageObserver({
      addCoverageBatch: appendCoverageBatchTo(coverage, batches),
      listChatIds: listChatIds('chat-a', 'chat-a', 'chat-b'),
      publishCoverageChanged: (intervals) => {
        published.push(intervals);
      }
    });

    await observer.markConnected(at('2026-01-01T00:00:00.000Z'));
    await observer.tick(at('2026-01-01T00:00:05.000Z'));

    expect(coverage).toEqual([
      interval('chat-a', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:05.000Z'),
      interval('chat-b', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:05.000Z')
    ]);
    expect(batches).toEqual([coverage]);
    expect(published).toEqual([coverage]);
  });

  it('does not cover silent intervals before the stream is connected', async () => {
    const coverage: HistoryCoverageInterval[] = [];
    const observer = createLiveCoverageObserver({
      addCoverageBatch: appendCoverageBatchTo(coverage),
      listChatIds: listChatIds('chat-a')
    });

    await observer.tick(at('2026-01-01T00:00:05.000Z'));
    await observer.recordLiveMessage(
      'chat-a',
      at('2026-01-01T00:00:02.000Z'),
      at('2026-01-01T00:00:06.000Z')
    );

    expect(coverage).toEqual([]);
  });

  it('leaves a coverage gap across disconnects', async () => {
    const coverage: HistoryCoverageInterval[] = [];
    const observer = createLiveCoverageObserver({
      addCoverageBatch: appendCoverageBatchTo(coverage),
      listChatIds: listChatIds('chat-a')
    });

    await observer.markConnected(at('2026-01-01T00:00:00.000Z'));
    await observer.tick(at('2026-01-01T00:00:05.000Z'));
    await observer.markDisconnected();
    await observer.tick(at('2026-01-01T00:00:15.000Z'));
    await observer.markConnected(at('2026-01-01T00:00:20.000Z'));
    await observer.tick(at('2026-01-01T00:00:25.000Z'));

    expect(coverage).toEqual([
      interval('chat-a', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:05.000Z'),
      interval('chat-a', '2026-01-01T00:00:20.000Z', '2026-01-01T00:00:25.000Z')
    ]);
  });

  it('does not reset the checkpoint for duplicate connected signals', async () => {
    const coverage: HistoryCoverageInterval[] = [];
    const observer = createLiveCoverageObserver({
      addCoverageBatch: appendCoverageBatchTo(coverage),
      listChatIds: listChatIds('chat-a')
    });

    await observer.markConnected(at('2026-01-01T00:00:00.000Z'));
    await observer.markConnected(at('2026-01-01T00:00:10.000Z'));
    await observer.tick(at('2026-01-01T00:00:15.000Z'));

    expect(coverage).toEqual([
      interval('chat-a', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:15.000Z')
    ]);
  });

  it('covers newly known chats from the current connected session start', async () => {
    const coverage: HistoryCoverageInterval[] = [];
    let chatIds: string[] = [];
    const observer = createLiveCoverageObserver({
      addCoverageBatch: appendCoverageBatchTo(coverage),
      listChatIds: () => Promise.resolve(chatIds)
    });

    await observer.markConnected(at('2026-01-01T00:00:00.000Z'));
    await observer.tick(at('2026-01-01T00:00:05.000Z'));
    chatIds = ['chat-a'];
    await observer.tick(at('2026-01-01T00:00:10.000Z'));

    expect(coverage).toEqual([
      interval('chat-a', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:10.000Z')
    ]);
  });

  it('clamps stale live message coverage to the current connected session', async () => {
    const coverage: HistoryCoverageInterval[] = [];
    const observer = createLiveCoverageObserver({
      addCoverageBatch: appendCoverageBatchTo(coverage),
      listChatIds: listChatIds('chat-a')
    });

    await observer.markConnected(at('2026-01-01T00:00:10.000Z'));
    await observer.recordLiveMessage(
      'chat-b',
      at('2026-01-01T00:00:00.000Z'),
      at('2026-01-01T00:00:15.000Z')
    );

    expect(coverage).toEqual([
      interval('chat-a', '2026-01-01T00:00:10.000Z', '2026-01-01T00:00:15.000Z'),
      interval('chat-b', '2026-01-01T00:00:10.000Z', '2026-01-01T00:00:15.000Z')
    ]);
  });

  it('keeps message-specific coverage for chats without targets', async () => {
    const coverage: HistoryCoverageInterval[] = [];
    const observer = createLiveCoverageObserver({
      addCoverageBatch: appendCoverageBatchTo(coverage),
      listChatIds: listChatIds('chat-a')
    });

    await observer.markConnected(at('2026-01-01T00:00:00.000Z'));
    await observer.tick(at('2026-01-01T00:00:05.000Z'));
    await observer.recordLiveMessage(
      'chat-b',
      at('2026-01-01T00:00:03.000Z'),
      at('2026-01-01T00:00:10.000Z')
    );

    expect(coverage).toEqual([
      interval('chat-a', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:05.000Z'),
      interval('chat-a', '2026-01-01T00:00:05.000Z', '2026-01-01T00:00:10.000Z'),
      interval('chat-b', '2026-01-01T00:00:03.000Z', '2026-01-01T00:00:10.000Z')
    ]);
  });
});

function appendCoverageBatchTo(
  coverage: HistoryCoverageInterval[],
  batches: HistoryCoverageInterval[][] = []
): (intervals: HistoryCoverageInterval[]) => Promise<void> {
  return (intervals) => {
    coverage.push(...intervals);
    batches.push(intervals);
    return Promise.resolve();
  };
}

function listChatIds(...chatIds: string[]): () => Promise<string[]> {
  return () => Promise.resolve(chatIds);
}

function interval(chatId: string, startAt: string, endAt: string): HistoryCoverageInterval {
  return {
    chatId,
    endAt: at(endAt),
    startAt: at(startAt)
  };
}

function at(value: string): Date {
  return new Date(value);
}
