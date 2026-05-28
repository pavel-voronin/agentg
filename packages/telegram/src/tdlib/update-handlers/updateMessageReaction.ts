import { and, eq } from 'drizzle-orm';

import type { JsonObject, JsonValue } from '@agentg/events/json';

import { telegramMessageReactions } from '../../schema.js';
import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { telegramWireJsonValue, type TelegramWireUpdateByType } from '../wire.js';

type TelegramWireMessageReactionUpdate = TelegramWireUpdateByType<'updateMessageReaction'>;
type TelegramWireReactionType = TelegramWireMessageReactionUpdate['old_reaction_types'][number];
type TelegramWireMessageSender = TelegramWireMessageReactionUpdate['actor_id'];
type StoredReactionRow = {
  isChosen: boolean;
  reactionType: string;
  recentSenderIds: JsonValue;
  totalCount: number;
  usedSenderId: JsonValue;
};

const RECENT_SENDER_IDS_CAP = 3;

export async function handleUpdateMessageReaction(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireMessageReactionUpdate
): Promise<void> {
  const oldReactions = uniqueReactionTypes(update.old_reaction_types);
  const newReactions = uniqueReactionTypes(update.new_reaction_types);
  const removed = [...oldReactions.keys()].filter((key) => !newReactions.has(key));
  const added = [...newReactions.keys()].filter((key) => !oldReactions.has(key));

  if (removed.length === 0 && added.length === 0) {
    return;
  }

  const chatId = String(update.chat_id);
  const messageId = String(update.message_id);
  const actorSender = requiredTelegramWireJsonValue(update.actor_id);
  const actorSenderKey = messageSenderKey(update.actor_id);

  await database.transaction(async (transaction) => {
    const existingRows = await transaction
      .select({
        isChosen: telegramMessageReactions.isChosen,
        reactionType: telegramMessageReactions.reactionType,
        recentSenderIds: telegramMessageReactions.recentSenderIds,
        totalCount: telegramMessageReactions.totalCount,
        usedSenderId: telegramMessageReactions.usedSenderId
      })
      .from(telegramMessageReactions)
      .where(
        and(
          eq(telegramMessageReactions.chatId, chatId),
          eq(telegramMessageReactions.messageId, messageId)
        )
      );

    const existingByReactionType = new Map(
      existingRows.map((row) => [row.reactionType, row] satisfies [string, StoredReactionRow])
    );
    const actorIsCurrentAccountSender = existingRows.some(
      (row) => row.isChosen && messageSenderJsonKey(row.usedSenderId) === actorSenderKey
    );

    for (const reactionType of removed) {
      const row = existingByReactionType.get(reactionType);
      if (row === undefined) {
        continue;
      }

      const totalCount = row.totalCount - 1;
      const rowKey = reactionRowKey(chatId, messageId, reactionType);

      if (totalCount <= 0) {
        await transaction.delete(telegramMessageReactions).where(rowKey);
        existingByReactionType.delete(reactionType);
        continue;
      }

      const shouldClearChosen =
        actorIsCurrentAccountSender &&
        row.isChosen &&
        messageSenderJsonKey(row.usedSenderId) === actorSenderKey;
      const nextRow: StoredReactionRow = {
        isChosen: shouldClearChosen ? false : row.isChosen,
        reactionType,
        recentSenderIds: removeRecentSender(row.recentSenderIds, actorSenderKey),
        totalCount,
        usedSenderId: shouldClearChosen ? requiredTelegramWireJsonValue(null) : row.usedSenderId
      };

      await transaction
        .update(telegramMessageReactions)
        .set({
          isChosen: nextRow.isChosen,
          recentSenderIds: nextRow.recentSenderIds,
          totalCount: nextRow.totalCount,
          usedSenderId: nextRow.usedSenderId
        })
        .where(rowKey);

      existingByReactionType.set(reactionType, nextRow);
    }

    for (const reactionType of added) {
      const row = existingByReactionType.get(reactionType);
      const usedSenderId = actorIsCurrentAccountSender
        ? actorSender
        : requiredTelegramWireJsonValue(null);

      if (row === undefined) {
        await transaction.insert(telegramMessageReactions).values({
          chatId,
          isChosen: actorIsCurrentAccountSender,
          messageId,
          reactionType,
          recentSenderIds: [actorSender],
          totalCount: 1,
          usedSenderId
        });
        continue;
      }

      await transaction
        .update(telegramMessageReactions)
        .set({
          isChosen: actorIsCurrentAccountSender ? true : row.isChosen,
          recentSenderIds: prependRecentSender(row.recentSenderIds, actorSender, actorSenderKey),
          totalCount: row.totalCount + 1,
          usedSenderId: actorIsCurrentAccountSender ? actorSender : row.usedSenderId
        })
        .where(reactionRowKey(chatId, messageId, reactionType));
    }
  });

  await events.publishTelegramStoredMessageUpdated({ chatId, messageId });
}

function uniqueReactionTypes(reactions: readonly TelegramWireReactionType[]): Map<string, true> {
  return new Map(reactions.map((reaction) => [reactionTypeKey(reaction), true]));
}

function reactionTypeKey(reaction: TelegramWireReactionType): string {
  if (reaction._ === 'reactionTypeEmoji') {
    return `emoji:${reaction.emoji}`;
  }
  if (reaction._ === 'reactionTypeCustomEmoji') {
    return `custom_emoji:${reaction.custom_emoji_id}`;
  }
  return 'paid';
}

function reactionRowKey(chatId: string, messageId: string, reactionType: string) {
  return and(
    eq(telegramMessageReactions.chatId, chatId),
    eq(telegramMessageReactions.messageId, messageId),
    eq(telegramMessageReactions.reactionType, reactionType)
  );
}

function removeRecentSender(recentSenderIds: JsonValue, senderKey: string): JsonValue {
  return jsonArray(recentSenderIds).filter(
    (recentSenderId) => messageSenderJsonKey(recentSenderId) !== senderKey
  );
}

function prependRecentSender(
  recentSenderIds: JsonValue,
  sender: JsonValue,
  senderKey: string
): JsonValue {
  return [
    sender,
    ...jsonArray(recentSenderIds).filter(
      (recentSenderId) => messageSenderJsonKey(recentSenderId) !== senderKey
    )
  ].slice(0, RECENT_SENDER_IDS_CAP);
}

function jsonArray(value: JsonValue): JsonValue[] {
  return Array.isArray(value) ? value : [];
}

function messageSenderKey(sender: TelegramWireMessageSender): string {
  if (sender._ === 'messageSenderUser') {
    return `user:${String(sender.user_id)}`;
  }
  return `chat:${String(sender.chat_id)}`;
}

function messageSenderJsonKey(sender: JsonValue): string | undefined {
  if (!isJsonObject(sender)) {
    return undefined;
  }
  if (sender._ === 'messageSenderUser') {
    const userId = jsonId(sender.user_id);
    return userId === undefined ? undefined : `user:${userId}`;
  }
  if (sender._ === 'messageSenderChat') {
    const chatId = jsonId(sender.chat_id);
    return chatId === undefined ? undefined : `chat:${chatId}`;
  }
  return undefined;
}

function jsonId(value: JsonValue | undefined): string | undefined {
  if (typeof value === 'number' || typeof value === 'string') {
    return String(value);
  }
  return undefined;
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredTelegramWireJsonValue(value: unknown): JsonValue {
  const json = telegramWireJsonValue(value);
  if (json === undefined) {
    throw new Error('Expected Telegram wire JSON value');
  }
  return json;
}
