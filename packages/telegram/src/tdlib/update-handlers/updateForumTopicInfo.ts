import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { telegramForumTopicInfos } from '../../schema.js';
import { telegramWireJsonObject, type TelegramWireUpdateByType } from '../wire.js';

type TelegramWireForumTopicInfoUpdate = TelegramWireUpdateByType<'updateForumTopicInfo'>;
type TelegramWireForumTopicInfo = TelegramWireForumTopicInfoUpdate['info'];

export async function handleUpdateForumTopicInfo(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireForumTopicInfoUpdate
): Promise<void> {
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
