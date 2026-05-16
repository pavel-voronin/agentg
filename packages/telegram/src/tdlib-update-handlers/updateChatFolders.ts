import type { JsonObject, JsonValue } from '@agentg/events/json';

import { telegramChatFolderInfos } from '../schema.js';
import type { TdlibUpdateChatFolders } from '../tdlib-schema/UpdateChatFolders.js';
import type { TelegramUpdateHandlerContext } from './context.js';

export async function handleUpdateChatFolders(
  { database, events }: TelegramUpdateHandlerContext,
  update: TdlibUpdateChatFolders
): Promise<void> {
  await database.transaction(async (transaction) => {
    await transaction.delete(telegramChatFolderInfos);
    if (update.chat_folders.length > 0) {
      await transaction
        .insert(telegramChatFolderInfos)
        .values(update.chat_folders.map(chatFolderInfoRow));
    }
  });

  events.publishTelegramChatFoldersUpdated({
    folders: update.chat_folders.map((folder) => ({
      id: folder.id,
      position: folder.position,
      title: folder.title,
      ...(folder.iconName === undefined ? {} : { iconName: folder.iconName })
    }))
  });
}

function chatFolderInfoRow(
  folder: TdlibUpdateChatFolders['chat_folders'][number]
): typeof telegramChatFolderInfos.$inferInsert {
  const source = folder.chatFolder;
  return {
    colorId: numberField(source, 'color_id') ?? 0,
    hasMyInviteLinks: booleanField(source, 'has_my_invite_links') ?? false,
    icon: jsonField(source, 'icon') ?? {
      _: 'chatFolderIcon',
      name: folder.iconName ?? ''
    },
    id: folder.id,
    isShareable: booleanField(source, 'is_shareable') ?? false,
    name: jsonField(source, 'name') ?? {
      _: 'chatFolderName',
      text: {
        _: 'formattedText',
        entities: [],
        text: folder.title
      }
    },
    position: folder.position
  };
}

function booleanField(source: JsonObject, name: string): boolean | undefined {
  const value = source[name];
  return typeof value === 'boolean' ? value : undefined;
}

function numberField(source: JsonObject, name: string): number | undefined {
  const value = source[name];
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : undefined;
}

function jsonField(source: JsonObject, name: string): JsonValue | undefined {
  return source[name];
}
