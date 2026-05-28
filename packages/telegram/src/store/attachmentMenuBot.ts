import type { JsonValue } from '@agentg/events/json';

import type { TelegramDatabase } from '../database/client.js';
import { telegramAttachmentMenuBots, telegramFiles } from '../database/schema.js';
import {
  telegramWireJsonObject,
  telegramWireJsonValue,
  type TelegramWireFile,
  type TelegramWireUpdateByType
} from '../tdlib/wire.js';

type TelegramWireAttachmentMenuBot =
  TelegramWireUpdateByType<'updateAttachmentMenuBots'>['bots'][number];

export async function replaceAttachmentMenuBots(
  database: TelegramDatabase,
  bots: TelegramWireAttachmentMenuBot[]
): Promise<void> {
  await database.transaction(async (transaction) => {
    await storeAttachmentMenuBotFiles(transaction, bots);
    await transaction.delete(telegramAttachmentMenuBots);

    if (bots.length > 0) {
      await transaction.insert(telegramAttachmentMenuBots).values(bots.map(attachmentMenuBotRow));
    }
  });
}

async function storeAttachmentMenuBotFiles(
  database: TelegramDatabase,
  bots: TelegramWireAttachmentMenuBot[]
): Promise<void> {
  const storedFileIds = new Set<number>();

  for (const bot of bots) {
    for (const file of attachmentMenuBotFiles(bot)) {
      if (storedFileIds.has(file.id)) {
        continue;
      }
      storedFileIds.add(file.id);
      await storeFile(database, file);
    }
  }
}

async function storeFile(database: TelegramDatabase, file: TelegramWireFile): Promise<void> {
  const row: typeof telegramFiles.$inferInsert = {
    expectedSize: String(file.expected_size),
    id: file.id,
    local: telegramWireJsonObject(file.local),
    remote: telegramWireJsonObject(file.remote),
    size: nullablePositiveId(file.size)
  };

  await database.insert(telegramFiles).values(row).onConflictDoUpdate({
    set: row,
    target: telegramFiles.id
  });
}

function attachmentMenuBotRow(
  bot: TelegramWireAttachmentMenuBot
): typeof telegramAttachmentMenuBots.$inferInsert {
  return {
    androidIconFileId: bot.android_icon?.id ?? null,
    androidSideMenuIconFileId: bot.android_side_menu_icon?.id ?? null,
    botUserId: String(bot.bot_user_id),
    defaultIconFileId: bot.default_icon?.id ?? null,
    iconColor: nullableTelegramWireJsonValue(bot.icon_color ?? null),
    iosAnimatedIconFileId: bot.ios_animated_icon?.id ?? null,
    iosSideMenuIconFileId: bot.ios_side_menu_icon?.id ?? null,
    iosStaticIconFileId: bot.ios_static_icon?.id ?? null,
    isAdded: bot.is_added,
    macosIconFileId: bot.macos_icon?.id ?? null,
    macosSideMenuIconFileId: bot.macos_side_menu_icon?.id ?? null,
    name: bot.name,
    nameColor: nullableTelegramWireJsonValue(bot.name_color ?? null),
    requestWriteAccess: bot.request_write_access,
    showDisclaimerInSideMenu: bot.show_disclaimer_in_side_menu,
    showInAttachmentMenu: bot.show_in_attachment_menu,
    showInSideMenu: bot.show_in_side_menu,
    supportsBotChats: bot.supports_bot_chats,
    supportsChannelChats: bot.supports_channel_chats,
    supportsGroupChats: bot.supports_group_chats,
    supportsSelfChat: bot.supports_self_chat,
    supportsUserChats: bot.supports_user_chats,
    webAppPlaceholderFileId: bot.web_app_placeholder?.id ?? null
  };
}

function* attachmentMenuBotFiles(bot: TelegramWireAttachmentMenuBot): Generator<TelegramWireFile> {
  const files = [
    bot.default_icon,
    bot.ios_static_icon,
    bot.ios_animated_icon,
    bot.ios_side_menu_icon,
    bot.android_icon,
    bot.android_side_menu_icon,
    bot.macos_icon,
    bot.macos_side_menu_icon,
    bot.web_app_placeholder
  ];

  for (const file of files) {
    if (file !== undefined) {
      yield file;
    }
  }
}

function nullablePositiveId(value: number): string | null {
  return value > 0 ? String(value) : null;
}

function nullableTelegramWireJsonValue(value: unknown): JsonValue | null {
  return telegramWireJsonValue(value) ?? null;
}
