import type { Database } from '../../database/client.js';
import {
  HISTORY_PAST_BOUNDARY,
  HISTORY_TICK_MS,
  normalizeHistoryInterval,
  type HistoryInterval
} from '../../history/time.js';
import {
  isOwnerCovered,
  listOwnerCoverage,
  missingOwnerCoverageIntervals
} from '../../reconciler/coverage.js';
import type { MessageStorageRow } from '../../views/message.js';
import type { GetMessagesInput, MessageSelector } from './contract.js';
import { readPageEndAt, readPageRows, readRangeRows } from './read.js';

export type ReadyPageRows = {
  messages: MessageStorageRow[];
  reachedStart: boolean;
  selectorKind: 'page';
};

export type ReadyRangeRows = {
  messages: MessageStorageRow[];
  selectorKind: 'range';
};

export type ReadyRows = ReadyPageRows | ReadyRangeRows;

export type ReadinessResult =
  | {
      missing: HistoryInterval[];
      ready: false;
    }
  | {
      ready: true;
      rows: ReadyRows;
    };

export async function checkMessagesReadiness(
  database: Database,
  input: GetMessagesInput
): Promise<ReadinessResult> {
  if (input.selector.kind === 'page') {
    return checkPageReadiness(database, {
      owner: input.owner,
      selector: input.selector
    });
  }
  return checkRangeReadiness(database, {
    owner: input.owner,
    selector: input.selector
  });
}

export async function selectorMissingIntervals(
  database: Database,
  input: GetMessagesInput
): Promise<HistoryInterval[]> {
  const interval = await selectorCoverageInterval(database, input);
  if (interval === undefined) {
    return [
      normalizeHistoryInterval({
        endAt: new Date(),
        startAt: HISTORY_PAST_BOUNDARY
      })
    ];
  }
  return missingOwnerCoverageIntervals(database, input.owner, [interval]);
}

export async function selectorCoverageInterval(
  database: Database,
  input: GetMessagesInput
): Promise<HistoryInterval | undefined> {
  if (input.selector.kind === 'range') {
    return normalizeHistoryInterval({
      endAt: new Date(input.selector.endAt),
      startAt: new Date(input.selector.startAt)
    });
  }

  const pageEndAt = await readPageEndAt(database, input.owner, input.selector.beforeMessageId);
  if (pageEndAt === undefined) {
    return undefined;
  }
  const messages = await readPageRows(database, input.owner, input.selector);
  return pageReadiness(messages, input.selector, pageEndAt)?.interval;
}

function checkPageReadiness(
  database: Database,
  input: GetMessagesInput & {
    selector: Extract<MessageSelector, { kind: 'page' }>;
  }
): Promise<ReadinessResult> {
  return Promise.all([
    readPageRows(database, input.owner, input.selector),
    readPageEndAt(database, input.owner, input.selector.beforeMessageId)
  ]).then(async ([messages, pageEndAt]) => {
    if (pageEndAt === undefined) {
      if (
        input.selector.beforeMessageId === undefined &&
        messages.length === 0 &&
        (await hasEmptyLatestPageCoverage(database, input.owner))
      ) {
        return {
          ready: true,
          rows: {
            messages: [],
            reachedStart: true,
            selectorKind: 'page'
          }
        };
      }
      return { missing: [openPastInterval()], ready: false };
    }

    const readiness = pageReadiness(messages, input.selector, pageEndAt);
    if (readiness === undefined) {
      return { missing: [openPastInterval(pageEndAt)], ready: false };
    }

    const coverage = await missingOwnerCoverageIntervals(database, input.owner, [
      readiness.interval
    ]);
    if (coverage.length > 0) {
      return { missing: coverage, ready: false };
    }

    return {
      ready: true,
      rows: {
        messages,
        reachedStart: readiness.reachedStart,
        selectorKind: 'page'
      }
    };
  });
}

async function checkRangeReadiness(
  database: Database,
  input: GetMessagesInput & {
    selector: Extract<MessageSelector, { kind: 'range' }>;
  }
): Promise<ReadinessResult> {
  const interval = normalizeHistoryInterval({
    endAt: new Date(input.selector.endAt),
    startAt: new Date(input.selector.startAt)
  });
  if (interval.startAt >= interval.endAt) {
    return {
      ready: true,
      rows: {
        messages: [],
        selectorKind: 'range'
      }
    };
  }

  if (!(await isOwnerCovered(database, input.owner, interval))) {
    return {
      missing: await missingOwnerCoverageIntervals(database, input.owner, [interval]),
      ready: false
    };
  }

  return {
    ready: true,
    rows: {
      messages: await readRangeRows(database, input.owner, input.selector),
      selectorKind: 'range'
    }
  };
}

function pageReadiness(
  messages: MessageStorageRow[],
  selector: Extract<MessageSelector, { kind: 'page' }>,
  pageEndAt: Date
): { interval: HistoryInterval; reachedStart: boolean } | undefined {
  if (!hasDatedPageBoundary(messages)) {
    return undefined;
  }

  if (messages.length < selector.count) {
    return {
      interval: normalizeHistoryInterval({
        endAt: pageEndAt,
        startAt: HISTORY_PAST_BOUNDARY
      }),
      reachedStart: true
    };
  }

  const oldest = messages[0];
  if (oldest?.messageDate === undefined || oldest.messageDate === null) {
    return undefined;
  }

  return {
    interval: normalizeHistoryInterval({
      endAt: pageEndAt,
      startAt: nextHistorySecond(new Date(oldest.messageDate))
    }),
    reachedStart: false
  };
}

function hasDatedPageBoundary(messages: MessageStorageRow[]): boolean {
  const newest = messages[messages.length - 1];
  return newest?.messageDate !== null && newest?.messageDate !== undefined;
}

async function hasEmptyLatestPageCoverage(
  database: Database,
  owner: GetMessagesInput['owner']
): Promise<boolean> {
  const coverage = await listOwnerCoverage(database, owner);
  return coverage.some(
    (segment) =>
      segment.startAt.getTime() <= HISTORY_PAST_BOUNDARY.getTime() &&
      segment.endAt.getTime() > segment.startAt.getTime()
  );
}

function openPastInterval(endAt = new Date()): HistoryInterval {
  return normalizeHistoryInterval({
    endAt,
    startAt: HISTORY_PAST_BOUNDARY
  });
}

function nextHistorySecond(date: Date): Date {
  return new Date(Math.floor(date.getTime() / HISTORY_TICK_MS) * HISTORY_TICK_MS + HISTORY_TICK_MS);
}
