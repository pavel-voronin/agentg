import type { FileRef, Message } from '../domain/models/message.js';
import { messageFromProjection } from '../domain/models/messageProjection.js';
import { messageReactionSummariesFromJsonState } from '../domain/models/messageReactionState.js';
import type { MessageStorageRow } from '../storage/messageRowStorage.js';

export function messageFromStorageRow(row: MessageStorageRow, files: FileRef[] = []): Message {
  return messageFromProjection({
    chatId: row.telegramChatId,
    contentType: row.contentType,
    deletedAt: row.deletedAt,
    editDate: row.editDate,
    files,
    isDeleted: row.isDeleted,
    isOutgoing: row.isOutgoing,
    messageDate: row.messageDate,
    messageId: row.telegramMessageId,
    reactionSummaries: messageReactionSummariesFromJsonState(row.reactions),
    replyChatId: row.replyChatId,
    replyMessageId: row.replyMessageId,
    senderId: row.senderId,
    senderDisplayName: null,
    senderType: row.senderType,
    serviceAction: null,
    text: row.text,
    textEntities: row.textEntities
  });
}

export function messagePreview(message: Message): {
  placeholder: boolean;
  text: string;
} {
  if (message.text !== null && message.text.length > 0) {
    return {
      placeholder: false,
      text: message.text
    };
  }

  const label = messageContentLabel(message.contentType);
  return {
    placeholder: label === null,
    text: label ?? 'Unsupported message'
  };
}

export function outgoingMessageRead(
  lastReadOutboxMessageIdValue: string | null,
  messageIdValue: string
): boolean | null {
  const messageId = parseNonNegativeBigInt(messageIdValue);
  const lastReadOutboxMessageId = parseNonNegativeBigInt(lastReadOutboxMessageIdValue);
  if (messageId === undefined || lastReadOutboxMessageId === undefined) {
    return null;
  }
  return messageId <= lastReadOutboxMessageId;
}

function messageContentLabel(contentType: string): string | null {
  switch (contentType) {
    case 'messageAnimation':
      return 'GIF';
    case 'messageAudio':
      return 'Audio';
    case 'messageChatAddMembers':
      return 'Members joined';
    case 'messageChatChangePhoto':
      return 'Chat photo updated';
    case 'messageChatChangeTitle':
      return 'Chat title updated';
    case 'messageChatDeleteMember':
      return 'Member left';
    case 'messageChatDeletePhoto':
      return 'Chat photo removed';
    case 'messageContact':
      return 'Contact';
    case 'messageDocument':
      return 'File';
    case 'messageExpiredPhoto':
      return 'Expired photo';
    case 'messageExpiredVideo':
      return 'Expired video';
    case 'messageGame':
      return 'Game';
    case 'messageInvoice':
      return 'Invoice';
    case 'messageLocation':
      return 'Location';
    case 'messagePhoto':
      return 'Photo';
    case 'messagePoll':
      return 'Poll';
    case 'messageSticker':
      return 'Sticker';
    case 'messageVideo':
      return 'Video';
    case 'messageVideoNote':
      return 'Video message';
    case 'messageVoiceNote':
      return 'Voice message';
    default:
      return null;
  }
}

function parseNonNegativeBigInt(value: unknown): bigint | undefined {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
    return BigInt(value);
  }

  if (typeof value === 'string' && /^[0-9]+$/.test(value)) {
    return BigInt(value);
  }

  return undefined;
}
