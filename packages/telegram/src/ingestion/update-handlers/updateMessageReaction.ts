import { and, eq } from 'drizzle-orm';

import type { JsonObject, JsonValue } from '@agentg/framework';

import { telegramMessages } from '../../database/schema.js';
import { reactionTypeKey } from '../../store/reaction.js';
import { upsertTelegramMessageFragment } from '../../store/message.js';
import { tdJsonValue, type UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type MessageReactionUpdate = UpdateByType<'updateMessageReaction'>;
type ReactionType = MessageReactionUpdate['old_reaction_types'][number];
type MessageSender = MessageReactionUpdate['actor_id'];
type StoredReactionSummary = {
  isChosen: boolean;
  recentSenderIds: JsonValue[];
  totalCount: number;
  type: ReactionType;
  usedSenderId: JsonValue | null;
};

const RECENT_SENDER_IDS_CAP = 3;

export async function handleUpdateMessageReaction(
  update: MessageReactionUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const oldReactions = uniqueReactionTypes(update.old_reaction_types);
  const newReactions = uniqueReactionTypes(update.new_reaction_types);
  const removed = [...oldReactions.keys()].filter((key) => !newReactions.has(key));
  const added = [...newReactions.keys()].filter((key) => !oldReactions.has(key));

  if (removed.length === 0 && added.length === 0) {
    return;
  }

  const chatId = String(update.chat_id);
  const messageId = String(update.message_id);
  const actorSender = requiredJsonValue(update.actor_id);
  const actorSenderKey = messageSenderKey(update.actor_id);

  await database.transaction(async (transaction) => {
    await upsertTelegramMessageFragment(transaction, {
      chatId,
      id: messageId
    });

    const [storedMessage] = await transaction
      .select({ reactions: telegramMessages.reactions })
      .from(telegramMessages)
      .where(and(eq(telegramMessages.chatId, chatId), eq(telegramMessages.id, messageId)))
      .for('update');

    const existingByReactionType = new Map(
      reactionSummariesFromState(storedMessage?.reactions ?? null).map(
        (summary) =>
          [reactionTypeKey(summary.type), summary] satisfies [string, StoredReactionSummary]
      )
    );
    const actorIsCurrentAccountSender = actorSenderKey === resources.account.senderKey();

    for (const reactionType of removed) {
      const row = existingByReactionType.get(reactionType);
      if (row === undefined) {
        continue;
      }

      const totalCount = row.totalCount - 1;

      if (totalCount <= 0) {
        existingByReactionType.delete(reactionType);
        continue;
      }

      const shouldClearChosen =
        actorIsCurrentAccountSender &&
        row.isChosen &&
        messageSenderJsonKey(row.usedSenderId ?? null) === actorSenderKey;
      const nextRow: StoredReactionSummary = {
        isChosen: shouldClearChosen ? false : row.isChosen,
        recentSenderIds: removeRecentSender(row.recentSenderIds, actorSenderKey),
        totalCount,
        type: row.type,
        usedSenderId: shouldClearChosen ? null : row.usedSenderId
      };

      existingByReactionType.set(reactionType, nextRow);
    }

    for (const [reactionType, type] of added.map((key) => [key, newReactions.get(key)] as const)) {
      if (type === undefined) {
        continue;
      }
      const row = existingByReactionType.get(reactionType);
      const usedSenderId = actorIsCurrentAccountSender ? actorSender : null;

      if (row === undefined) {
        existingByReactionType.set(reactionType, {
          isChosen: actorIsCurrentAccountSender,
          recentSenderIds: [actorSender],
          totalCount: 1,
          type,
          usedSenderId
        });
        continue;
      }

      existingByReactionType.set(reactionType, {
        isChosen: actorIsCurrentAccountSender ? true : row.isChosen,
        recentSenderIds: prependRecentSender(row.recentSenderIds, actorSender, actorSenderKey),
        totalCount: row.totalCount + 1,
        type: row.type,
        usedSenderId: actorIsCurrentAccountSender ? actorSender : row.usedSenderId
      });
    }

    await upsertTelegramMessageFragment(transaction, {
      chatId,
      id: messageId,
      reactions: reactionStateWithSummaries(storedMessage?.reactions ?? null, [
        ...existingByReactionType.values()
      ])
    });
  });

  await events.publishTelegramStoredMessageUpdated({ chatId, messageId });
}

function uniqueReactionTypes(reactions: readonly ReactionType[]): Map<string, ReactionType> {
  return new Map(reactions.map((reaction) => [reactionTypeKey(reaction), reaction]));
}

function removeRecentSender(recentSenderIds: JsonValue[], senderKey: string): JsonValue[] {
  return recentSenderIds.filter(
    (recentSenderId) => messageSenderJsonKey(recentSenderId) !== senderKey
  );
}

function prependRecentSender(
  recentSenderIds: JsonValue[],
  sender: JsonValue,
  senderKey: string
): JsonValue[] {
  return [
    sender,
    ...recentSenderIds.filter(
      (recentSenderId) => messageSenderJsonKey(recentSenderId) !== senderKey
    )
  ].slice(0, RECENT_SENDER_IDS_CAP);
}

function reactionSummariesFromState(value: JsonValue | null): StoredReactionSummary[] {
  if (!isJsonObject(value) || !Array.isArray(value.reactions)) {
    return [];
  }
  return value.reactions.map(reactionSummaryFromJson).filter(isDefined);
}

function reactionSummaryFromJson(value: JsonValue): StoredReactionSummary | undefined {
  if (!isJsonObject(value)) {
    return undefined;
  }
  const type = reactionTypeFromJson(value.type);
  const totalCount = nonNegativeInteger(value.total_count);
  if (type === undefined || totalCount === undefined) {
    return undefined;
  }
  return {
    isChosen: value.is_chosen === true,
    recentSenderIds: Array.isArray(value.recent_sender_ids) ? value.recent_sender_ids : [],
    totalCount,
    type,
    usedSenderId: value.used_sender_id === undefined ? null : value.used_sender_id
  };
}

function reactionTypeFromJson(value: JsonValue | undefined): ReactionType | undefined {
  if (!isJsonObject(value) || typeof value._ !== 'string') {
    return undefined;
  }
  if (value._ === 'reactionTypeEmoji' && typeof value.emoji === 'string') {
    return value as ReactionType;
  }
  if (
    value._ === 'reactionTypeCustomEmoji' &&
    (typeof value.custom_emoji_id === 'number' || typeof value.custom_emoji_id === 'string')
  ) {
    return value as ReactionType;
  }
  if (value._ === 'reactionTypePaid') {
    return value as ReactionType;
  }
  return undefined;
}

function reactionStateWithSummaries(
  current: JsonValue | null,
  summaries: StoredReactionSummary[]
): JsonValue {
  const state = isJsonObject(current) ? { ...current } : {};
  state.reactions = summaries.map(reactionSummaryToJson);
  return state;
}

function reactionSummaryToJson(summary: StoredReactionSummary): JsonValue {
  return {
    is_chosen: summary.isChosen,
    recent_sender_ids: summary.recentSenderIds,
    total_count: summary.totalCount,
    type: requiredJsonValue(summary.type),
    used_sender_id: summary.usedSenderId
  };
}

function nonNegativeInteger(value: JsonValue | undefined): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function messageSenderKey(sender: MessageSender): string {
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

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredJsonValue(value: unknown): JsonValue {
  const json = tdJsonValue(value);
  if (json === undefined) {
    throw new Error('Expected Telegram wire JSON value');
  }
  return json;
}
