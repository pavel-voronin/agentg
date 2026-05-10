import type { TelegramFileRef } from '../rpc/contracts.js';

export type ChatListMode = 'archive' | 'folder' | 'main';

export type ChatPlacement =
  | {
      kind: 'archive';
      order: string;
    }
  | {
      kind: 'main';
      order: string;
    }
  | {
      folderId: number;
      kind: 'folder';
      order: string;
    };

export type TelegramDirectoryChat = {
  avatar: {
    big: TelegramFileRef | null;
    small: TelegramFileRef | null;
  };
  id: string;
  isBot: boolean;
  lastMessageDate: number;
  placements: ChatPlacement[];
  title: string;
  type: string;
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
  folders: ChatFolder[];
  mainCount: number;
};

export type ChatFolder = {
  count: number;
  iconName: string | null;
  id: number;
  position: number;
  title: string;
};

export type ControlPlaneChat = TelegramDirectoryChat & {
  _model: 'telegram.chat';
};

export type ChatFolderNavItem = {
  active: boolean;
  badge: string;
  folderId?: number;
  id: string;
  label: string;
  title: string;
  type: 'folder' | 'main';
};

export type ChatListHeaderView =
  | {
      kind: 'archive';
      subtitle: string;
      title: string;
    }
  | {
      kind: 'search';
      title: string;
    };

export type ChatArchiveShortcutView = {
  count: string;
};

export type ChatIconKind = 'bot' | 'channel' | 'group' | 'secret';

export type ChatListItemView = {
  active: boolean;
  avatarUrl: string | null;
  icon: ChatIconKind | null;
  id: string;
  initials: string;
  title: string;
};

export type ChatSidebarView = {
  archiveShortcut: ChatArchiveShortcutView | null;
  chats: ChatListItemView[];
  emptyMessage: string | null;
  folders: ChatFolderNavItem[];
  hasSearch: boolean;
  header: ChatListHeaderView | null;
  search: string;
};
