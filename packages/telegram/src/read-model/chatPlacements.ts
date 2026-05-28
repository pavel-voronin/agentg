import type { JsonObject } from '@agentg/events/json';

import { asPlainRecord, parsePositiveBigInt } from './chat.js';

export type TelegramChatPlacement =
  | {
      isPinned: boolean;
      kind: 'archive';
      order: string;
    }
  | {
      isPinned: boolean;
      kind: 'main';
      order: string;
    }
  | {
      folderId: number;
      isPinned: boolean;
      kind: 'folder';
      order: string;
    };

export function telegramChatPlacements(chat: JsonObject): TelegramChatPlacement[] {
  return chatPositions(chat)
    .map((position) => {
      const list = asPlainRecord(position.list);
      const order = parsePositiveBigInt(position.order);
      if (list === undefined || order === undefined) {
        return undefined;
      }

      const type = typeof list._ === 'string' ? list._ : undefined;
      if (type === 'chatListMain') {
        return {
          isPinned: position.is_pinned === true || position.isPinned === true,
          kind: 'main' as const,
          order: order.toString()
        };
      }
      if (type === 'chatListArchive') {
        return {
          isPinned: position.is_pinned === true || position.isPinned === true,
          kind: 'archive' as const,
          order: order.toString()
        };
      }
      if (type === 'chatListFolder') {
        const folderId = chatFolderId(list);
        return folderId === undefined
          ? undefined
          : {
              folderId,
              isPinned: position.is_pinned === true || position.isPinned === true,
              kind: 'folder' as const,
              order: order.toString()
            };
      }

      return undefined;
    })
    .filter(isDefined);
}

export function isListableTelegramChat(chat: JsonObject): boolean {
  return telegramChatPlacements(chat).length > 0;
}

function chatPositions(chat: JsonObject): Record<string, unknown>[] {
  return (Array.isArray(chat.positions) ? chat.positions : []).map(asPlainRecord).filter(isDefined);
}

function chatFolderId(list: Record<string, unknown> | undefined): number | undefined {
  const value = list?.chat_folder_id ?? list?.chatFolderId;
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : undefined;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
