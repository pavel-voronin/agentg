import type { Database } from '../database/client.js';
import { telegramChatInviteLinks, telegramChatMembers } from '../database/schema.js';
import { tdId, tdJsonObject, tdJsonValue, type UpdateByType } from '../tdlib/shape.js';

type ChatMemberUpdate = UpdateByType<'updateChatMember'>;
export type ChatInviteLink = NonNullable<ChatMemberUpdate['invite_link']>;
type ChatMember = ChatMemberUpdate['new_chat_member'];
type MessageSender = ChatMember['member_id'];

export async function storeChatMember(database: Database, update: ChatMemberUpdate): Promise<void> {
  const chatId = String(update.chat_id);

  await database.transaction(async (transaction) => {
    const inviteLink = update.invite_link ?? null;
    if (inviteLink !== null) {
      await upsertChatInviteLink(transaction, chatId, inviteLink);
    }

    await upsertChatMember(transaction, chatId, update.new_chat_member);
  });
}

export async function upsertChatInviteLink(
  database: Database,
  chatId: string,
  inviteLink: ChatInviteLink
): Promise<void> {
  const row: typeof telegramChatInviteLinks.$inferInsert = {
    chatId,
    createsJoinRequest: inviteLink.creates_join_request,
    creatorUserId: String(inviteLink.creator_user_id),
    date: unixDate(inviteLink.date),
    editDate: unixDate(inviteLink.edit_date),
    expirationDate: unixDate(inviteLink.expiration_date),
    expiredMemberCount: inviteLink.expired_member_count,
    inviteLink: inviteLink.invite_link,
    isPrimary: inviteLink.is_primary,
    isRevoked: inviteLink.is_revoked,
    memberCount: inviteLink.member_count,
    memberLimit: inviteLink.member_limit,
    name: inviteLink.name,
    pendingJoinRequestCount: inviteLink.pending_join_request_count,
    subscriptionPricing: tdJsonValue(inviteLink.subscription_pricing ?? null) ?? null
  };

  await database
    .insert(telegramChatInviteLinks)
    .values(row)
    .onConflictDoUpdate({
      set: row,
      target: [telegramChatInviteLinks.chatId, telegramChatInviteLinks.inviteLink]
    });
}

async function upsertChatMember(
  database: Database,
  chatId: string,
  chatMember: ChatMember
): Promise<void> {
  const row: typeof telegramChatMembers.$inferInsert = {
    chatId,
    inviterUserId: tdId(chatMember.inviter_user_id),
    joinedChatDate: unixDate(chatMember.joined_chat_date),
    memberId: messageSenderId(chatMember.member_id),
    status: tdJsonObject(chatMember.status),
    tag: chatMember.tag
  };

  await database
    .insert(telegramChatMembers)
    .values(row)
    .onConflictDoUpdate({
      set: row,
      target: [telegramChatMembers.chatId, telegramChatMembers.memberId]
    });
}

function messageSenderId(sender: MessageSender): string {
  if (sender._ === 'messageSenderUser') {
    return String(sender.user_id);
  }

  return String(sender.chat_id);
}

function unixDate(value: number): Date {
  return new Date(value * 1000);
}
