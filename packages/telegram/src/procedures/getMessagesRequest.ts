import { and, eq } from 'drizzle-orm';

import { telegramMessages } from '../database/schema.js';
import { ceilToHistorySecond, HISTORY_TICK_MS } from '../history/time.js';
import type { ProcedureResources } from './resources.js';

const GET_MESSAGES_DEFAULT_LIMIT = 100;
const GET_MESSAGES_MAX_LIMIT = 100;

type GetMessagesInput = {
  beforeMessageId?: string | undefined;
  chatId: string;
  limit?: number | undefined;
};

export async function resolveGetMessagesRequest(
  input: GetMessagesInput,
  resources: ProcedureResources
) {
  const limit = parseLimit(input.limit, GET_MESSAGES_DEFAULT_LIMIT, GET_MESSAGES_MAX_LIMIT);
  const beforeMessageId = parseOptionalMessageId(input.beforeMessageId);
  const pageEndAt =
    beforeMessageId === undefined
      ? ceilToHistorySecond(new Date())
      : await requireMessagePageEndAt(input.chatId, String(beforeMessageId), resources);

  return {
    ...(beforeMessageId === undefined ? {} : { beforeMessageId: String(beforeMessageId) }),
    chatId: input.chatId,
    limit,
    pageEndAt: pageEndAt.toISOString()
  };
}

async function readMessagePageEndAt(
  chatId: string,
  messageId: string,
  resources: ProcedureResources
): Promise<Date | undefined> {
  const [message] = await resources.database
    .select({
      messageDate: telegramMessages.date
    })
    .from(telegramMessages)
    .where(and(eq(telegramMessages.chatId, chatId), eq(telegramMessages.id, messageId)))
    .limit(1);

  return message?.messageDate === null || message?.messageDate === undefined
    ? undefined
    : nextHistorySecond(message.messageDate);
}

async function requireMessagePageEndAt(
  chatId: string,
  messageId: string,
  resources: ProcedureResources
): Promise<Date> {
  const pageEndAt = await readMessagePageEndAt(chatId, messageId, resources);
  if (pageEndAt === undefined) {
    throw new Error(`telegram.getMessages cursor message is not available: ${messageId}`);
  }
  return pageEndAt;
}

function parseLimit(value: number | undefined, fallback: number, max: number): number {
  if (value === undefined) {
    return fallback;
  }
  return Math.min(value, max);
}

function parseOptionalMessageId(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`telegram.getMessages cursor message id is not safe: ${value}`);
  }
  return parsed;
}

function nextHistorySecond(date: Date): Date {
  return new Date(Math.floor(date.getTime() / HISTORY_TICK_MS) * HISTORY_TICK_MS + HISTORY_TICK_MS);
}
