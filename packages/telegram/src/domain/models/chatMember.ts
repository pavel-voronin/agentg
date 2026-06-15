import type { TelegramPayload } from './payload.js';

export type ChatInviteLink = {
  chatId: string;
  createsJoinRequest: boolean;
  creatorUserId: string;
  date: Date;
  editDate: Date;
  expirationDate: Date;
  expiredMemberCount: number;
  inviteLink: string;
  isPrimary: boolean;
  isRevoked: boolean;
  memberCount: number;
  memberLimit: number;
  name: string;
  pendingJoinRequestCount: number;
  subscriptionPricing: TelegramPayload | null;
};

export type ChatMember = {
  chatId: string;
  inviterUserId: string | undefined;
  joinedChatDate: Date;
  memberId: string;
  status: TelegramPayload;
  tag: string;
};

export type ChatJoinRequest = {
  bio: string;
  chatId: string;
  date: Date;
  inviteLink: string | null;
  userChatId: string;
  userId: string;
};
