import { and, asc, eq, sql } from 'drizzle-orm';
import type { message as Message } from 'tdlib-types';

import type { Database } from '../database/client.js';
import { telegramMessages } from '../database/schema.js';
import {
  HISTORY_PAST_BOUNDARY,
  HISTORY_TICK_MS,
  normalizeHistoryInterval,
  type HistoryInterval
} from '../history/time.js';
import type { MessageOwner, MessageSelector } from '../procedures/get-messages/contract.js';
import { readPageRows } from '../procedures/get-messages/read.js';
import type { Operations } from '../tdlib/operations.js';
import { priorities } from '../tdlib/priority.js';
import { tdDate, tdIdNumber } from '../tdlib/value.js';
import { ownerMessageCondition, parseTdlibInt53 } from './owner.js';

export type HistoryFetchStep = {
  coverageInterval?: HistoryInterval | undefined;
  fetchedMessages: Message[];
  reachedBeginning: boolean;
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
  const fetchedMessages = history.messages.filter(isFetchedMessage);
  if (fetchedMessages.length === 0) {
    return {
      coverageInterval: {
        endAt: interval.endAt,
        startAt: HISTORY_PAST_BOUNDARY
      },
      fetchedMessages: [],
      reachedBeginning: true
    };
  }

  const oldestDate = oldestMessageDate(fetchedMessages);
  const reachedBeginning =
    oldestMessageIdOlderThan(fetchedMessages, cursor.fromMessageId) === undefined;
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
    ...(coveredStartAt === undefined || coveredStartAt >= interval.endAt
      ? {}
      : {
          coverageInterval: {
            endAt: interval.endAt,
            startAt: coveredStartAt
          }
        }),
    fetchedMessages,
    reachedBeginning
  };
}

async function resolveCursor(
  database: Database,
  tdlib: Operations,
  owner: MessageOwner,
  selector: MessageSelector,
  interval: HistoryInterval
): Promise<
  | {
      fromMessageId: number;
      kind: 'cursor';
    }
  | {
      interval: HistoryInterval;
      kind: 'covered';
    }
> {
  if (selector.kind === 'page') {
    const localOldest = await readOldestPageMessageId(database, owner, selector);
    if (localOldest !== undefined) {
      return {
        fromMessageId: localOldest,
        kind: 'cursor'
      };
    }
    if (selector.beforeMessageId !== undefined) {
      return {
        fromMessageId: parseTdlibInt53(selector.beforeMessageId, 'beforeMessageId'),
        kind: 'cursor'
      };
    }
  }

  const localOldest = await readOldestKnownMessageId(database, owner);
  if (localOldest !== undefined && !ownerHasDateAnchor(owner)) {
    return {
      fromMessageId: localOldest,
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
    fromMessageId: localOldest ?? 0,
    kind: 'cursor'
  };
}

async function fetchOwnerHistory(tdlib: Operations, owner: MessageOwner, fromMessageId: number) {
  switch (owner.kind) {
    case 'chat':
      return tdlib.getChatHistory(
        {
          chatId: parseTdlibInt53(owner.chatId, 'chatId'),
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
          chatId: parseTdlibInt53(owner.chatId, 'chatId'),
          forumTopicId: parseTdlibInt53(owner.topicId, 'topicId'),
          fromMessageId,
          limit: PRIVATE_PAGE_SIZE,
          offset: 0
        },
        { priority: priorities.low }
      );
    case 'directMessagesTopic':
      return tdlib.getDirectMessagesChatTopicHistory(
        {
          chatId: parseTdlibInt53(owner.chatId, 'chatId'),
          fromMessageId,
          limit: PRIVATE_PAGE_SIZE,
          offset: 0,
          topicId: parseTdlibInt53(owner.topicId, 'topicId')
        },
        { priority: priorities.low }
      );
    case 'savedMessagesTopic':
      return tdlib.getSavedMessagesTopicHistory(
        {
          fromMessageId,
          limit: PRIVATE_PAGE_SIZE,
          offset: 0,
          topicId: parseTdlibInt53(owner.topicId, 'topicId')
        },
        { priority: priorities.low }
      );
    case 'messageThread':
      return tdlib.getMessageThreadHistory(
        {
          chatId: parseTdlibInt53(owner.chatId, 'chatId'),
          fromMessageId,
          limit: PRIVATE_PAGE_SIZE,
          messageId: parseTdlibInt53(owner.messageId, 'messageId'),
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
          chatId: parseTdlibInt53(owner.chatId, 'chatId'),
          date
        },
        { priority: priorities.low }
      );
    case 'directMessagesTopic':
      return tdlib.getDirectMessagesChatTopicMessageByDate(
        {
          chatId: parseTdlibInt53(owner.chatId, 'chatId'),
          date,
          topicId: parseTdlibInt53(owner.topicId, 'topicId')
        },
        { priority: priorities.low }
      );
    case 'savedMessagesTopic':
      return tdlib.getSavedMessagesTopicMessageByDate(
        {
          date,
          topicId: parseTdlibInt53(owner.topicId, 'topicId')
        },
        { priority: priorities.low }
      );
    case 'forumTopic':
    case 'messageThread':
      throw new Error(`Owner kind has no date anchor: ${owner.kind}`);
  }
}

async function readOldestPageMessageId(
  database: Database,
  owner: MessageOwner,
  selector: Extract<MessageSelector, { kind: 'page' }>
): Promise<number | undefined> {
  const rows = await readPageRows(database, owner, selector);
  const oldest = rows[0]?.telegramMessageId;
  return oldest === undefined ? undefined : parseTdlibInt53(oldest, 'telegramMessageId');
}

async function readOldestKnownMessageId(
  database: Database,
  owner: MessageOwner
): Promise<number | undefined> {
  const [row] = await database
    .select({
      messageId: telegramMessages.id
    })
    .from(telegramMessages)
    .where(and(ownerMessageCondition(owner), messageChatCondition(owner)))
    .orderBy(asc(sql`${telegramMessages.id}::bigint`))
    .limit(1);

  return row === undefined ? undefined : parseTdlibInt53(row.messageId, 'telegramMessageId');
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

function messageChatCondition(owner: MessageOwner) {
  return owner.kind === 'savedMessagesTopic'
    ? undefined
    : eq(telegramMessages.chatId, owner.chatId);
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

function oldestMessageIdOlderThan(
  messages: Message[],
  cursorMessageId: number
): number | undefined {
  const ids = messages
    .map(tdMessageId)
    .filter((id): id is number => id !== undefined && id < cursorMessageId);

  return ids.length === 0 ? undefined : Math.min(...ids);
}

function isFetchedMessage(value: Message | null): value is Message {
  return value !== null;
}

function isTdlibNotFound(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\b404\b/.test(message) || message.includes('NOT_FOUND') || message.includes('Not Found');
}
