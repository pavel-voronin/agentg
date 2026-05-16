import { describe, expect, it } from 'vitest';

import { tdlibChat } from '../src/tdlib-schema/Chat.js';
import { tdlibUpdateChatFolders } from '../src/tdlib-schema/UpdateChatFolders.js';
import { tdlibUpdateDeleteMessages } from '../src/tdlib-schema/UpdateDeleteMessages.js';
import { tdlibUpdateFile } from '../src/tdlib-schema/UpdateFile.js';
import { tdlibUpdateMessageContent } from '../src/tdlib-schema/UpdateMessageContent.js';
import { tdlibUpdateNewMessage } from '../src/tdlib-schema/UpdateNewMessage.js';
import { tdlibUser } from '../src/tdlib-schema/User.js';
import { extractFormattedTextLinkEntities, tdlibMessage } from '../src/tdlib-schema/Message.js';

describe('TDLib schemas', () => {
  it('adapts new text messages', () => {
    const update = tdlibUpdateNewMessage({
      _: 'updateNewMessage',
      message: {
        _: 'message',
        chat_id: -100,
        content: {
          _: 'messageText',
          text: {
            _: 'formattedText',
            entities: [],
            text: 'hello'
          }
        },
        date: 1777130000,
        id: 42,
        sender_id: {
          _: 'messageSenderUser',
          user_id: 927300
        }
      }
    });

    expect(update.message).toMatchObject({
      chat_id: '-100',
      content: {
        _: 'messageText'
      },
      id: '42',
      sender_id: {
        _: 'messageSenderUser',
        user_id: '927300'
      }
    });
  });

  it('adapts message content updates', () => {
    const update = tdlibUpdateMessageContent({
      _: 'updateMessageContent',
      chat_id: -100,
      edit_date: 1777130100,
      message_id: 42,
      new_content: {
        _: 'messageText',
        text: {
          _: 'formattedText',
          entities: [],
          text: 'edited'
        }
      }
    });

    expect(update).toMatchObject({
      chat_id: '-100',
      message_id: '42',
      new_content: {
        _: 'messageText'
      }
    });
    expect(update.edit_date?.toISOString()).toBe('2026-04-25T15:15:00.000Z');
  });

  it('extracts chat member leave service actions', () => {
    const update = tdlibUpdateNewMessage({
      _: 'updateNewMessage',
      message: {
        _: 'message',
        chat_id: -100,
        content: {
          _: 'messageChatDeleteMember',
          user_id: 927300
        },
        date: 1777130000,
        id: 43,
        sender_id: {
          _: 'messageSenderUser',
          user_id: 927300
        }
      }
    });

    expect(update.message.content).toMatchObject({
      _: 'messageChatDeleteMember',
      user_id: 927300
    });
  });

  it('extracts link entities from Telegram formatted text', () => {
    expect(
      extractFormattedTextLinkEntities({
        _: 'formattedText',
        entities: [
          {
            _: 'textEntity',
            length: 11,
            offset: 6,
            type: {
              _: 'textEntityTypeUrl'
            }
          },
          {
            _: 'textEntity',
            length: 4,
            offset: 22,
            type: {
              _: 'textEntityTypeTextUrl',
              url: 'https://docs.example/path'
            }
          }
        ],
        text: 'visit example.com and docs'
      })
    ).toEqual([
      {
        kind: 'url',
        length: 11,
        offset: 6,
        url: 'https://example.com/'
      },
      {
        kind: 'textUrl',
        length: 4,
        offset: 22,
        url: 'https://docs.example/path'
      }
    ]);
  });

  it('filters unsafe formatted text link entities', () => {
    expect(
      extractFormattedTextLinkEntities({
        _: 'formattedText',
        entities: [
          {
            _: 'textEntity',
            length: 4,
            offset: 0,
            type: {
              _: 'textEntityTypeTextUrl',
              url: 'javascript:alert(1)'
            }
          }
        ],
        text: 'docs'
      })
    ).toEqual([]);
  });

  it('adapts deleted messages', () => {
    expect(
      tdlibUpdateDeleteMessages({
        _: 'updateDeleteMessages',
        chat_id: -100,
        from_cache: false,
        is_permanent: true,
        message_ids: [42, 43]
      })
    ).toMatchObject({
      chat_id: '-100',
      from_cache: false,
      is_permanent: true,
      message_ids: ['42', '43']
    });
  });

  it('adapts updateFile with typed local and remote file state', () => {
    expect(
      tdlibUpdateFile({
        _: 'updateFile',
        file: {
          _: 'file',
          expected_size: 2048,
          id: 123,
          local: {
            _: 'localFile',
            can_be_deleted: true,
            can_be_downloaded: true,
            download_offset: 0,
            downloaded_prefix_size: 1024,
            downloaded_size: 1024,
            is_downloading_active: true,
            is_downloading_completed: false,
            path: ''
          },
          remote: {
            _: 'remoteFile',
            id: 'remote-id',
            is_uploading_active: false,
            is_uploading_completed: true,
            unique_id: 'remote-unique-id',
            uploaded_size: 0
          },
          size: 0
        }
      }).file
    ).toMatchObject({
      id: 123,
      local: {
        downloaded_size: 1024,
        is_downloading_active: true
      },
      remote: {
        unique_id: 'remote-unique-id'
      }
    });
  });

  it('escapes nul bytes in message content for jsonb storage', () => {
    const message = tdlibMessage({
      _: 'message',
      chat_id: -100,
      content: {
        _: 'messagePoll',
        poll: {
          _: 'poll',
          options: [
            {
              _: 'pollOption',
              id: String.fromCharCode(0),
              text: {
                _: 'formattedText',
                entities: [],
                text: 'Option'
              }
            }
          ]
        }
      },
      date: 1777130000,
      id: 42,
      sender_id: {
        _: 'messageSenderUser',
        user_id: 927300
      }
    });

    expect(JSON.stringify(message.content)).not.toContain(String.fromCharCode(0));
    expect(JSON.stringify(message.content)).toContain('\\\\u0000');
    expect(message.content).toMatchObject({
      poll: {
        options: [
          {
            id: '\\u0000'
          }
        ]
      }
    });
  });

  it('keeps channels distinct from supergroups', () => {
    expect(
      tdlibChat({
        _: 'chat',
        id: 1,
        title: 'News',
        type: {
          _: 'chatTypeSupergroup',
          is_channel: true,
          supergroup_id: 10
        }
      }).type
    ).toBe('channel');
  });

  it('adapts non-channel supergroups and basic groups as groups', () => {
    expect(
      tdlibChat({
        _: 'chat',
        id: 2,
        title: 'Group',
        type: {
          _: 'chatTypeSupergroup',
          is_channel: false,
          supergroup_id: 20
        }
      }).type
    ).toBe('group');

    expect(
      tdlibChat({
        _: 'chat',
        id: 3,
        title: 'Basic Group',
        type: {
          _: 'chatTypeBasicGroup',
          basic_group_id: 30
        }
      }).type
    ).toBe('group');
  });

  it('marks the authenticated account user explicitly', () => {
    expect(
      tdlibUser(
        {
          _: 'user',
          first_name: 'Pavel',
          id: 927300,
          last_name: 'Voronin',
          type: { _: 'userTypeRegular' }
        },
        { isSelf: true }
      ).isSelf
    ).toBe(true);
  });

  it('extracts folder title, icon, and order from updateChatFolders', () => {
    expect(
      tdlibUpdateChatFolders({
        _: 'updateChatFolders',
        chat_folders: [
          {
            _: 'chatFolderInfo',
            icon: { _: 'chatFolderIcon', name: 'Cat' },
            id: 20,
            name: {
              _: 'chatFolderName',
              text: {
                _: 'formattedText',
                entities: [],
                text: 'Pets'
              }
            }
          },
          {
            _: 'chatFolderInfo',
            icon: { _: 'chatFolderIcon', name: 'Work' },
            id: 6,
            name: {
              _: 'chatFolderName',
              text: {
                _: 'formattedText',
                entities: [],
                text: 'Work'
              }
            }
          }
        ]
      }).chat_folders
    ).toEqual([
      expect.objectContaining({
        iconName: 'Cat',
        id: 20,
        position: 0,
        title: 'Pets'
      }),
      expect.objectContaining({
        iconName: 'Work',
        id: 6,
        position: 1,
        title: 'Work'
      })
    ]);
  });
});
