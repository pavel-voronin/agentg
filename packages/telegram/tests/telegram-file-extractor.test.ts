import { describe, expect, it } from 'vitest';

import {
  extractTelegramFileSlots,
  type TelegramFileSlotUpdate
} from '../src/telegram-file-extractor.js';
import { decideTelegramFilePolicy } from '../src/telegram-file-policy.js';
import { tdlibUpdateNewChat } from '../src/tdlib-schema/UpdateNewChat.js';
import { tdlibUpdateNewMessage } from '../src/tdlib-schema/UpdateNewMessage.js';

describe('Telegram file extraction', () => {
  it('extracts chat avatar slots from chat photos', () => {
    const update = chatSlotUpdate({
      _: 'updateNewChat',
      chat: {
        _: 'chat',
        id: 42,
        photo: {
          _: 'chatPhotoInfo',
          big: tdFile(1002, 900_000),
          small: tdFile(1001, 30_000)
        },
        title: 'Chat',
        type: { _: 'chatTypeBasicGroup' }
      }
    });

    expect(extractTelegramFileSlots(update)).toMatchObject([
      {
        mediaKind: 'avatar',
        owner: { _model: 'telegram.chat', id: '42' },
        renderKind: 'image',
        slotKey: 'avatar.small',
        tdlibFileId: 1001
      },
      {
        mediaKind: 'avatar',
        owner: { _model: 'telegram.chat', id: '42' },
        renderKind: 'image',
        slotKey: 'avatar.big',
        tdlibFileId: 1002
      }
    ]);
  });

  it('extracts photo, video, thumbnail, document, and voice message slots', () => {
    const photoUpdate = messageSlotUpdate(
      message({
        content: {
          _: 'messagePhoto',
          photo: {
            _: 'photo',
            sizes: [
              { _: 'photoSize', height: 90, photo: tdFile(2001, 20_000), type: 's', width: 90 },
              { _: 'photoSize', height: 800, photo: tdFile(2002, 800_000), type: 'x', width: 800 }
            ]
          }
        },
        id: 11
      })
    );
    const videoUpdate = messageSlotUpdate(
      message({
        content: {
          _: 'messageVideo',
          video: {
            _: 'video',
            duration: 4,
            file_name: 'clip.mp4',
            height: 720,
            mime_type: 'video/mp4',
            thumbnail: {
              _: 'thumbnail',
              file: tdFile(3002, 50_000),
              height: 90,
              width: 160
            },
            video: tdFile(3001, 4_000_000),
            width: 1280
          }
        },
        id: 12
      })
    );
    const documentUpdate = messageSlotUpdate(
      message({
        content: {
          _: 'messageDocument',
          document: {
            _: 'document',
            document: tdFile(4001, 25_000_000),
            file_name: 'archive.zip',
            mime_type: 'application/zip'
          }
        },
        id: 13
      })
    );
    const voiceUpdate = messageSlotUpdate(
      message({
        content: {
          _: 'messageVoiceNote',
          voice_note: {
            _: 'voiceNote',
            duration: 17,
            mime_type: 'audio/ogg',
            voice: tdFile(5001, 120_000)
          }
        },
        id: 14
      })
    );

    expect(extractTelegramFileSlots(photoUpdate).map((slot) => slot.slotKey)).toEqual([
      'content.photo.0'
    ]);
    expect(extractTelegramFileSlots(videoUpdate).map((slot) => slot.slotKey)).toEqual([
      'content.video.file',
      'content.video.thumbnail'
    ]);
    expect(extractTelegramFileSlots(documentUpdate)).toMatchObject([
      {
        fileName: 'archive.zip',
        mediaKind: 'document',
        renderKind: 'download',
        slotKey: 'content.document.file'
      }
    ]);
    expect(extractTelegramFileSlots(voiceUpdate)).toMatchObject([
      {
        durationSeconds: 17,
        mediaKind: 'voice',
        mimeType: 'audio/ogg',
        renderKind: 'audio',
        slotKey: 'content.voice.file'
      }
    ]);
  });
});

describe('Telegram file policy', () => {
  it('queues small automatic photos and videos', () => {
    const photo = extractTelegramFileSlots(
      messageSlotUpdate(
        message({
          content: {
            _: 'messagePhoto',
            photo: {
              _: 'photo',
              sizes: [{ _: 'photoSize', height: 800, photo: tdFile(5001, 800_000), width: 800 }]
            }
          },
          id: 21
        })
      )
    )[0];
    const video = extractTelegramFileSlots(
      messageSlotUpdate(
        message({
          content: {
            _: 'messageVideo',
            video: {
              _: 'video',
              video: tdFile(5002, 5 * 1024 * 1024)
            }
          },
          id: 22
        })
      )
    )[0];

    expect(photo).toBeDefined();
    expect(video).toBeDefined();
    if (photo === undefined || video === undefined) {
      throw new Error('expected photo and video slots');
    }
    expect(
      decideTelegramFilePolicy({
        cause: 'live_update',
        current: null,
        slot: photo,
        sourceFingerprint: 'photo'
      }).action
    ).toBe('enqueue');
    expect(
      decideTelegramFilePolicy({
        cause: 'live_update',
        current: null,
        slot: video,
        sourceFingerprint: 'video'
      }).action
    ).toBe('enqueue');
  });

  it('queues voice messages for Control Plane pages and explicit requests', () => {
    const [voice] = extractTelegramFileSlots(
      messageSlotUpdate(
        message({
          content: {
            _: 'messageVoiceNote',
            voice_note: {
              _: 'voiceNote',
              duration: 8,
              mime_type: 'audio/ogg',
              voice: tdFile(5501, 100_000)
            }
          },
          id: 25
        })
      )
    );

    expect(voice).toBeDefined();
    if (voice === undefined) {
      throw new Error('expected voice slot');
    }
    expect(
      decideTelegramFilePolicy({
        cause: 'operator_page',
        current: null,
        slot: voice,
        sourceFingerprint: 'voice'
      }).action
    ).toBe('enqueue');
    expect(
      decideTelegramFilePolicy({
        cause: 'explicit_request',
        current: null,
        slot: voice,
        sourceFingerprint: 'voice'
      }).action
    ).toBe('enqueue');
  });

  it('keeps large photos known until an allowed explicit request', () => {
    const [photo] = extractTelegramFileSlots(
      messageSlotUpdate(
        message({
          content: {
            _: 'messagePhoto',
            photo: {
              _: 'photo',
              sizes: [
                {
                  _: 'photoSize',
                  height: 4000,
                  photo: tdFile(6001, 50 * 1024 * 1024),
                  width: 4000
                }
              ]
            }
          },
          id: 31
        })
      )
    );

    expect(photo).toBeDefined();
    if (photo === undefined) {
      throw new Error('expected photo slot');
    }
    expect(
      decideTelegramFilePolicy({
        cause: 'live_update',
        current: null,
        slot: photo,
        sourceFingerprint: 'large-photo'
      }).action
    ).toBe('record');
    expect(
      decideTelegramFilePolicy({
        cause: 'explicit_request',
        current: null,
        slot: photo,
        sourceFingerprint: 'large-photo'
      }).action
    ).toBe('enqueue');
  });

  it('treats zero TDLib sizes as unknown for automatic policies', () => {
    const [photo] = extractTelegramFileSlots(
      messageSlotUpdate(
        message({
          content: {
            _: 'messagePhoto',
            photo: {
              _: 'photo',
              sizes: [
                {
                  _: 'photoSize',
                  height: 800,
                  photo: tdUnknownFile(6501),
                  width: 800
                }
              ]
            }
          },
          id: 35
        })
      )
    );

    expect(photo).toBeDefined();
    if (photo === undefined) {
      throw new Error('expected unknown-size photo slot');
    }

    expect(photo.byteSize).toBeNull();
    expect(
      decideTelegramFilePolicy({
        cause: 'live_update',
        current: null,
        slot: photo,
        sourceFingerprint: 'unknown-photo'
      }).action
    ).toBe('record');
  });

  it('keeps history media indexed without automatic downloads', () => {
    const [photo] = extractTelegramFileSlots(
      messageSlotUpdate(
        message({
          content: {
            _: 'messagePhoto',
            photo: {
              _: 'photo',
              sizes: [
                {
                  _: 'photoSize',
                  height: 800,
                  photo: tdFile(6601, 800_000),
                  width: 800
                }
              ]
            }
          },
          id: 36
        })
      )
    );

    expect(photo).toBeDefined();
    if (photo === undefined) {
      throw new Error('expected history photo slot');
    }

    expect(
      decideTelegramFilePolicy({
        cause: 'history_fetch',
        current: null,
        slot: photo,
        sourceFingerprint: 'history-photo'
      }).action
    ).toBe('record');
  });

  it('keeps failed files idle until an explicit retry request', () => {
    const [photo] = extractTelegramFileSlots(
      messageSlotUpdate(
        message({
          content: {
            _: 'messagePhoto',
            photo: {
              _: 'photo',
              sizes: [
                {
                  _: 'photoSize',
                  height: 800,
                  photo: tdFile(7001, 800_000),
                  width: 800
                }
              ]
            }
          },
          id: 41
        })
      )
    );

    expect(photo).toBeDefined();
    if (photo === undefined) {
      throw new Error('expected failed retry photo slot');
    }

    expect(
      decideTelegramFilePolicy({
        cause: 'live_update',
        current: {
          sourceFingerprint: 'photo-asset',
          status: 'failed'
        },
        slot: photo,
        sourceFingerprint: 'photo-asset'
      }).action
    ).toBe('record');
    expect(
      decideTelegramFilePolicy({
        cause: 'explicit_request',
        current: {
          sourceFingerprint: 'photo-asset',
          status: 'failed'
        },
        slot: photo,
        sourceFingerprint: 'photo-asset'
      }).action
    ).toBe('enqueue');
  });
});

function chatSlotUpdate(input: unknown): TelegramFileSlotUpdate {
  const update = tdlibUpdateNewChat(input);
  return {
    chat: {
      chat: update.chat.chat,
      id: update.chat.id
    }
  };
}

function messageSlotUpdate(input: unknown): TelegramFileSlotUpdate {
  const update = tdlibUpdateNewMessage({
    _: 'updateNewMessage',
    message: input
  });
  return {
    message: {
      chatId: update.message.chat_id,
      content: update.message.content,
      messageId: update.message.id
    }
  };
}

function message(input: { content: Record<string, unknown>; id: number }) {
  return {
    _: 'message',
    chat_id: -1001,
    content: input.content,
    date: 1777777777,
    id: input.id,
    is_outgoing: false
  };
}

function tdUnknownFile(id: number) {
  return {
    ...tdFile(id, 0),
    expected_size: 0
  };
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
