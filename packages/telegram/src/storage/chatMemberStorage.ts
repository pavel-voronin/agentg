import { eq } from 'drizzle-orm';

import type { Database } from '../database/client.js';
import {
  telegramChatInviteLinks,
  telegramChatJoinRequests,
  telegramChatMembers
} from '../database/schema.js';
import type { ChatInviteLink, ChatJoinRequest, ChatMember } from '../domain/models/chatMember.js';

export async function saveChatMemberUpdateRecords(
  database: Database,
  input: {
    inviteLink: ChatInviteLink | null;
    member: ChatMember;
  }
): Promise<void> {
  await database.transaction(async (transaction) => {
    if (input.inviteLink !== null) {
      await saveChatInviteLink(transaction, input.inviteLink);
    }
    await saveChatMember(transaction, input.member);
  });
}

export async function saveChatJoinRequestUpdateRecords(
  database: Database,
  input: {
    inviteLink: ChatInviteLink | null;
    request: ChatJoinRequest;
  }
): Promise<void> {
  await database.transaction(async (transaction) => {
    if (input.inviteLink !== null) {
      await saveChatInviteLink(transaction, input.inviteLink);
    }

    await transaction
      .insert(telegramChatJoinRequests)
      .values(input.request)
      .onConflictDoUpdate({
        set: input.request,
        target: [telegramChatJoinRequests.chatId, telegramChatJoinRequests.userId]
      });
  });
}

export async function saveChatInviteLink(
  database: Database,
  inviteLink: ChatInviteLink
): Promise<void> {
  await database
    .insert(telegramChatInviteLinks)
    .values(inviteLink)
    .onConflictDoUpdate({
      set: inviteLink,
      target: [telegramChatInviteLinks.chatId, telegramChatInviteLinks.inviteLink]
    });
}

async function saveChatMember(database: Database, member: ChatMember): Promise<void> {
  await database
    .insert(telegramChatMembers)
    .values(member)
    .onConflictDoUpdate({
      set: member,
      target: [telegramChatMembers.chatId, telegramChatMembers.memberId]
    });
}

export async function deleteChatMember(database: Database, chatId: string): Promise<void> {
  await database.delete(telegramChatMembers).where(eq(telegramChatMembers.chatId, chatId));
}
