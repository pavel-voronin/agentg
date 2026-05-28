import { and, eq, inArray } from 'drizzle-orm';

import { telegramGroupCallMessages } from '../../schema.js';
import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireGroupCallMessagesDeletedUpdate =
  TelegramWireUpdateByType<'updateGroupCallMessagesDeleted'>;

export async function handleUpdateGroupCallMessagesDeleted(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireGroupCallMessagesDeletedUpdate
): Promise<void> {
  const groupCallId = update.group_call_id;
  const messageIds = update.message_ids;

  await database
    .delete(telegramGroupCallMessages)
    .where(
      and(
        eq(telegramGroupCallMessages.groupCallId, groupCallId),
        inArray(telegramGroupCallMessages.messageId, messageIds)
      )
    );

  events.publishTelegramGroupCallMessagesDeleted({
    groupCallId,
    messageIds
  });
}
