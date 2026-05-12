import type { TelegramFileRef } from '../rpc/contracts.js';

export type ChatListMode = 'archive' | 'folder' | 'main';

export type ChatPlacement =
  | {
      isPinned: boolean;
      kind: 'archive';
      order: string;
    }
  | {
      isPinned: boolean;
      kind: 'main';
      order: string;
    }
  | {
      folderId: number;
      isPinned: boolean;
      kind: 'folder';
      order: string;
    };

export type TelegramDirectoryLastMessage = {
  authorName: string | null;
  authorPlaceholder: boolean;
  date: number;
  datePlaceholder: boolean;
  isForwarded: boolean;
  isOutgoing: boolean;
  isRead: boolean | null;
  readPlaceholder: boolean;
  text: string;
  textPlaceholder: boolean;
};

export type TelegramDirectoryChat = {
  avatar: {
    big: TelegramFileRef | null;
    small: TelegramFileRef | null;
  };
  id: string;
  isBot: boolean;
  isPremium: boolean;
  isSelf: boolean;
  isUnread: boolean;
  lastMessage: TelegramDirectoryLastMessage | null;
  lastMessageDate: number;
  notificationsEnabled: boolean | null;
  notificationsPlaceholder: boolean;
  placements: ChatPlacement[];
  title: string;
  type: string;
  unreadCount: number;
  unreadCountPlaceholder: boolean;
  updatedAt: string;
};

export type TelegramDirectoryFolder = {
  count?: number;
  folderId: number;
  iconName: string | null;
  position: number;
  title: string;
};

export type ChatNavigation = {
  archiveCount: number;
  archiveMutedUnreadCount: number;
  archiveUnreadCount: number;
  folders: ChatFolder[];
  mainCount: number;
  mainMutedUnreadCount: number;
  mainUnreadCount: number;
};

export type ChatFolder = {
  count: number;
  iconName: string | null;
  id: number;
  mutedUnreadCount: number;
  position: number;
  title: string;
  unreadCount: number;
};

export type ControlPlaneChat = TelegramDirectoryChat & {
  _model: 'telegram.chat';
};

export type ChatFolderNavItem =
  | {
      active: boolean;
      badge: string;
      badgeTone: 'muted' | 'notify';
      id: 'archive';
      icon: 'archive';
      iconAccent: ChatFolderAccentIcon | null;
      label: string;
      title: string;
      type: 'archive';
    }
  | {
      active: boolean;
      badge: string;
      badgeTone: 'muted' | 'notify';
      id: 'main';
      icon: 'chats';
      iconAccent: ChatFolderAccentIcon | null;
      label: string;
      title: string;
      type: 'main';
    }
  | {
      active: boolean;
      badge: string;
      badgeTone: 'muted' | 'notify';
      folderId: number;
      id: string;
      icon: 'folder';
      iconAccent: ChatFolderAccentIcon | null;
      label: string;
      title: string;
      type: 'folder';
    };

export type ChatFolderAccentIcon =
  | 'book'
  | 'bot'
  | 'crown'
  | 'favorite'
  | 'game'
  | 'home'
  | 'love'
  | 'private'
  | 'school'
  | 'sport'
  | 'trade'
  | 'travel'
  | 'unread'
  | 'work';

export type ChatListHeaderView = {
  kind: 'search';
  title: string;
};

export type ChatIconKind = 'bot' | 'channel' | 'group' | 'secret';

export type ChatLastMessageView = {
  author: string;
  authorPlaceholder: boolean;
  dateLabel: string;
  datePlaceholder: boolean;
  isForwarded: boolean;
  readState: 'read' | 'sent' | 'placeholder' | null;
  showAuthor: boolean;
  text: string;
  textPlaceholder: boolean;
};

export type ChatListItemView = {
  active: boolean;
  avatarUrl: string | null;
  icon: ChatIconKind | null;
  id: string;
  initials: string;
  isPinned: boolean;
  isPremium: boolean;
  lastMessage: ChatLastMessageView;
  notificationsEnabled: boolean | null;
  notificationsPlaceholder: boolean;
  title: string;
  unreadBadge: string;
};

export type ChatSidebarView = {
  chats: ChatListItemView[];
  emptyMessage: string | null;
  folders: ChatFolderNavItem[];
  hasSearch: boolean;
  header: ChatListHeaderView | null;
  search: string;
};
