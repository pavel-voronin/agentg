import type { message as Message, messages as Messages } from 'tdlib-types';

import type { Database } from '../../database/client.js';
import {
  parseTelegramInt32,
  parseTelegramInt53,
  type MessageOwner,
  type MessageSelector
} from '../../domain/models/messageSelection.js';
import type { MessageState } from '../../domain/models/messageState.js';
import {
  HISTORY_PAST_BOUNDARY,
  HISTORY_TICK_MS,
  normalizeHistoryInterval,
  type HistoryInterval
} from '../../history/time.js';
import {
  readOldestKnownMessage,
  readOldestPageMessageId
} from '../../storage/historySourceStorage.js';
import type { Operations } from '../../tdlib/operations.js';
import { priorities } from '../../tdlib/priority.js';
import { tdDate, tdIdNumber } from '../../tdlib/shape.js';
import { messageStatesFromHistoryPage } from './historyPage.js';

export type HistoryFetchStep = {
  coverageInterval?: HistoryInterval | undefined;
  fetchedMessages: MessageState[];
  reachedBeginning: boolean;
};

export function createHistorySource(tdlib: Operations) {
  return {
    fetchOwnerHistoryStep(
      input: Omit<Parameters<typeof fetchOwnerHistoryStep>[0], 'tdlib'>
    ): Promise<HistoryFetchStep> {
      return fetchOwnerHistoryStep({
        ...input,
        tdlib
      });
    }
  };
}

type HistoryCursor =
  | {
      canPageProveBeginning: boolean;
      coverageEndAt?: Date | undefined;
      coverageEndMessageId?: number | undefined;
      fromMessageId: number;
      kind: 'cursor';
    }
  | {
      interval: HistoryInterval;
      kind: 'covered';
    };

const PRIVATE_PAGE_SIZE = 100;

export async function fetchOwnerHistoryStep(input: {
  database: Database;
  interval: HistoryInterval;
  owner: MessageOwner;
  selector: MessageSelector;
  tdlib: Operations;
}): Promise<HistoryFetchStep> {
  const interval = normalizeHistoryInterval(input.interval);
  const cursor = await resolveCursor(
    input.database,
    input.tdlib,
    input.owner,
    input.selector,
    interval
  );
  if (cursor.kind === 'covered') {
    return {
      coverageInterval: cursor.interval,
      fetchedMessages: [],
      reachedBeginning: cursor.interval.startAt.getTime() === HISTORY_PAST_BOUNDARY.getTime()
    };
  }

  const history = await fetchOwnerHistory(input.tdlib, input.owner, cursor.fromMessageId);
  const rawMessages = history.messages;
  const fetchedMessages = rawMessages.filter(isFetchedMessage);
  const coverageEndAt = cursorCoverageEndAt(cursor, fetchedMessages);
  if (fetchedMessages.length === 0) {
    const reachedBeginning = hasTdlibBeginningProof(cursor, rawMessages);
    return {
      ...(coverageEndAt === undefined || !reachedBeginning
        ? {}
        : {
            coverageInterval: {
              endAt: coverageEndAt,
              startAt: HISTORY_PAST_BOUNDARY
            }
          }),
      fetchedMessages: [],
      reachedBeginning
    };
  }

  const oldestDate = oldestMessageDate(fetchedMessages);
  const reachedBeginning = hasTdlibBeginningProof(cursor, rawMessages);
  const crossedStart = fetchedMessages.some((message) => {
    const date = tdMessageDate(message);
    return date !== undefined && date < interval.startAt;
  });
  const coveredStartAt = coveredStart({
    crossedStart,
    interval,
    oldestDate,
    reachedBeginning
  });

  return {
    ...(coverageEndAt === undefined ||
    coveredStartAt === undefined ||
    coveredStartAt >= coverageEndAt
      ? {}
      : {
          coverageInterval: {
            endAt: coverageEndAt,
            startAt: coveredStartAt
          }
        }),
    fetchedMessages: messageStatesFromHistoryPage(fetchedMessages),
    reachedBeginning
  };
}

async function resolveCursor(
  database: Database,
  tdlib: Operations,
  owner: MessageOwner,
  selector: MessageSelector,
  interval: HistoryInterval
): Promise<HistoryCursor> {
  if (selector.kind === 'page') {
    const localOldest = await readOldestPageMessageId(database, owner, selector);
    if (localOldest !== undefined) {
      return {
        canPageProveBeginning: true,
        coverageEndAt: interval.endAt,
        fromMessageId: localOldest,
        kind: 'cursor'
      };
    }
    if (selector.beforeMessageId !== undefined) {
      return {
        canPageProveBeginning: true,
        coverageEndMessageId: parseTelegramInt53(selector.beforeMessageId, 'beforeMessageId'),
        fromMessageId: parseTelegramInt53(selector.beforeMessageId, 'beforeMessageId'),
        kind: 'cursor'
      };
    }
  }

  const localOldest = await readOldestKnownMessage(database, owner);
  if (localOldest !== undefined && !ownerHasDateAnchor(owner)) {
    return {
      canPageProveBeginning: true,
      coverageEndAt:
        localOldest.messageDate === undefined
          ? undefined
          : nextHistorySecond(localOldest.messageDate),
      fromMessageId: localOldest.messageId,
      kind: 'cursor'
    };
  }

  const anchor = await readDateAnchor(tdlib, owner, interval.endAt);
  if (anchor.kind === 'found') {
    const anchorDate = tdMessageDate(anchor.message);
    if (selector.kind === 'range' && anchorDate !== undefined && anchorDate < interval.startAt) {
      return {
        interval,
        kind: 'covered'
      };
    }
    return {
      canPageProveBeginning: true,
      coverageEndAt: interval.endAt,
      fromMessageId: anchor.messageId,
      kind: 'cursor'
    };
  }

  if (anchor.kind === 'not_found') {
    return {
      interval: {
        endAt: interval.endAt,
        startAt: HISTORY_PAST_BOUNDARY
      },
      kind: 'covered'
    };
  }

  return {
    canPageProveBeginning: true,
    coverageEndAt: interval.endAt,
    fromMessageId: localOldest?.messageId ?? 0,
    kind: 'cursor'
  };
}

async function fetchOwnerHistory(
  tdlib: Operations,
  owner: MessageOwner,
  fromMessageId: number
): Promise<Messages> {
  switch (owner.kind) {
    case 'chat':
      return tdlib.getChatHistory(
        {
          chatId: parseTelegramInt53(owner.chatId, 'chatId'),
          fromMessageId,
          limit: PRIVATE_PAGE_SIZE,
          offset: 0,
          onlyLocal: false
        },
        { priority: priorities.low }
      );
    case 'forumTopic':
      return tdlib.getForumTopicHistory(
        {
          chatId: parseTelegramInt53(owner.chatId, 'chatId'),
          forumTopicId: parseTelegramInt32(owner.topicId, 'topicId'),
          fromMessageId,
          limit: PRIVATE_PAGE_SIZE,
          offset: 0
        },
        { priority: priorities.low }
      );
    case 'directMessagesTopic':
      return tdlib.getDirectMessagesChatTopicHistory(
        {
          chatId: parseTelegramInt53(owner.chatId, 'chatId'),
          fromMessageId,
          limit: PRIVATE_PAGE_SIZE,
          offset: 0,
          topicId: parseTelegramInt53(owner.topicId, 'topicId')
        },
        { priority: priorities.low }
      );
    case 'savedMessagesTopic':
      return tdlib.getSavedMessagesTopicHistory(
        {
          fromMessageId,
          limit: PRIVATE_PAGE_SIZE,
          offset: 0,
          topicId: parseTelegramInt53(owner.topicId, 'topicId')
        },
        { priority: priorities.low }
      );
    case 'messageThread':
      return tdlib.getMessageThreadHistory(
        {
          chatId: parseTelegramInt53(owner.chatId, 'chatId'),
          fromMessageId,
          limit: PRIVATE_PAGE_SIZE,
          messageId: parseTelegramInt53(owner.messageId, 'messageId'),
          offset: 0
        },
        { priority: priorities.low }
      );
  }
}

async function readDateAnchor(
  tdlib: Operations,
  owner: MessageOwner,
  endAt: Date
): Promise<
  | {
      kind: 'found';
      message: Message;
      messageId: number;
    }
  | {
      kind: 'no_anchor';
    }
  | {
      kind: 'not_found';
    }
> {
  if (!ownerHasDateAnchor(owner)) {
    return { kind: 'no_anchor' };
  }

  try {
    const date = Math.floor((endAt.getTime() - 1) / 1000);
    const message = await readOwnerDateAnchor(tdlib, owner, date);
    const messageId = tdMessageId(message);
    return messageId === undefined
      ? { kind: 'not_found' }
      : {
          kind: 'found',
          message,
          messageId
        };
  } catch (error) {
    if (isTdlibNotFound(error)) {
      return { kind: 'not_found' };
    }
    throw error;
  }
}

function readOwnerDateAnchor(
  tdlib: Operations,
  owner: MessageOwner,
  date: number
): Promise<Message> {
  switch (owner.kind) {
    case 'chat':
      return tdlib.getChatMessageByDate(
        {
          chatId: parseTelegramInt53(owner.chatId, 'chatId'),
          date
        },
        { priority: priorities.low }
      );
    case 'directMessagesTopic':
      return tdlib.getDirectMessagesChatTopicMessageByDate(
        {
          chatId: parseTelegramInt53(owner.chatId, 'chatId'),
          date,
          topicId: parseTelegramInt53(owner.topicId, 'topicId')
        },
        { priority: priorities.low }
      );
    case 'savedMessagesTopic':
      return tdlib.getSavedMessagesTopicMessageByDate(
        {
          date,
          topicId: parseTelegramInt53(owner.topicId, 'topicId')
        },
        { priority: priorities.low }
      );
    case 'forumTopic':
    case 'messageThread':
      throw new Error(`Owner kind has no date anchor: ${owner.kind}`);
  }
}

function ownerHasDateAnchor(owner: MessageOwner): boolean {
  return (
    owner.kind === 'chat' ||
    owner.kind === 'directMessagesTopic' ||
    owner.kind === 'savedMessagesTopic'
  );
}

function coveredStart(input: {
  crossedStart: boolean;
  interval: HistoryInterval;
  oldestDate: Date | undefined;
  reachedBeginning: boolean;
}): Date | undefined {
  if (input.reachedBeginning) {
    return HISTORY_PAST_BOUNDARY;
  }
  if (input.crossedStart) {
    return input.interval.startAt;
  }
  if (input.oldestDate === undefined) {
    return undefined;
  }
  const oldestSecond = new Date(
    Math.floor(input.oldestDate.getTime() / HISTORY_TICK_MS) * HISTORY_TICK_MS
  );
  return new Date(oldestSecond.getTime() + HISTORY_TICK_MS);
}

function cursorCoverageEndAt(
  cursor: Extract<HistoryCursor, { kind: 'cursor' }>,
  messages: Message[]
) {
  if (cursor.coverageEndAt !== undefined) {
    return cursor.coverageEndAt;
  }
  if (cursor.coverageEndMessageId === undefined) {
    return undefined;
  }

  const anchor = messages.find((message) => tdMessageId(message) === cursor.coverageEndMessageId);
  const anchorDate = tdMessageDate(anchor);
  return anchorDate === undefined ? undefined : nextHistorySecond(anchorDate);
}

function tdMessageId(message: Message | undefined): number | undefined {
  return tdIdNumber(message?.id);
}

function tdMessageDate(message: Message | undefined): Date | undefined {
  return tdDate(message?.date);
}

function oldestMessageDate(messages: Message[]): Date | undefined {
  const dates = messages.map(tdMessageDate).filter((date): date is Date => date !== undefined);
  const [first, ...rest] = dates;
  return first === undefined
    ? undefined
    : rest.reduce((oldest, date) => (date < oldest ? date : oldest), first);
}

function hasTdlibBeginningProof(
  cursor: Extract<HistoryCursor, { kind: 'cursor' }>,
  rawMessages: readonly (Message | null)[]
): boolean {
  if (!cursor.canPageProveBeginning) {
    return false;
  }
  if (rawMessages.some((message) => message === null)) {
    return false;
  }
  if (cursor.fromMessageId === 0) {
    return rawMessages.length === 0;
  }
  return false;
}

function nextHistorySecond(date: Date): Date {
  const second = new Date(Math.floor(date.getTime() / HISTORY_TICK_MS) * HISTORY_TICK_MS);
  return new Date(second.getTime() + HISTORY_TICK_MS);
}

function isFetchedMessage(value: Message | null): value is Message {
  return value !== null;
}

function isTdlibNotFound(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\b404\b/.test(message) || message.includes('NOT_FOUND') || message.includes('Not Found');
}
