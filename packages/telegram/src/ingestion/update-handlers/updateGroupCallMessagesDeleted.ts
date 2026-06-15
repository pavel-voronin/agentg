import { and, eq, inArray } from 'drizzle-orm';

import { telegramGroupCallMessages } from '../../database/schema.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type GroupCallMessagesDeletedUpdate = UpdateByType<'updateGroupCallMessagesDeleted'>;

export async function handleUpdateGroupCallMessagesDeleted(
  update: GroupCallMessagesDeletedUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
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
}
