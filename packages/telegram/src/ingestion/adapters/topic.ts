import type { JsonValue } from '@agentg/framework';

import type {
  DirectMessagesChatTopicSavedChange,
  DomainChange,
  SavedMessagesTagsReplacedChange,
  SavedMessagesTopicSavedChange
} from '../../domain/changes.js';
import type { DirectMessagesChatTopic, SavedMessagesTopic } from '../../domain/models/topic.js';
import { tdJsonObject, tdJsonValue, type UpdateByType } from '../../tdlib/shape.js';
import { savedMessageChanges } from './message.js';

type SavedMessagesTopicUpdate = UpdateByType<'updateSavedMessagesTopic'>;
type TdlibSavedMessagesTopic = SavedMessagesTopicUpdate['topic'];
type SavedMessagesTagsUpdate = UpdateByType<'updateSavedMessagesTags'>;
type DirectMessagesChatTopicUpdate = UpdateByType<'updateDirectMessagesChatTopic'>;
type TdlibDirectMessagesChatTopic = DirectMessagesChatTopicUpdate['topic'];
type ReactionType = SavedMessagesTagsUpdate['tags']['tags'][number]['tag'];

export function savedMessagesTopicChanges(update: SavedMessagesTopicUpdate): DomainChange[] {
  const lastMessage = update.topic.last_message ?? null;
  return [
    ...(lastMessage === null ? [] : savedMessageChanges(lastMessage)),
    {
      kind: 'savedMessagesTopic.saved',
      topic: savedMessagesTopicRecord(update.topic)
    } satisfies SavedMessagesTopicSavedChange
  ];
}

export function savedMessagesTagsChanges(update: SavedMessagesTagsUpdate): DomainChange[] {
  const savedMessagesTopicId = String(update.saved_messages_topic_id);
  return [
    {
      kind: 'savedMessagesTags.replaced',
      input: {
        records: update.tags.tags.map((tag) => ({
          count: tag.count,
          label: tag.label,
          savedMessagesTopicId,
          tag: reactionTypeKey(tag.tag)
        })),
        savedMessagesTopicId
      }
    } satisfies SavedMessagesTagsReplacedChange
  ];
}

export function directMessagesChatTopicChanges(
  update: DirectMessagesChatTopicUpdate
): DomainChange[] {
  const lastMessage = update.topic.last_message ?? null;
  return [
    ...(lastMessage === null ? [] : savedMessageChanges(lastMessage)),
    {
      kind: 'directMessagesChatTopic.saved',
      topic: directMessagesChatTopicRecord(update.topic)
    } satisfies DirectMessagesChatTopicSavedChange
  ];
}

function savedMessagesTopicRecord(topic: TdlibSavedMessagesTopic): SavedMessagesTopic {
  const lastMessage = topic.last_message ?? null;
  return {
    draftMessage: requiredJsonValue(topic.draft_message ?? null),
    id: String(topic.id),
    isPinned: topic.is_pinned,
    lastMessageChatId: lastMessage === null ? null : String(lastMessage.chat_id),
    lastMessageId: lastMessage === null ? null : String(lastMessage.id),
    order: topic.order,
    type: tdJsonObject(topic.type)
  };
}

function directMessagesChatTopicRecord(
  topic: TdlibDirectMessagesChatTopic
): DirectMessagesChatTopic {
  const lastMessage = topic.last_message ?? null;
  return {
    canSendUnpaidMessages: topic.can_send_unpaid_messages,
    chatId: String(topic.chat_id),
    draftMessage: nullableJsonValue(topic.draft_message),
    id: String(topic.id),
    isMarkedAsUnread: topic.is_marked_as_unread,
    lastMessageChatId: lastMessage === null ? null : String(lastMessage.chat_id),
    lastMessageId: lastMessage === null ? null : String(lastMessage.id),
    lastReadInboxMessageId: String(topic.last_read_inbox_message_id),
    lastReadOutboxMessageId: String(topic.last_read_outbox_message_id),
    order: topic.order,
    senderId: tdJsonObject(topic.sender_id),
    unreadCount: String(topic.unread_count),
    unreadReactionCount: String(topic.unread_reaction_count)
  };
}

function reactionTypeKey(type: ReactionType): string {
  if (type._ === 'reactionTypeEmoji' && typeof type.emoji === 'string') {
    return `emoji:${type.emoji}`;
  }
  if (type._ === 'reactionTypeCustomEmoji') {
    return `custom_emoji:${type.custom_emoji_id}`;
  }
  if (type._ === 'reactionTypePaid') {
    return 'paid';
  }
  throw new Error(`Unsupported reaction type: ${type._}`);
}

function nullableJsonValue(value: unknown): JsonValue {
  return tdJsonValue(value ?? null) ?? null;
}

function requiredJsonValue(value: unknown): JsonValue {
  const json = tdJsonValue(value);
  if (json === undefined) {
    throw new Error('Expected Telegram wire JSON value');
  }
  return json;
}
