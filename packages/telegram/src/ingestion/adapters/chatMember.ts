import type {
  ChatJoinRequestSavedChange,
  ChatMemberSavedChange,
  DomainChange
} from '../../domain/changes.js';
import type {
  ChatInviteLink,
  ChatJoinRequest,
  ChatMember
} from '../../domain/models/chatMember.js';
import { tdDate, tdId, tdJsonObject, tdJsonValue, type UpdateByType } from '../../tdlib/shape.js';

type ChatMemberUpdate = UpdateByType<'updateChatMember'>;
type TdlibChatInviteLink = NonNullable<ChatMemberUpdate['invite_link']>;
type TdlibChatMember = ChatMemberUpdate['new_chat_member'];
type MessageSender = TdlibChatMember['member_id'];
type NewChatJoinRequestUpdate = UpdateByType<'updateNewChatJoinRequest'>;

export function chatMemberChanges(update: ChatMemberUpdate): DomainChange[] {
  const chatId = String(update.chat_id);
  const inviteLink = update.invite_link ?? null;
  return [
    {
      kind: 'chatMember.saved',
      input: {
        inviteLink: inviteLink === null ? null : chatInviteLinkRecord(chatId, inviteLink),
        member: chatMemberRecord(chatId, update.new_chat_member)
      }
    } satisfies ChatMemberSavedChange
  ];
}

export function chatJoinRequestChanges(update: NewChatJoinRequestUpdate): DomainChange[] {
  const chatId = String(update.chat_id);
  const inviteLink = update.invite_link ?? null;
  return [
    {
      kind: 'chatJoinRequest.saved',
      input: {
        inviteLink: inviteLink === null ? null : chatInviteLinkRecord(chatId, inviteLink),
        request: chatJoinRequestRecord(chatId, update)
      }
    } satisfies ChatJoinRequestSavedChange
  ];
}

function chatInviteLinkRecord(chatId: string, inviteLink: TdlibChatInviteLink): ChatInviteLink {
  return {
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
}

function chatMemberRecord(chatId: string, chatMember: TdlibChatMember): ChatMember {
  return {
    chatId,
    inviterUserId: tdId(chatMember.inviter_user_id),
    joinedChatDate: unixDate(chatMember.joined_chat_date),
    memberId: messageSenderId(chatMember.member_id),
    status: tdJsonObject(chatMember.status),
    tag: chatMember.tag
  };
}

function chatJoinRequestRecord(chatId: string, update: NewChatJoinRequestUpdate): ChatJoinRequest {
  return {
    bio: update.request.bio,
    chatId,
    date: unixDate(update.request.date),
    inviteLink: update.invite_link?.invite_link ?? null,
    userChatId: String(update.user_chat_id),
    userId: String(update.request.user_id)
  };
}

function messageSenderId(sender: MessageSender): string {
  if (sender._ === 'messageSenderUser') {
    return String(sender.user_id);
  }
  return String(sender.chat_id);
}

function unixDate(value: number): Date {
  const date = tdDate(value);
  if (date === undefined) {
    throw new Error('Expected Telegram wire date');
  }
  return date;
}
