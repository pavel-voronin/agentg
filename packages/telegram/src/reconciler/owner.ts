import { and, eq, sql, type SQL } from 'drizzle-orm';

import { telegramMessages } from '../database/schema.js';
import type { MessageOwner } from '../procedures/get-messages/contract.js';

export type OwnerKind =
  | 'chat'
  | 'direct_messages_topic'
  | 'forum_topic'
  | 'message_thread'
  | 'saved_messages_topic';

export const ownerKindValues = [
  'chat',
  'direct_messages_topic',
  'forum_topic',
  'message_thread',
  'saved_messages_topic'
] satisfies OwnerKind[];

export type NormalizedMessageOwner = {
  chatId?: string | undefined;
  key: string;
  kind: OwnerKind;
  owner: MessageOwner;
};

export function normalizeMessageOwner(owner: MessageOwner): NormalizedMessageOwner {
  switch (owner.kind) {
    case 'chat':
      return {
        chatId: owner.chatId,
        key: `chat:${owner.chatId}`,
        kind: 'chat',
        owner
      };
    case 'forumTopic':
      return {
        chatId: owner.chatId,
        key: `forum-topic:${owner.chatId}:${owner.topicId}`,
        kind: 'forum_topic',
        owner
      };
    case 'directMessagesTopic':
      return {
        chatId: owner.chatId,
        key: `direct-messages-topic:${owner.chatId}:${owner.topicId}`,
        kind: 'direct_messages_topic',
        owner
      };
    case 'savedMessagesTopic':
      return {
        key: `saved-messages-topic:${owner.topicId}`,
        kind: 'saved_messages_topic',
        owner
      };
    case 'messageThread':
      return {
        chatId: owner.chatId,
        key: `message-thread:${owner.chatId}:${owner.messageId}`,
        kind: 'message_thread',
        owner
      };
  }
}

export function ownerMessageCondition(owner: MessageOwner): SQL {
  switch (owner.kind) {
    case 'chat':
      return eq(telegramMessages.chatId, owner.chatId);
    case 'forumTopic':
      return (
        and(
          eq(telegramMessages.chatId, owner.chatId),
          topicTypeCondition('messageTopicForum'),
          topicFieldCondition('forum_topic_id', owner.topicId)
        ) ?? missingOwnerCondition(owner.kind)
      );
    case 'directMessagesTopic':
      return (
        and(
          eq(telegramMessages.chatId, owner.chatId),
          topicTypeCondition('messageTopicDirectMessages'),
          topicFieldCondition('direct_messages_chat_topic_id', owner.topicId)
        ) ?? missingOwnerCondition(owner.kind)
      );
    case 'savedMessagesTopic':
      return (
        and(
          topicTypeCondition('messageTopicSavedMessages'),
          topicFieldCondition('saved_messages_topic_id', owner.topicId)
        ) ?? missingOwnerCondition(owner.kind)
      );
    case 'messageThread':
      return (
        and(
          eq(telegramMessages.chatId, owner.chatId),
          topicTypeCondition('messageTopicThread'),
          topicFieldCondition('message_thread_id', owner.messageId)
        ) ?? missingOwnerCondition(owner.kind)
      );
  }
}

export function parseTdlibInt53(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${label} must be a TDLib int53 decimal string: ${value}`);
  }
  return parsed;
}

function topicTypeCondition(type: string): SQL {
  return sql`${telegramMessages.topicId}->>'_' = ${type}`;
}

function topicFieldCondition(field: string, value: string): SQL {
  return sql`${telegramMessages.topicId}->>${field} = ${value}`;
}

function missingOwnerCondition(kind: MessageOwner['kind']): never {
  throw new Error(`Missing owner message condition for ${kind}`);
}
