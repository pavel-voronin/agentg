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

export type ChatStats = {
  chatId: string;
  coverageIntervals: number;
  coverageNewestAt: string | null;
  coverageOldestAt: string | null;
  pendingJobs: number;
  runningJobs: number;
  targets: number;
};

export type ControlPlaneChat = TelegramDirectoryChat &
  Omit<ChatStats, 'chatId'> & {
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
  coverageIntervals: string;
  icon: ChatIconKind | null;
  id: string;
  pendingJobs: string;
  runningJobs: string;
  targets: string;
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
