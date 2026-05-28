import type { JsonValue } from '@agentg/events/json';

import type { TelegramDatabase } from '../database.js';
import { telegramBackgrounds, telegramFiles } from '../schema.js';
import {
  telegramWireJsonObject,
  telegramWireJsonValue,
  type TelegramWireFile,
  type TelegramWireUpdateByType
} from '../tdlib/wire.js';
import { upsertTelegramChatFragment } from './chat.js';

type TelegramWireChatBackgroundUpdate = TelegramWireUpdateByType<'updateChatBackground'>;
type TelegramWireChatBackground = NonNullable<TelegramWireChatBackgroundUpdate['background']>;
type TelegramWireBackground = TelegramWireChatBackground['background'];
type TelegramWireDocument = NonNullable<TelegramWireBackground['document']>;
type TelegramWireThumbnail = NonNullable<TelegramWireDocument['thumbnail']>;

export async function storeChatBackground(
  database: TelegramDatabase,
  chatId: string,
  chatBackground: TelegramWireChatBackground | null
): Promise<void> {
  await database.transaction(async (transaction) => {
    if (chatBackground !== null) {
      await storeTelegramBackground(transaction, chatBackground.background);
    }

    await upsertTelegramChatFragment(transaction, {
      background: chatBackgroundReferenceValue(chatBackground),
      id: chatId
    });
  });
}

export async function storeTelegramBackground(
  database: TelegramDatabase,
  background: TelegramWireBackground
): Promise<void> {
  await storeBackgroundFiles(database, background);
  await storeBackgroundRow(database, background);
}

async function storeBackgroundRow(
  database: TelegramDatabase,
  background: TelegramWireBackground
): Promise<void> {
  const row: typeof telegramBackgrounds.$inferInsert = {
    document: backgroundDocumentValue(background.document ?? null),
    id: background.id,
    isDark: background.is_dark,
    isDefault: background.is_default,
    name: background.name,
    type: telegramWireJsonObject(background.type)
  };

  await database.insert(telegramBackgrounds).values(row).onConflictDoUpdate({
    set: row,
    target: telegramBackgrounds.id
  });
}

async function storeBackgroundFiles(
  database: TelegramDatabase,
  background: TelegramWireBackground
): Promise<void> {
  const storedFileIds = new Set<number>();

  for (const file of backgroundFiles(background)) {
    if (storedFileIds.has(file.id)) {
      continue;
    }
    storedFileIds.add(file.id);
    await storeFile(database, file);
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

function chatBackgroundReferenceValue(
  chatBackground: TelegramWireChatBackground | null
): JsonValue {
  if (chatBackground === null) {
    return null;
  }

  return {
    _: 'chatBackground',
    background_id: chatBackground.background.id,
    dark_theme_dimming: chatBackground.dark_theme_dimming
  };
}

function backgroundDocumentValue(document: TelegramWireDocument | null): JsonValue | null {
  if (document === null) {
    return null;
  }

  const thumbnail = document.thumbnail ?? null;
  return {
    _: 'document',
    document_file_id: document.document.id,
    file_name: document.file_name,
    mime_type: document.mime_type,
    minithumbnail: telegramWireJsonValue(document.minithumbnail ?? null) ?? null,
    thumbnail: thumbnail === null ? null : thumbnailValue(thumbnail)
  };
}

function thumbnailValue(thumbnail: TelegramWireThumbnail): JsonValue {
  return {
    _: 'thumbnail',
    file_id: thumbnail.file.id,
    format: telegramWireJsonObject(thumbnail.format),
    height: thumbnail.height,
    width: thumbnail.width
  };
}

function* backgroundFiles(background: TelegramWireBackground): Generator<TelegramWireFile> {
  const document = background.document ?? null;
  if (document === null) {
    return;
  }

  yield document.document;

  const thumbnail = document.thumbnail ?? null;
  if (thumbnail !== null) {
    yield thumbnail.file;
  }
}

function nullablePositiveId(value: number): string | null {
  return value > 0 ? String(value) : null;
}
