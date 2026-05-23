import { and, eq, inArray } from 'drizzle-orm';

import { TELEGRAM_MESSAGE_MODEL, telegramMessageModelId } from '../modelRefs.js';
import type { TelegramDatabase } from '../database.js';
import { telegramFileSlots, telegramMessageReactions, telegramMessages } from '../schema.js';
import {
  telegramWireDate,
  telegramWireId,
  telegramWireJsonObject,
  telegramWireJsonValue,
  type TelegramWireMessage,
  type TelegramWireMessageContentUpdate,
  type TelegramWireObject
} from '../telegramWire.js';
import type { TelegramFileSubsystem } from '../telegramFileSubsystem.js';
import type { TelegramMediaDownloadPolicyCause } from '../telegramFilePolicy.js';

export type TelegramMessageTextEntity = {
  kind: 'textUrl' | 'url';
  length: number;
  offset: number;
  url: string;
};

export type TelegramMessageServiceAction = {
  kind: 'chatMemberLeft';
  userId: string;
};

type StoreMessageConflict = 'ignore' | 'update';

export async function storeMessage(
  database: TelegramDatabase,
  message: TelegramWireMessage,
  conflict: StoreMessageConflict = 'update'
): Promise<boolean> {
  const row: typeof telegramMessages.$inferInsert = {
    authorSignature: message.author_signature,
    autoDeleteIn: message.auto_delete_in,
    canBeSaved: message.can_be_saved,
    chatId: String(message.chat_id),
    containsUnreadMention: message.contains_unread_mention,
    containsUnreadPollVotes: undefined,
    content: telegramWireJsonObject(message.content),
    date: telegramWireDate(message.date),
    editDate: telegramWireDate(message.edit_date),
    effectId: telegramWireId(message.effect_id),
    factCheck: telegramWireJsonValue(message.fact_check),
    forwardInfo: telegramWireJsonValue(message.forward_info),
    guestBotCallerId: undefined,
    hasTimestampedMedia: message.has_timestamped_media,
    id: String(message.id),
    importInfo: telegramWireJsonValue(message.import_info),
    interactionInfo: telegramWireJsonValue(message.interaction_info),
    isChannelPost: message.is_channel_post,
    isFromOffline: message.is_from_offline,
    isOutgoing: message.is_outgoing,
    isPaidStarSuggestedPost: message.is_paid_star_suggested_post,
    isPaidTonSuggestedPost: message.is_paid_ton_suggested_post,
    isPinned: message.is_pinned,
    mediaAlbumId: telegramWireId(message.media_album_id),
    paidMessageStarCount: telegramWireId(message.paid_message_star_count),
    replyMarkup: telegramWireJsonValue(message.reply_markup),
    replyTo: telegramWireJsonValue(message.reply_to),
    restrictionInfo: telegramWireJsonValue(message.restriction_info),
    schedulingState: telegramWireJsonValue(message.scheduling_state),
    selfDestructIn: message.self_destruct_in,
    selfDestructType: telegramWireJsonValue(message.self_destruct_type),
    senderBoostCount: message.sender_boost_count,
    senderBusinessBotUserId: telegramWireId(message.sender_business_bot_user_id),
    senderId: telegramWireJsonObject(message.sender_id),
    senderTag: message.sender_tag,
    sendingState: telegramWireJsonValue(message.sending_state),
    suggestedPostInfo: telegramWireJsonValue(message.suggested_post_info),
    summaryLanguageCode: message.summary_language_code,
    topicId: telegramWireJsonValue(message.topic_id),
    unreadReactions: telegramWireJsonValue(message.unread_reactions),
    viaBotUserId: telegramWireId(message.via_bot_user_id)
  };

  const insert = database.insert(telegramMessages).values(row);
  const stored =
    conflict === 'ignore'
      ? await insert
          .onConflictDoNothing({
            target: [telegramMessages.chatId, telegramMessages.id]
          })
          .returning({
            telegramMessageId: telegramMessages.id
          })
      : await insert
          .onConflictDoUpdate({
            set: row,
            target: [telegramMessages.chatId, telegramMessages.id]
          })
          .returning({
            telegramMessageId: telegramMessages.id
          });

  if (stored.length === 0) {
    return false;
  }

  return true;
}

export async function replaceMessageContent(
  database: TelegramDatabase,
  update: TelegramWireMessageContentUpdate
): Promise<void> {
  await database
    .insert(telegramMessages)
    .values({
      chatId: String(update.chat_id),
      content: telegramWireJsonObject(update.new_content),
      id: String(update.message_id)
    })
    .onConflictDoUpdate({
      set: {
        content: telegramWireJsonObject(update.new_content)
      },
      target: [telegramMessages.chatId, telegramMessages.id]
    });
}

export async function deleteMessages(
  database: TelegramDatabase,
  input: {
    chatId: string;
    messageIds: string[];
  }
): Promise<void> {
  await database.transaction(async (transaction) => {
    await transaction.delete(telegramFileSlots).where(
      and(
        eq(telegramFileSlots.ownerModel, TELEGRAM_MESSAGE_MODEL),
        inArray(
          telegramFileSlots.ownerId,
          input.messageIds.map((messageId) => telegramMessageModelId(input.chatId, messageId))
        )
      )
    );

    await transaction
      .delete(telegramMessageReactions)
      .where(
        and(
          eq(telegramMessageReactions.chatId, input.chatId),
          inArray(telegramMessageReactions.messageId, input.messageIds)
        )
      );
    await transaction
      .delete(telegramMessages)
      .where(
        and(
          eq(telegramMessages.chatId, input.chatId),
          inArray(telegramMessages.id, input.messageIds)
        )
      );
  });
}

export function recordMessageFiles(
  files: TelegramFileSubsystem,
  message: TelegramWireMessage,
  cause: TelegramMediaDownloadPolicyCause
): Promise<void> {
  return files.recordMessageFiles(message, cause);
}

export function recordMessageContentFiles(
  files: TelegramFileSubsystem,
  update: TelegramWireMessageContentUpdate,
  cause: TelegramMediaDownloadPolicyCause
): Promise<void> {
  return files.recordMessageContentFiles(update, cause);
}

export function messageCreatedEventInput(message: TelegramWireMessage) {
  const senderId = messageSenderId(message);
  const senderType = message.sender_id._;
  const text = messageText(message);
  const messageDate = telegramWireDate(message.date);

  return {
    chatId: String(message.chat_id),
    contentType: message.content._,
    isOutgoing: message.is_outgoing,
    messageId: String(message.id),
    textEntities: messageTextEntities(message),
    ...(messageDate === undefined ? {} : { messageDate }),
    ...(senderId === undefined ? {} : { senderId }),
    senderType,
    ...(text === undefined ? {} : { text })
  };
}

export function messageContentUpdatedEventInput(update: TelegramWireMessageContentUpdate) {
  const text = messageContentText(update.new_content);
  const serviceAction = messageContentServiceAction(update.new_content);

  return {
    chatId: String(update.chat_id),
    contentType: update.new_content._,
    messageId: String(update.message_id),
    textEntities: messageContentTextEntities(update.new_content),
    ...(text === undefined ? {} : { text }),
    ...(serviceAction === undefined ? {} : { serviceAction })
  };
}

function messageSenderId(message: TelegramWireMessage): string | undefined {
  const sender = message.sender_id as TelegramWireObject;
  return jsonId(sender.user_id) ?? jsonId(sender.chat_id);
}

function messageText(message: TelegramWireMessage): string | undefined {
  return messageContentText(message.content);
}

function messageTextEntities(message: TelegramWireMessage): TelegramMessageTextEntity[] {
  return messageContentTextEntities(message.content);
}

function messageContentText(content: unknown): string | undefined {
  const text = messageTextContent(content);
  return typeof text?.text === 'string' ? text.text : undefined;
}

function messageContentTextEntities(content: unknown): TelegramMessageTextEntity[] {
  const text = messageTextContent(content);
  return text === undefined ? [] : extractFormattedTextLinkEntities(text);
}

function messageContentServiceAction(content: unknown): TelegramMessageServiceAction | undefined {
  const object = recordValue(content);
  if (object?._ !== 'messageChatDeleteMember') {
    return undefined;
  }

  const userId = jsonId(object.user_id);
  return userId === undefined
    ? undefined
    : {
        kind: 'chatMemberLeft',
        userId
      };
}

function messageTextContent(content: unknown): TelegramWireObject | undefined {
  const object = recordValue(content);
  if (object?._ !== 'messageText') {
    return undefined;
  }
  return recordValue(object.text);
}

function extractFormattedTextLinkEntities(value: unknown): TelegramMessageTextEntity[] {
  const formattedText = recordValue(value);
  const text = typeof formattedText?.text === 'string' ? formattedText.text : '';
  const sourceEntities = Array.isArray(formattedText?.entities) ? formattedText.entities : [];
  const entities = sourceEntities
    .map((entity) => telegramTextLinkEntity(entity, text))
    .filter((entity): entity is TelegramMessageTextEntity => entity !== undefined)
    .sort(compareTextEntities);

  const result: TelegramMessageTextEntity[] = [];
  let consumedUntil = 0;
  for (const entity of entities) {
    if (entity.offset < consumedUntil) {
      continue;
    }
    result.push(entity);
    consumedUntil = entity.offset + entity.length;
  }
  return result;
}

function telegramTextLinkEntity(
  value: unknown,
  text: string
): TelegramMessageTextEntity | undefined {
  const entity = recordValue(value);
  const type = recordValue(entity?.type);
  const offset = safeInteger(entity?.offset);
  const length = safeInteger(entity?.length);
  if (
    offset === undefined ||
    length === undefined ||
    length <= 0 ||
    offset < 0 ||
    offset + length > text.length
  ) {
    return undefined;
  }

  if (type?._ === 'textEntityTypeUrl') {
    const url = normalizeHttpUrl(text.slice(offset, offset + length), true);
    return url === null ? undefined : { kind: 'url', length, offset, url };
  }

  if (type?._ === 'textEntityTypeTextUrl') {
    const url = normalizeHttpUrl(type.url, false);
    return url === null ? undefined : { kind: 'textUrl', length, offset, url };
  }

  return undefined;
}

function normalizeHttpUrl(value: unknown, allowMissingProtocol: boolean): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const directUrl = parseHttpUrl(trimmed);
  if (directUrl !== null || !allowMissingProtocol) {
    return directUrl;
  }
  return parseHttpUrl(`https://${trimmed}`);
}

function parseHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function compareTextEntities(
  left: TelegramMessageTextEntity,
  right: TelegramMessageTextEntity
): number {
  if (left.offset !== right.offset) {
    return left.offset - right.offset;
  }
  return right.length - left.length;
}

function safeInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : undefined;
}

function jsonId(value: unknown): string | undefined {
  return typeof value === 'number' || typeof value === 'string' ? telegramWireId(value) : undefined;
}

function recordValue(value: unknown): TelegramWireObject | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as TelegramWireObject)
    : undefined;
}
