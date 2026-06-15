import { and, asc, sql } from 'drizzle-orm';

import type { Database } from '../database/client.js';
import { telegramMessages } from '../database/schema.js';
import {
  parseTelegramInt53,
  type MessageOwner,
  type MessageSelector
} from '../domain/models/messageSelection.js';
import { messageChatCondition, ownerMessageCondition } from './messageOwnerCondition.js';
import { readPageRows } from './messageReadStorage.js';

export type OldestKnownMessage = {
  messageDate?: Date | undefined;
  messageId: number;
};

export async function readOldestPageMessageId(
  database: Database,
  owner: MessageOwner,
  selector: Extract<MessageSelector, { kind: 'page' }>
): Promise<number | undefined> {
  const rows = await readPageRows(database, owner, selector);
  const oldest = rows[0]?.telegramMessageId;
  return oldest === undefined ? undefined : parseTelegramInt53(oldest, 'telegramMessageId');
}

export async function readOldestKnownMessage(
  database: Database,
  owner: MessageOwner
): Promise<OldestKnownMessage | undefined> {
  const [row] = await database
    .select({
      messageDate: telegramMessages.date,
      messageId: telegramMessages.id
    })
    .from(telegramMessages)
    .where(and(ownerMessageCondition(owner), messageChatCondition(owner)))
    .orderBy(asc(sql`${telegramMessages.id}::bigint`))
    .limit(1);

  return row === undefined
    ? undefined
    : {
        messageDate: row.messageDate ?? undefined,
        messageId: parseTelegramInt53(row.messageId, 'telegramMessageId')
      };
}
