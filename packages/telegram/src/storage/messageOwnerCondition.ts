import { and, eq, sql, type SQL } from 'drizzle-orm';

import { telegramMessages } from '../database/schema.js';
import type { MessageOwner } from '../domain/models/messageSelection.js';

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

export function messageChatCondition(owner: MessageOwner): SQL | undefined {
  return owner.kind === 'savedMessagesTopic'
    ? undefined
    : eq(telegramMessages.chatId, owner.chatId);
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
