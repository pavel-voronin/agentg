import { and, eq, inArray } from 'drizzle-orm';

import { telegramGroupCallMessages } from '../../database/schema.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireGroupCallMessagesDeletedUpdate =
  TelegramWireUpdateByType<'updateGroupCallMessagesDeleted'>;

export async function handleUpdateGroupCallMessagesDeleted(
  update: TelegramWireGroupCallMessagesDeletedUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
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
