import { describe, expect, it } from 'vitest';

import { chatSidebarView, type ChatSidebarViewSource } from './chatSidebarView.js';
import type { ControlPlaneChat } from './views.js';

describe('Telegram chat sidebar view', () => {
  it('places Archive at the end of the folder navigation', () => {
    const view = chatSidebarView(
      {
        chatFilter: '',
        chatFolderId: null,
        chatListMode: 'main',
        chatNavigation: {
          archiveCount: 2,
          archiveMutedUnreadCount: 0,
          archiveUnreadCount: 1,
          folders: [
            {
              count: 4,
              iconName: 'Work',
              id: 7,
              mutedUnreadCount: 0,
              position: 0,
              title: 'Work',
              unreadCount: 2
            }
          ],
          mainCount: 10,
          mainMutedUnreadCount: 0,
          mainUnreadCount: 3
        },
        chats: []
      },
      null
    );

    expect(view.folders).toMatchObject([
      {
        active: true,
        badge: '3',
        badgeTone: 'notify',
        id: 'main',
        icon: 'chats',
        iconAccent: null,
        label: 'All',
        title: 'All chats',
        type: 'main'
      },
      {
        active: false,
        badge: '2',
        badgeTone: 'notify',
        folderId: 7,
        id: 'folder:7',
        icon: 'folder',
        iconAccent: 'work',
        label: 'Work',
        title: 'Work',
        type: 'folder'
      },
      {
        active: false,
        badge: '1',
        badgeTone: 'notify',
        id: 'archive',
        icon: 'archive',
        iconAccent: null,
        label: 'Archive',
        title: 'Archive',
        type: 'archive'
      }
    ]);
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

  it('builds Telegram-style row metadata for pinned unread chats', () => {
    const view = chatSidebarView(
      {
        ...sourceWithListMode('main'),
        chats: [
          chat({
            isPremium: true,
            lastMessage: {
              authorName: 'Ada',
              authorPlaceholder: false,
              date: '2026-05-03T03:09:37.000Z',
              datePlaceholder: false,
              isForwarded: false,
              isOutgoing: false,
              isRead: null,
              readPlaceholder: false,
              text: 'Design notes are ready',
              textPlaceholder: false
            },
            placements: [{ isPinned: true, kind: 'main', order: '100' }],
            title: 'Signal Crew',
            type: 'group',
            unreadCount: 4,
            unreadCountPlaceholder: false
          })
        ]
      },
      null
    );

    expect(view.chats[0]).toMatchObject({
      icon: 'group',
      initials: 'SC',
      isPinned: true,
      isPremium: false,
      lastMessage: {
        author: 'Ada',
        showAuthor: true,
        text: 'Design notes are ready'
      },
      unreadBadge: '4'
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
      archiveMutedUnreadCount: 0,
      archiveUnreadCount: 0,
      folders: [],
      mainCount: 3,
      mainMutedUnreadCount: 0,
      mainUnreadCount: 0
    },
    chats: []
  };
}

function chat(input: Partial<ControlPlaneChat>): ControlPlaneChat {
  return {
    _model: 'telegram.chat',
    avatar: {
      big: null,
      small: null
    },
    id: 'chat-1',
    isBot: false,
    isPremium: false,
    isSelf: false,
    isUnread: false,
    lastMessage: null,
    lastMessageDate: null,
    notificationsEnabled: true,
    notificationsPlaceholder: false,
    placements: [{ isPinned: false, kind: 'main', order: '100' }],
    title: 'Chat',
    type: 'group',
    unreadCount: 0,
    unreadCountPlaceholder: false,
    updatedAt: '2026-05-11T00:00:00.000Z',
    ...input
  };
}
