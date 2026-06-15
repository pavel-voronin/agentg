import type { JsonValue } from '@agentg/framework';

import type { Database } from '../database/client.js';
import { telegramBackgrounds, telegramFiles } from '../database/schema.js';
import { tdJsonObject, tdJsonValue, type UpdateByType } from '../tdlib/shape.js';
import type { file as File } from 'tdlib-types';
import { upsertTelegramChatFragment } from './chat.js';

type ChatBackgroundUpdate = UpdateByType<'updateChatBackground'>;
type ChatBackground = NonNullable<ChatBackgroundUpdate['background']>;
type Background = ChatBackground['background'];
type Document = NonNullable<Background['document']>;
type Thumbnail = NonNullable<Document['thumbnail']>;

export async function storeChatBackground(
  database: Database,
  chatId: string,
  chatBackground: ChatBackground | null
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
  database: Database,
  background: Background
): Promise<void> {
  await storeBackgroundFiles(database, background);
  await storeBackgroundRow(database, background);
}

async function storeBackgroundRow(database: Database, background: Background): Promise<void> {
  const row: typeof telegramBackgrounds.$inferInsert = {
    document: backgroundDocumentValue(background.document ?? null),
    id: background.id,
    isDark: background.is_dark,
    isDefault: background.is_default,
    name: background.name,
    type: tdJsonObject(background.type)
  };

  await database.insert(telegramBackgrounds).values(row).onConflictDoUpdate({
    set: row,
    target: telegramBackgrounds.id
  });
}

async function storeBackgroundFiles(database: Database, background: Background): Promise<void> {
  const storedFileIds = new Set<number>();

  for (const file of backgroundFiles(background)) {
    if (storedFileIds.has(file.id)) {
      continue;
    }
    storedFileIds.add(file.id);
    await storeFile(database, file);
  }
}

async function storeFile(database: Database, file: File): Promise<void> {
  const row: typeof telegramFiles.$inferInsert = {
    expectedSize: String(file.expected_size),
    id: file.id,
    local: tdJsonObject(file.local),
    remote: tdJsonObject(file.remote),
    size: nullablePositiveId(file.size)
  };

  await database.insert(telegramFiles).values(row).onConflictDoUpdate({
    set: row,
    target: telegramFiles.id
  });
}

function chatBackgroundReferenceValue(chatBackground: ChatBackground | null): JsonValue {
  if (chatBackground === null) {
    return null;
  }

  return {
    _: 'chatBackground',
    background_id: chatBackground.background.id,
    dark_theme_dimming: chatBackground.dark_theme_dimming
  };
}

function backgroundDocumentValue(document: Document | null): JsonValue | null {
  if (document === null) {
    return null;
  }

  const thumbnail = document.thumbnail ?? null;
  return {
    _: 'document',
    document_file_id: document.document.id,
    file_name: document.file_name,
    mime_type: document.mime_type,
    minithumbnail: tdJsonValue(document.minithumbnail ?? null) ?? null,
    thumbnail: thumbnail === null ? null : thumbnailValue(thumbnail)
  };
}

function thumbnailValue(thumbnail: Thumbnail): JsonValue {
  return {
    _: 'thumbnail',
    file_id: thumbnail.file.id,
    format: tdJsonObject(thumbnail.format),
    height: thumbnail.height,
    width: thumbnail.width
  };
}

function* backgroundFiles(background: Background): Generator<File> {
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
