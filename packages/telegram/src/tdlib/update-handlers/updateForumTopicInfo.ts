import { telegramForumTopicInfos } from '../../database/schema.js';
import { telegramWireJsonObject, type TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireForumTopicInfoUpdate = TelegramWireUpdateByType<'updateForumTopicInfo'>;
type TelegramWireForumTopicInfo = TelegramWireForumTopicInfoUpdate['info'];

export async function handleUpdateForumTopicInfo(
  update: TelegramWireForumTopicInfoUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const { info } = update;
  const row = forumTopicInfoRow(info);

  await database
    .insert(telegramForumTopicInfos)
    .values(row)
    .onConflictDoUpdate({
      set: row,
      target: [telegramForumTopicInfos.chatId, telegramForumTopicInfos.forumTopicId]
    });

  events.publishTelegramForumTopicInfoUpdated({
    chatId: row.chatId,
    forumTopicId: row.forumTopicId
  });
}

function forumTopicInfoRow(
  info: TelegramWireForumTopicInfo
): typeof telegramForumTopicInfos.$inferInsert {
  return {
    chatId: String(info.chat_id),
    creationDate: new Date(info.creation_date * 1000),
    creatorId: telegramWireJsonObject(info.creator_id),
    forumTopicId: info.forum_topic_id,
    icon: telegramWireJsonObject(info.icon),
    isClosed: info.is_closed,
    isGeneral: info.is_general,
    isHidden: info.is_hidden,
    isNameImplicit: info.is_name_implicit,
    isOutgoing: info.is_outgoing,
    name: info.name
  };
}
