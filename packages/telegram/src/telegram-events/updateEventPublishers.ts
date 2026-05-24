import type { EventBus } from '@agentg/events/bus';
import { createIntegrationEvent } from '@agentg/events/envelope';

import type { TelegramDatabase } from '../database.js';
import { createTelegramChatUpdatedEvent } from '../integrationEvents.js';
import {
  telegramChatFolderRef,
  telegramChatRef,
  telegramMessageRef,
  telegramMessageSenderRef,
  telegramUserRef
} from '../modelRefs.js';
import type {
  TelegramMessageServiceAction,
  TelegramMessageTextEntity
} from '../telegram-store/message.js';
import { getDirectoryEntryByChatId } from '../rpc/procedures/support.js';

export type TelegramMessageCreatedEventInput = {
  chatId: string;
  contentType: string;
  isOutgoing: boolean;
  messageDate?: Date;
  messageId: string;
  senderId?: string;
  senderType?: string;
  text?: string;
  textEntities: TelegramMessageTextEntity[];
};

export type TelegramMessageUpdatedEventInput = {
  chatId: string;
  contentType: string;
  editDate?: Date;
  messageId: string;
  serviceAction?: TelegramMessageServiceAction;
  text?: string;
  textEntities: TelegramMessageTextEntity[];
};

export type TelegramMessagesDeletedEventInput = {
  chatId: string;
  deletedAt: Date;
  fromCache: boolean;
  isPermanent: boolean;
  messageIds: string[];
};

export type TelegramChatFoldersUpdatedEventInput = {
  folders: {
    iconName?: string;
    id: number;
    position: number;
    title: string;
  }[];
};

export type TelegramUserUpdatedEventInput = {
  firstName: string;
  id: string;
  isBot: boolean;
  isSelf?: boolean;
  lastName: string;
  username?: string;
};

export type TelegramUpdateEventPublishers = {
  publishTelegramChatDirectoryUpdated(chatId: string): Promise<void>;
  publishTelegramChatFoldersUpdated(input: TelegramChatFoldersUpdatedEventInput): void;
  publishTelegramMessageCreated(input: TelegramMessageCreatedEventInput): void;
  publishTelegramMessageDeleted(input: TelegramMessagesDeletedEventInput): void;
  publishTelegramMessageUpdated(input: TelegramMessageUpdatedEventInput): void;
  publishTelegramUserUpdated(input: TelegramUserUpdatedEventInput): void;
};

export function createTelegramUpdateEventPublishers(
  eventBus: EventBus,
  database: TelegramDatabase
): TelegramUpdateEventPublishers {
  return {
    async publishTelegramChatDirectoryUpdated(chatId): Promise<void> {
      const chat = await getDirectoryEntryByChatId(database, chatId);
      eventBus.publish(
        chat === null
          ? createIntegrationEvent({
              data: { chatId },
              meta: { chatId },
              type: 'telegram.chat.removed'
            })
          : createTelegramChatUpdatedEvent(chat)
      );
    },
    publishTelegramChatFoldersUpdated(input): void {
      eventBus.publish(
        createIntegrationEvent({
          type: 'telegram.chat_folders.updated',
          data: {
            folders: input.folders.map((folder) => ({
              ...telegramChatFolderRef(folder.id),
              folderId: folder.id,
              iconName: folder.iconName ?? null,
              position: folder.position,
              title: folder.title
            }))
          }
        })
      );
    },
    publishTelegramMessageCreated(input): void {
      eventBus.publish(
        createIntegrationEvent({
          type: 'telegram.message.created',
          data: {
            message: {
              ...telegramMessageRef({
                chatId: input.chatId,
                messageId: input.messageId
              }),
              chat: telegramChatRef(input.chatId),
              contentType: input.contentType,
              isDeleted: false,
              isOutgoing: input.isOutgoing,
              messageDate: input.messageDate?.toISOString() ?? null,
              replyTo: null,
              sender: telegramMessageSenderRef(input.senderType, input.senderId),
              senderDisplayName: null,
              senderType: input.senderType ?? null,
              serviceAction: null,
              telegramMessageId: input.messageId,
              text: input.text ?? null,
              textEntities: input.textEntities
            }
          },
          meta: {
            chatId: input.chatId,
            messageId: input.messageId
          },
          ...(input.messageDate === undefined ? {} : { occurredAt: input.messageDate })
        })
      );
    },
    publishTelegramMessageDeleted(input): void {
      eventBus.publish(
        createIntegrationEvent({
          type: 'telegram.message.deleted',
          occurredAt: input.deletedAt,
          data: {
            delete: {
              chat: telegramChatRef(input.chatId),
              deletedAt: input.deletedAt.toISOString(),
              fromCache: input.fromCache,
              isPermanent: input.isPermanent,
              messages: input.messageIds.map((messageId) =>
                telegramMessageRef({ chatId: input.chatId, messageId })
              )
            }
          },
          meta: {
            chatId: input.chatId,
            messageIds: input.messageIds
          }
        })
      );
    },
    publishTelegramMessageUpdated(input): void {
      eventBus.publish(
        createIntegrationEvent({
          type: 'telegram.message.updated',
          data: {
            message: {
              ...telegramMessageRef({
                chatId: input.chatId,
                messageId: input.messageId
              }),
              chat: telegramChatRef(input.chatId),
              contentType: input.contentType,
              editDate: input.editDate?.toISOString() ?? null,
              serviceAction: eventMessageServiceAction(input.serviceAction),
              telegramMessageId: input.messageId,
              text: input.text ?? null,
              textEntities: input.textEntities
            }
          },
          meta: {
            chatId: input.chatId,
            messageId: input.messageId
          },
          ...(input.editDate === undefined ? {} : { occurredAt: input.editDate })
        })
      );
    },
    publishTelegramUserUpdated(input): void {
      eventBus.publish(
        createIntegrationEvent({
          type: 'telegram.user.updated',
          data: {
            user: {
              ...telegramUserRef(input.id),
              firstName: input.firstName,
              isBot: input.isBot,
              isSelf: input.isSelf === true,
              lastName: input.lastName,
              username: input.username ?? null
            }
          },
          meta: {
            userId: input.id
          }
        })
      );
    }
  };
}

function eventMessageServiceAction(action: TelegramMessageServiceAction | undefined): {
  kind: 'chatMemberLeft';
  user: ReturnType<typeof telegramUserRef>;
  userDisplayName: string;
} | null {
  if (action === undefined) {
    return null;
  }

  return {
    kind: 'chatMemberLeft',
    user: telegramUserRef(action.userId),
    userDisplayName: action.userId
  };
}
