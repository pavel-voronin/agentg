import { telegramChatJoinRequests } from '../../database/schema.js';
import { upsertChatInviteLink } from '../../store/chatMember.js';
import { tdDate, type UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type NewChatJoinRequestUpdate = UpdateByType<'updateNewChatJoinRequest'>;

export async function handleUpdateNewChatJoinRequest(
  update: NewChatJoinRequestUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const chatId = String(update.chat_id);
  const inviteLink = update.invite_link ?? null;
  const row = {
    bio: update.request.bio,
    chatId,
    date: requiredDate(update.request.date),
    inviteLink: inviteLink?.invite_link ?? null,
    userChatId: String(update.user_chat_id),
    userId: String(update.request.user_id)
  } satisfies typeof telegramChatJoinRequests.$inferInsert;

  await database.transaction(async (transaction) => {
    if (inviteLink !== null) {
      await upsertChatInviteLink(transaction, chatId, inviteLink);
    }

    await transaction
      .insert(telegramChatJoinRequests)
      .values(row)
      .onConflictDoUpdate({
        set: row,
        target: [telegramChatJoinRequests.chatId, telegramChatJoinRequests.userId]
      });
  });
}

function requiredDate(value: number): Date {
  const date = tdDate(value);
  if (date === undefined) {
    throw new Error('Expected Telegram wire date');
  }
  return date;
}
