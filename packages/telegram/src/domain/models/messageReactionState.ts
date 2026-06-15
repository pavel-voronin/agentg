import type { TelegramPayload, TelegramPayloadObject } from './payload.js';

export type MessageReactionSender = {
  key: string;
  payload: TelegramPayloadObject;
};

export type MessageReactionType = {
  key: string;
  payload: TelegramPayloadObject;
};

export type MessageReactionSummary = {
  constructorName: string | null;
  isChosen: boolean;
  reactionType: MessageReactionType;
  recentSenders: MessageReactionSender[];
  totalCount: number;
  usedSender: MessageReactionSender | null;
};

export function messageReactionSummariesFromJsonState(
  value: TelegramPayload | null
): MessageReactionSummary[] {
  if (!isTelegramPayloadObject(value) || !Array.isArray(value.reactions)) {
    return [];
  }
  return value.reactions.map(messageReactionSummaryFromJson).filter(isDefined);
}

export function messageReactionStateWithSummaries(
  current: TelegramPayload | null,
  summaries: readonly MessageReactionSummary[]
): TelegramPayload {
  const state = isTelegramPayloadObject(current) ? { ...current } : {};
  state.reactions = summaries.map(messageReactionSummaryToJson);
  return state;
}

function messageReactionSummaryFromJson(
  value: TelegramPayload
): MessageReactionSummary | undefined {
  if (!isTelegramPayloadObject(value)) {
    return undefined;
  }
  const reactionType = messageReactionTypeFromPayload(value.type);
  const totalCount = nonNegativeInteger(value.total_count);
  if (reactionType === null || totalCount === undefined) {
    return undefined;
  }
  const recentSenders = Array.isArray(value.recent_sender_ids)
    ? value.recent_sender_ids.map(messageReactionSenderFromPayload).filter(isDefined)
    : [];
  return {
    constructorName: typeof value._ === 'string' ? value._ : null,
    isChosen: value.is_chosen === true,
    reactionType,
    recentSenders,
    totalCount,
    usedSender: messageReactionSenderFromPayload(value.used_sender_id)
  };
}

export function messageReactionTypeFromPayload(
  value: TelegramPayload | undefined
): MessageReactionType | null {
  if (!isTelegramPayloadObject(value)) {
    return null;
  }
  if (value._ === 'reactionTypeEmoji' && typeof value.emoji === 'string') {
    return { key: `emoji:${value.emoji}`, payload: value };
  }
  if (
    value._ === 'reactionTypeCustomEmoji' &&
    (typeof value.custom_emoji_id === 'number' || typeof value.custom_emoji_id === 'string')
  ) {
    return { key: `custom_emoji:${String(value.custom_emoji_id)}`, payload: value };
  }
  return value._ === 'reactionTypePaid' ? { key: 'paid', payload: value } : null;
}

export function messageReactionSenderFromPayload(
  value: TelegramPayload | undefined
): MessageReactionSender | null {
  if (!isTelegramPayloadObject(value)) {
    return null;
  }
  if (value._ === 'messageSenderUser') {
    const userId = payloadId(value.user_id);
    return userId === undefined ? null : { key: `user:${userId}`, payload: value };
  }
  if (value._ === 'messageSenderChat') {
    const chatId = payloadId(value.chat_id);
    return chatId === undefined ? null : { key: `chat:${chatId}`, payload: value };
  }
  return null;
}

function messageReactionSummaryToJson(summary: MessageReactionSummary): TelegramPayload {
  return {
    ...(summary.constructorName === null ? {} : { _: summary.constructorName }),
    is_chosen: summary.isChosen,
    recent_sender_ids: summary.recentSenders.map((sender) => sender.payload),
    total_count: summary.totalCount,
    type: summary.reactionType.payload,
    used_sender_id: summary.usedSender?.payload ?? null
  };
}

function payloadId(value: TelegramPayload | undefined): string | undefined {
  if (typeof value === 'number' || typeof value === 'string') {
    return String(value);
  }
  return undefined;
}

function nonNegativeInteger(value: TelegramPayload | undefined): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function isTelegramPayloadObject(
  value: TelegramPayload | null | undefined
): value is TelegramPayloadObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
