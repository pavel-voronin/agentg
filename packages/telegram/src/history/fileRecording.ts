import { isDeepStrictEqual } from 'node:util';

import { and, eq, inArray } from 'drizzle-orm';
import type { message as Message } from 'tdlib-types';

import type { Database } from '../database/client.js';
import { telegramFileSlots, telegramMessages } from '../database/schema.js';
import { extractFileSlots } from '../files/extractor.js';
import { fileAssetKey } from '../files/persistence.js';
import type { ExtractedFileSlot } from '../files/types.js';
import { MESSAGE_MODEL, messageModelId } from '../model/refs.js';
import { tdJsonObject } from '../tdlib/value.js';

type MessageFileProjection = {
  content: ReturnType<typeof tdJsonObject>;
  message: Message;
  messageId: string;
  ownerId: string;
  slots: ExtractedFileSlot[];
};

type StoredMessageContentRow = {
  content: unknown;
  id: string;
};

type StoredFileSlotRow = {
  assetKey: string;
  byteSize: number | null;
  durationSeconds: number | null;
  fileName: string | null;
  height: number | null;
  mediaKind: string;
  mimeType: string | null;
  ownerId: string;
  renderKind: string;
  slotKey: string;
  tdlibFileId: number;
  width: number | null;
};

export async function messagesNeedingFileRecording(
  database: Database,
  messages: Message[]
): Promise<Message[]> {
  const first = messages[0];
  if (first === undefined) {
    return [];
  }

  const projections = messages.map(messageFileProjection);
  const currentContentByMessageId = new Map(
    (
      await readStoredMessageContents(
        database,
        String(first.chat_id),
        projections.map((projection) => projection.messageId)
      )
    ).map((row) => [row.id, row.content])
  );
  const needsRecording: Message[] = [];
  const projectionsToCheck: MessageFileProjection[] = [];

  for (const projection of projections) {
    const currentContent = currentContentByMessageId.get(projection.messageId);
    if (currentContent === undefined || !isDeepStrictEqual(currentContent, projection.content)) {
      needsRecording.push(projection.message);
      continue;
    }

    projectionsToCheck.push(projection);
  }

  if (projectionsToCheck.length === 0) {
    return needsRecording;
  }

  const currentSlotsByOwnerId = groupSlotsByOwnerId(
    await readStoredMessageFileSlots(
      database,
      projectionsToCheck.map((projection) => projection.ownerId)
    )
  );

  for (const projection of projectionsToCheck) {
    if (
      !fileSlotProjectionMatches(
        currentSlotsByOwnerId.get(projection.ownerId) ?? [],
        projection.slots
      )
    ) {
      needsRecording.push(projection.message);
    }
  }

  return needsRecording;
}

function messageFileProjection(message: Message): MessageFileProjection {
  const chatId = String(message.chat_id);
  const messageId = String(message.id);
  const content = tdJsonObject(message.content);
  const slots = extractFileSlots({
    message: {
      chatId,
      content,
      messageId
    }
  });

  return {
    content,
    message,
    messageId,
    ownerId: messageModelId(chatId, messageId),
    slots
  };
}

async function readStoredMessageContents(
  database: Database,
  chatId: string,
  messageIds: string[]
): Promise<StoredMessageContentRow[]> {
  return database
    .select({
      content: telegramMessages.content,
      id: telegramMessages.id
    })
    .from(telegramMessages)
    .where(and(eq(telegramMessages.chatId, chatId), inArray(telegramMessages.id, messageIds)));
}

async function readStoredMessageFileSlots(
  database: Database,
  ownerIds: string[]
): Promise<StoredFileSlotRow[]> {
  return database
    .select({
      assetKey: telegramFileSlots.assetKey,
      byteSize: telegramFileSlots.byteSize,
      durationSeconds: telegramFileSlots.durationSeconds,
      fileName: telegramFileSlots.fileName,
      height: telegramFileSlots.height,
      mediaKind: telegramFileSlots.mediaKind,
      mimeType: telegramFileSlots.mimeType,
      ownerId: telegramFileSlots.ownerId,
      renderKind: telegramFileSlots.renderKind,
      slotKey: telegramFileSlots.slotKey,
      tdlibFileId: telegramFileSlots.tdlibFileId,
      width: telegramFileSlots.width
    })
    .from(telegramFileSlots)
    .where(
      and(
        eq(telegramFileSlots.ownerModel, MESSAGE_MODEL),
        inArray(telegramFileSlots.ownerId, ownerIds)
      )
    );
}

function groupSlotsByOwnerId(slots: StoredFileSlotRow[]): Map<string, StoredFileSlotRow[]> {
  const grouped = new Map<string, StoredFileSlotRow[]>();
  for (const slot of slots) {
    grouped.set(slot.ownerId, [...(grouped.get(slot.ownerId) ?? []), slot]);
  }
  return grouped;
}

function fileSlotProjectionMatches(
  currentSlots: StoredFileSlotRow[],
  expectedSlots: ExtractedFileSlot[]
): boolean {
  if (currentSlots.length !== expectedSlots.length) {
    return false;
  }

  const currentBySlotKey = new Map(currentSlots.map((slot) => [slot.slotKey, slot]));
  return expectedSlots.every((slot) => fileSlotMatches(currentBySlotKey.get(slot.slotKey), slot));
}

function fileSlotMatches(
  current: StoredFileSlotRow | undefined,
  expected: ExtractedFileSlot
): boolean {
  return (
    current?.assetKey === fileAssetKey(expected.file) &&
    current.byteSize === expected.byteSize &&
    current.durationSeconds === expected.durationSeconds &&
    current.fileName === expected.fileName &&
    current.height === expected.height &&
    current.mediaKind === expected.mediaKind &&
    current.mimeType === expected.mimeType &&
    current.renderKind === expected.renderKind &&
    current.tdlibFileId === expected.tdlibFileId &&
    current.width === expected.width
  );
}
