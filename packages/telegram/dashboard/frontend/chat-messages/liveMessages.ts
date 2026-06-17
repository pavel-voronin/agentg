import type { Message } from '../../../src/domain/models/message.js';
import type { MessageTarget, MessageView, TimelineDateItem } from './types.js';
import {
  buildMessageView,
  formatMessageDateLabel,
  messageDateKey,
  messageServiceLabel,
  sortMessages
} from './timeline.js';

export type LiveMessageChat = {
  avatarUrl: string | null;
  title: string;
};

export type LiveMessageItem = {
  chatAvatarUrl: string | null;
  chatId: string;
  chatTitle: string;
  dateLabel: string;
  id: string;
  kind: 'message';
  message: Message;
  view: MessageView;
};

export type LiveServiceItem = {
  chatAvatarUrl: string | null;
  chatId: string;
  chatTitle: string;
  dateLabel: string;
  id: string;
  kind: 'service';
  label: string;
  message: Message;
};

export type LiveItem = TimelineDateItem | LiveMessageItem | LiveServiceItem;

export function buildLiveItems(
  input: readonly Message[],
  chatsById: ReadonlyMap<string, LiveMessageChat>
): LiveItem[] {
  const messages = sortMessages([...input]);
  const messagesByTarget = new Map(
    messages.map((message) => [
      messageTargetKey(message.chat.id, message.telegramMessageId),
      message
    ])
  );
  const messagesByTelegramId = new Map<string, Message>();
  const items: LiveItem[] = [];
  let currentDateKey = '';

  for (const message of messages) {
    const nextDateKey = messageDateKey(message.messageDate);
    const dateLabel = formatMessageDateLabel(message.messageDate);
    if (nextDateKey !== currentDateKey) {
      currentDateKey = nextDateKey;
      items.push({
        dateKey: currentDateKey,
        id: `date:${currentDateKey}`,
        kind: 'date',
        label: dateLabel
      });
    }

    const chat = chatsById.get(message.chat.id) ?? null;
    const chatTitle = chatTitleFromDirectory(message.chat.id, chat);
    const chatAvatarUrl = chat?.avatarUrl ?? null;
    const serviceLabel = messageServiceLabel(message);
    if (serviceLabel !== null) {
      items.push({
        chatAvatarUrl,
        chatId: message.chat.id,
        chatTitle,
        dateLabel,
        id: `service:${message.id}`,
        kind: 'service',
        label: serviceLabel,
        message
      });
      continue;
    }

    items.push({
      chatAvatarUrl,
      chatId: message.chat.id,
      chatTitle,
      dateLabel,
      id: message.id,
      kind: 'message',
      message,
      view: buildMessageView(message, {
        messagesByTelegramId,
        replyMessageLookup: (target) => messageByTarget(target, messagesByTarget),
        selectedChatAvatarUrl: chatAvatarUrl
      })
    });
  }

  return items;
}

function chatTitleFromDirectory(chatId: string, chat: LiveMessageChat | null): string {
  const title = chat?.title.trim() ?? '';
  return title.length > 0 ? title : chatId;
}

function messageByTarget(
  target: MessageTarget,
  messagesByTarget: ReadonlyMap<string, Message>
): Message | null {
  return messagesByTarget.get(messageTargetKey(target.chatId, target.messageId)) ?? null;
}

function messageTargetKey(chatId: string, messageId: string): string {
  return `${chatId}:${messageId}`;
}
