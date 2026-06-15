import type {
  FileRef,
  Message,
  MessageReaction,
  MessageServiceAction,
  MessageTextEntity
} from './message.js';
import type { MessageReactionSummary } from './messageReactionState.js';
import { toNullableIsoString, type DateLike } from './scalars.js';
import { chatRef, messageRef, messageSenderRef } from '../../model/refs.js';

export type MessageProjectionInput = {
  chatId: string;
  contentType: string;
  deletedAt: DateLike | null;
  editDate: DateLike | null;
  files?: readonly FileRef[] | undefined;
  isDeleted: boolean;
  isOutgoing: boolean;
  messageDate: DateLike | null;
  messageId: string;
  reactionSummaries: readonly MessageReactionSummary[];
  replyChatId?: string | null | undefined;
  replyMessageId?: string | null | undefined;
  senderDisplayName?: string | null | undefined;
  senderId: string | null;
  senderType: string | null;
  serviceAction?: MessageServiceAction | null | undefined;
  text: string | null;
  textEntities: readonly MessageTextEntity[];
};

export function messageFromProjection(input: MessageProjectionInput): Message {
  return {
    ...messageRef({
      chatId: input.chatId,
      messageId: input.messageId
    }),
    chat: chatRef(input.chatId),
    contentType: input.contentType,
    deletedAt: toNullableIsoString(input.deletedAt),
    editDate: toNullableIsoString(input.editDate),
    isDeleted: input.isDeleted,
    isOutgoing: input.isOutgoing,
    media: {
      files: [...(input.files ?? [])]
    },
    messageDate: toNullableIsoString(input.messageDate),
    reactions: input.reactionSummaries.map(messageReactionFromSummary),
    replyTo: messageReply(input),
    sender: messageSenderRef(input.senderType, input.senderId),
    senderDisplayName: input.senderDisplayName ?? null,
    senderType: input.senderType,
    serviceAction: input.serviceAction ?? null,
    telegramMessageId: input.messageId,
    text: input.text,
    textEntities: [...input.textEntities]
  };
}

function messageReactionFromSummary(summary: MessageReactionSummary): MessageReaction {
  return {
    isChosen: summary.isChosen,
    reactionType: summary.reactionType.key,
    recentSenderIds: summary.recentSenders.map((sender) => sender.payload),
    totalCount: summary.totalCount,
    usedSenderId: summary.usedSender?.payload ?? null
  };
}

function messageReply(input: MessageProjectionInput): Message['replyTo'] {
  if (input.replyMessageId === null || input.replyMessageId === undefined) {
    return null;
  }
  const chatId = input.replyChatId ?? input.chatId;
  return {
    chat: chatRef(chatId),
    message: messageRef({ chatId, messageId: input.replyMessageId }),
    telegramMessageId: input.replyMessageId
  };
}
