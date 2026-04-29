import { describe, expect, it } from 'vitest';

import { normalizeChat, normalizeChatFolders, normalizeUser } from '../src/normalize.js';

describe('normalizeChat', () => {
  it('keeps channels distinct from supergroups', () => {
    expect(
      normalizeChat({
        _: 'chat',
        id: 1,
        title: 'News',
        type: {
          _: 'chatTypeSupergroup',
          is_channel: true,
          supergroup_id: 10
        }
      })?.type
    ).toBe('channel');
  });

  it('normalizes non-channel supergroups as groups', () => {
    expect(
      normalizeChat({
        _: 'chat',
        id: 2,
        title: 'Group',
        type: {
          _: 'chatTypeSupergroup',
          is_channel: false,
          supergroup_id: 20
        }
      })?.type
    ).toBe('group');
  });

  it('normalizes basic groups as groups', () => {
    expect(
      normalizeChat({
        _: 'chat',
        id: 3,
        title: 'Basic Group',
        type: {
          _: 'chatTypeBasicGroup',
          basic_group_id: 30
        }
      })?.type
    ).toBe('group');
  });
});

describe('normalizeUser', () => {
  it('marks the authenticated account user explicitly', () => {
    expect(
      normalizeUser(
        {
          _: 'user',
          first_name: 'Pavel',
          id: 927300,
          last_name: 'Voronin',
          type: { _: 'userTypeRegular' }
        },
        { isSelf: true }
      )?.isSelf
    ).toBe(true);
  });
});

describe('normalizeChatFolders', () => {
  it('extracts folder title, icon, and order from updateChatFolders', () => {
    expect(
      normalizeChatFolders({
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
        ],
        main_chat_list_position: 0
      })?.folders
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
