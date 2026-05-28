import { telegramChatJoinRequests } from '../../schema.js';
import { upsertChatInviteLink } from '../../store/chatMember.js';
import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { telegramWireDate, type TelegramWireUpdateByType } from '../wire.js';

type TelegramWireNewChatJoinRequestUpdate = TelegramWireUpdateByType<'updateNewChatJoinRequest'>;

export async function handleUpdateNewChatJoinRequest(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireNewChatJoinRequestUpdate
): Promise<void> {
  const chatId = String(update.chat_id);
  const inviteLink = update.invite_link ?? null;
  const row = {
    bio: update.request.bio,
    chatId,
    date: requiredTelegramWireDate(update.request.date),
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

  events.publishTelegramChatJoinRequestCreated(update);
}

function requiredTelegramWireDate(value: number): Date {
  const date = telegramWireDate(value);
  if (date === undefined) {
    throw new Error('Expected Telegram wire date');
  }
  return date;
}
