import { describe, expect, it } from 'vitest';

import {
  chatSidebarView,
  type ChatSidebarViewSource
} from '../src/control-plane/chatSidebarView.js';

describe('Telegram chat sidebar view', () => {
  it('places Archive at the end of the folder navigation', () => {
    const view = chatSidebarView(
      {
        chatFilter: '',
        chatFolderId: null,
        chatListMode: 'main',
        chatNavigation: {
          archiveCount: 2,
          folders: [
            {
              count: 4,
              iconName: null,
              id: 7,
              position: 0,
              title: 'Work'
            }
          ],
          mainCount: 10
        },
        chats: []
      },
      null
    );

    expect(view.folders).toMatchObject([
      {
        active: true,
        badge: '10',
        id: 'main',
        label: 'All',
        title: 'All chats',
        type: 'main'
      },
      {
        active: false,
        badge: '4',
        folderId: 7,
        id: 'folder:7',
        label: 'Work',
        title: 'Work',
        type: 'folder'
      },
      {
        active: false,
        badge: '2',
        id: 'archive',
        label: 'Archive',
        title: 'Archive',
        type: 'archive'
      }
    ]);
    expect('archiveShortcut' in view).toBe(false);
    expect('archiveFolder' in view).toBe(false);
  });

  it('marks only Archive active without a list header for the archive list', () => {
    const view = chatSidebarView(sourceWithListMode('archive'), null);

    expect(view.header).toBeNull();
    expect(view.folders[0]).toMatchObject({
      active: false,
      id: 'main',
      type: 'main'
    });
    expect(view.folders.at(-1)).toMatchObject({
      active: true,
      id: 'archive',
      type: 'archive'
    });
  });
});

function sourceWithListMode(
  chatListMode: ChatSidebarViewSource['chatListMode']
): ChatSidebarViewSource {
  return {
    chatFilter: '',
    chatFolderId: null,
    chatListMode,
    chatNavigation: {
      archiveCount: 1,
      folders: [],
      mainCount: 3
    },
    chats: []
  };
}
