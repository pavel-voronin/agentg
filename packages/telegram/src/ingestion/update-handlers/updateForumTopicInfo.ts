import { telegramForumTopicInfos } from '../../database/schema.js';
import { tdJsonObject, type UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type ForumTopicInfoUpdate = UpdateByType<'updateForumTopicInfo'>;
type ForumTopicInfo = ForumTopicInfoUpdate['info'];

export async function handleUpdateForumTopicInfo(
  update: ForumTopicInfoUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const { info } = update;
  const row = forumTopicInfoRow(info);

  await database
    .insert(telegramForumTopicInfos)
    .values(row)
    .onConflictDoUpdate({
      set: row,
      target: [telegramForumTopicInfos.chatId, telegramForumTopicInfos.forumTopicId]
    });

  await events.publishTelegramForumTopicInfoUpdated({
    chatId: row.chatId,
    forumTopicId: row.forumTopicId
  });
}

function forumTopicInfoRow(info: ForumTopicInfo): typeof telegramForumTopicInfos.$inferInsert {
  return {
    chatId: String(info.chat_id),
    creationDate: new Date(info.creation_date * 1000),
    creatorId: tdJsonObject(info.creator_id),
    forumTopicId: info.forum_topic_id,
    icon: tdJsonObject(info.icon),
    isClosed: info.is_closed,
    isGeneral: info.is_general,
    isHidden: info.is_hidden,
    isNameImplicit: info.is_name_implicit,
    isOutgoing: info.is_outgoing,
    name: info.name
  };
}
