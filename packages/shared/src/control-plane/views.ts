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

export type SelectedHistoryChat = {
  historyBeginningReached: boolean;
  historyStartAt: string | null;
  id: string;
  isBot: boolean;
  messageCount: number;
  title: string;
  type: string;
  updatedAt: string;
};

export type HistoryInterval = {
  endAt: string;
  messageCount?: number;
  startAt: string;
};

export type HistoryBoundary =
  | {
      at: string;
      kind: 'absolute';
    }
  | {
      expression: string;
      kind: 'expression';
    };

export type HistoryRange = {
  end: HistoryBoundary;
  start: HistoryBoundary;
};

export type HistoryJob = {
  cursor?: Record<string, unknown>;
  endAt: string;
  id: string;
  startAt: string;
  status: string;
  telegramChatId?: string;
  updatedAt: string;
};

export type HistoryTarget = {
  chatId: string;
  id: string;
  projected?: HistoryInterval;
  range: HistoryRange;
  templateId?: string | null;
};

export type SelectedHistoryState = {
  chat: SelectedHistoryChat | null;
  coverage: HistoryInterval[];
  desired: HistoryInterval[];
  jobs: HistoryJob[];
  missing: HistoryInterval[];
  targets: HistoryTarget[];
};

export type SelectedChatHeaderView = {
  historyLabel: string | null;
  id: string;
  messageCount: string;
  title: string;
  type: string;
};

export type TimelineScaleButtonView = {
  active: boolean;
  isDefault: boolean;
  label: string;
  value: number;
};

export type SelectedWorkspaceView =
  | {
      status: 'empty';
    }
  | {
      status: 'loading';
    }
  | {
      status: 'unavailable';
    }
  | {
      chat: SelectedChatHeaderView;
      historyState: SelectedHistoryState;
      scaleButtons: TimelineScaleButtonView[];
      status: 'ready';
      viewportDays: number | null;
    };

export type MainWorkspaceContext = {
  chatSidebar: ChatSidebarView;
  eventsPanelCollapsed: boolean;
  selectedWorkspace: SelectedWorkspaceView;
};
