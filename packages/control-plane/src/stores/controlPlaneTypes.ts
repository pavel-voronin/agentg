export const DEFAULT_EVENT_LIMIT = 200;
export const MAX_EVENT_LIMIT = 2000;
export const MIN_EVENT_LIMIT = 20;
export const EVENT_LIMIT_STEP = 20;
export const DEFAULT_VIEWPORT_DAYS = 30;
export const TIMELINE_SCALE_PRESETS = [
  { label: '7d', value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
  { label: '1y', value: 365 },
  { label: 'All', value: 0 }
] as const;

export type EventGroup = {
  color: string;
  eventTypes: string[];
  filterable?: boolean;
  id: string;
  label: string;
  match: (type: string) => boolean;
};

export type HistoryOverview = {
  activeJob?: {
    chatId?: string | number;
    endAt?: Date | string;
    startAt?: Date | string;
    status?: string;
  } | null;
  chats?: number;
  coverageIntervals?: number;
  targets?: number;
};

export type ControlPlaneEvent = {
  data?: unknown;
  id?: string;
  occurredAt?: Date | string;
  type?: string;
};

export type DashboardMetric = {
  detail?: string;
  label: string;
  value: string;
};

export type StatusBadgeKind = 'bad' | 'ok' | 'warn';

export type StatusBadgeView = {
  kind: StatusBadgeKind;
  label: string;
};

export type AppShellView = {
  controlPlaneStatus: StatusBadgeView;
  dashboardCollapsed: boolean;
  eventsPanelCollapsed: boolean;
  tdlibStatus: StatusBadgeView;
};

export type AppEventItem = {
  color: string;
  dataJson: string;
  key: string;
  occurredAt: string;
  type: string;
};

export type ChatListMode = 'archive' | 'folder' | 'main';

export type ControlPlaneChat = {
  coverageIntervals?: number;
  id: string;
  isBot?: boolean;
  pendingJobs?: number;
  runningJobs?: number;
  targets?: number;
  title?: string;
  type?: string;
};

export type ChatFolder = {
  count?: number;
  id: number;
  title?: string;
};

export type ChatNavigation = {
  archiveCount?: number;
  folders?: ChatFolder[];
  mainCount?: number;
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

export type SelectedHistoryChat = {
  historyBeginningReached?: boolean;
  historyStartAt?: Date | string;
  id: string;
  messageCount?: number;
  title?: string;
  type?: string;
};

export type SelectedHistoryState = {
  chat?: SelectedHistoryChat | null;
  coverage?: unknown[];
  jobs?: unknown[];
  targets?: unknown[];
  [key: string]: unknown;
};

export type SelectedHistoryStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

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

export type EventFiltersState = {
  groups: Record<string, boolean>;
  types: Record<string, boolean>;
};

export type EventFilterTypeView = {
  enabled: boolean;
  groupId: string;
  type: string;
};

export type EventFilterGroupView = {
  checked: boolean;
  color: string;
  id: string;
  indeterminate: boolean;
  label: string;
  types: EventFilterTypeView[];
};

export type EventFiltersPanelView = {
  enabledCount: string;
  groups: EventFilterGroupView[];
  limit: number;
  maxLimit: number;
  minLimit: number;
  step: number;
};

export type EventsPanelMode = 'events' | 'filters';

export const EVENT_GROUPS: EventGroup[] = [
  {
    color: '#7c3aed',
    eventTypes: [
      'history.coverage.changed',
      'history.job.completed',
      'history.job.failed',
      'history.job.progress',
      'history.job.started',
      'history.reconcile.completed',
      'history.sync.accepted',
      'history.sync.completed',
      'history.sync.failed',
      'history.sync.requested',
      'history.sync.started',
      'history.target.auto_deleted',
      'history.target.delete.completed',
      'history.target.delete.failed',
      'history.target.deleted',
      'history.target.upsert.completed',
      'history.target.upsert.failed',
      'history.target.upserted'
    ],
    id: 'history',
    label: 'History',
    match: (type) => type.startsWith('history.')
  },
  {
    color: '#0ea5e9',
    eventTypes: [
      'telegram.message.created',
      'telegram.message.deleted',
      'telegram.message.updated'
    ],
    id: 'telegram_messages',
    label: 'Telegram messages',
    match: (type) => type.startsWith('telegram.message.')
  },
  {
    color: '#10b981',
    eventTypes: ['telegram.chat.updated', 'telegram.chat_folders.updated'],
    id: 'telegram_chats',
    label: 'Telegram chats',
    match: (type) => type.startsWith('telegram.chat.') || type.startsWith('telegram.chat_folders.')
  },
  {
    color: '#f59e0b',
    eventTypes: ['telegram.tdlib.status'],
    id: 'telegram_status',
    label: 'Telegram status',
    match: (type) => type === 'telegram.tdlib.status'
  },
  {
    color: '#ef4444',
    eventTypes: ['ui.error'],
    filterable: false,
    id: 'ui',
    label: 'UI',
    match: (type) => type.startsWith('ui.')
  },
  {
    color: '#dc2626',
    eventTypes: ['other'],
    filterable: false,
    id: 'other',
    label: 'Unexpected',
    match: () => true
  }
];
