import { describe, expect, it } from 'vitest';
import type { message as Message } from 'tdlib-types';

import type { Database } from '../../src/database/client.js';
import { extractFileSlots } from '../../src/files/extractor.js';
import { fileAssetKey } from '../../src/files/persistence.js';
import { messagesNeedingFileRecording } from '../../src/history/fileRecording.js';
import { messageModelId } from '../../src/model/refs.js';

describe('Telegram history file recording', () => {
  it('skips unchanged messages when file projection matches', async () => {
    const message = photoMessage(10, 501);

    await expect(
      messagesNeedingFileRecording(
        fakeDatabase({
          fileSlots: [slotRow(message)],
          messageContents: [contentRow(message)]
        }),
        [message]
      )
    ).resolves.toEqual([]);
  });

  it('records unchanged media messages when file projection is missing', async () => {
    const message = photoMessage(11, 502);

    await expect(
      messagesNeedingFileRecording(
        fakeDatabase({
          fileSlots: [],
          messageContents: [contentRow(message)]
        }),
        [message]
      )
    ).resolves.toEqual([message]);
  });

  it('records unchanged media messages when file projection is stale', async () => {
    const message = photoMessage(12, 503);

    await expect(
      messagesNeedingFileRecording(
        fakeDatabase({
          fileSlots: [{ ...slotRow(message), tdlibFileId: 999 }],
          messageContents: [contentRow(message)]
        }),
        [message]
      )
    ).resolves.toEqual([message]);
  });

  it('records changed messages without depending on current file projection', async () => {
    const message = photoMessage(13, 504);

    await expect(
      messagesNeedingFileRecording(
        fakeDatabase({
          fileSlots: [slotRow(message)],
          messageContents: [contentRow(textMessage(13))]
        }),
        [message]
      )
    ).resolves.toEqual([message]);
  });

  it('records unchanged text messages when stale file projection is present', async () => {
    const message = textMessage(14);

    await expect(
      messagesNeedingFileRecording(
        fakeDatabase({
          fileSlots: [staleSlotRow(message)],
          messageContents: [contentRow(message)]
        }),
        [message]
      )
    ).resolves.toEqual([message]);
  });
});

type FakeDatabaseInput = {
  fileSlots: unknown[];
  messageContents: unknown[];
};

function fakeDatabase(input: FakeDatabaseInput): Database {
  return {
    select(selection: Record<string, unknown>) {
      const rows = 'content' in selection ? input.messageContents : input.fileSlots;
      return {
        from() {
          return {
            where() {
              return Promise.resolve(rows);
            }
          };
        }
      };
    }
  } as unknown as Database;
}

function contentRow(message: Message) {
  return {
    content: message.content,
    id: String(message.id)
  };
}

function slotRow(message: Message) {
  const [slot] = extractFileSlots({
    message: {
      chatId: String(message.chat_id),
      content: message.content,
      messageId: String(message.id)
    }
  });
  if (slot === undefined) {
    throw new Error('expected message file slot');
  }

  return {
    assetKey: fileAssetKey(slot.file),
    byteSize: slot.byteSize,
    durationSeconds: slot.durationSeconds,
    fileName: slot.fileName,
    height: slot.height,
    mediaKind: slot.mediaKind,
    mimeType: slot.mimeType,
    ownerId: slot.owner.id,
    renderKind: slot.renderKind,
    slotKey: slot.slotKey,
    tdlibFileId: slot.tdlibFileId,
    width: slot.width
  };
}

function staleSlotRow(message: Message) {
  return {
    assetKey: 'telegram:stale',
    byteSize: null,
    durationSeconds: null,
    fileName: null,
    height: null,
    mediaKind: 'photo',
    mimeType: 'image/jpeg',
    ownerId: messageModelId(String(message.chat_id), String(message.id)),
    renderKind: 'image',
    slotKey: 'content.photo.0',
    tdlibFileId: 1,
    width: null
  };
}

function textMessage(id: number): Message {
  return message({
    content: {
      _: 'messageText',
      text: {
        _: 'formattedText',
        entities: [],
        text: 'hello'
      }
    },
    id
  });
}

function photoMessage(id: number, fileId: number): Message {
  return message({
    content: {
      _: 'messagePhoto',
      photo: {
        _: 'photo',
        sizes: [
          {
            _: 'photoSize',
            height: 800,
            photo: tdFile(fileId, 800_000),
            width: 800
          }
        ]
      }
    },
    id
  });
}

function message(input: { content: Record<string, unknown>; id: number }): Message {
  return {
    _: 'message',
    chat_id: -1001,
    content: input.content,
    date: 1777777777,
    id: input.id,
    is_outgoing: false
  } as Message;
}

function tdFile(id: number, size: number) {
  return {
    _: 'file',
    expected_size: size,
    id,
    local: {
      _: 'localFile',
      can_be_deleted: true,
      can_be_downloaded: true,
      download_offset: 0,
      downloaded_prefix_size: 0,
      downloaded_size: 0,
      is_downloading_active: false,
      is_downloading_completed: false,
      path: ''
    },
    remote: {
      _: 'remoteFile',
      id: `remote-${String(id)}`,
      is_uploading_active: false,
      is_uploading_completed: true,
      unique_id: `unique-${String(id)}`,
      uploaded_size: size
    },
    size
  };
}
