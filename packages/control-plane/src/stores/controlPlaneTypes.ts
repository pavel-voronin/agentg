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

export type HistoryActiveJob = {
  chatId: string;
  endAt: string;
  startAt: string;
  status: string;
};

export type HistoryOverview = {
  activeJob: HistoryActiveJob | null;
  chats: number;
  coverageIntervals: number;
  pendingJobs: number;
  runningJobs: number;
  targets: number;
  templates: number;
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

export type AppEventBodyView = {
  raw: string;
  yaml: string;
  yamlLines: AppEventYamlLine[];
};

export type AppEventYamlLine = {
  indent: number;
  tokens: AppEventYamlToken[];
};

export type AppEventYamlToken =
  | {
      kind: 'modelRef';
      color: string;
      id: string;
      model: string;
    }
  | {
      kind: 'text';
      text: string;
    };

export type AppStandardEventItem = {
  body: AppEventBodyView;
  color: string;
  filterable: boolean;
  kind: 'event';
  key: string;
  muted: boolean;
  occurredAt: string;
  type: string;
};

export type AppRpcLifecycleItem = {
  body: AppEventBodyView;
  key: string;
  label: string;
  muted: boolean;
  occurredAt: string;
  occurredAtMs: number | null;
  suffix: string;
  title: string;
  type: string;
};

export type AppRpcEventItem = {
  callId: string;
  color: string;
  filterable: boolean;
  kind: 'rpc';
  key: string;
  lifecycleTypes: string[];
  lifecycles: AppRpcLifecycleItem[];
  muted: boolean;
  target: string;
};

export type AppEventItem = AppStandardEventItem | AppRpcEventItem;

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

export type ControlPlaneChat = {
  coverageIntervals: number;
  id: string;
  isBot: boolean;
  pendingJobs: number;
  placements: ChatPlacement[];
  runningJobs: number;
  targets: number;
  title: string;
  type: string;
  updatedAt: string;
};

export type ChatFolder = {
  count: number;
  iconName: string | null;
  id: number;
  position: number;
  title: string;
};

export type ChatNavigation = {
  archiveCount: number;
  folders: ChatFolder[];
  mainCount: number;
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

export type HistoryChatTypeCount = {
  count: number;
  type: string;
};

export type SelectedHistoryState = {
  chat: SelectedHistoryChat | null;
  coverage: HistoryInterval[];
  desired: HistoryInterval[];
  jobs: HistoryJob[];
  missing: HistoryInterval[];
  targets: HistoryTarget[];
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

export type EventFilterLifecycleColumnView = {
  checked: boolean;
  indeterminate: boolean;
  label: string;
  suffix: string;
  title: string;
  types: string[];
};

export type EventFilterRpcLifecycleView = {
  enabled: boolean;
  label: string;
  suffix: string;
  title: string;
  type: string;
};

export type EventFilterRpcCallView = {
  checked: boolean;
  indeterminate: boolean;
  lifecycles: EventFilterRpcLifecycleView[];
  lifecycleTypes: string[];
  target: string;
};

export type EventFilterGroupView = {
  checked: boolean;
  color: string;
  id: string;
  indeterminate: boolean;
  kind: 'rpc' | 'types';
  label: string;
  lifecycleColumns: EventFilterLifecycleColumnView[];
  rpcCalls: EventFilterRpcCallView[];
  types: EventFilterTypeView[];
};

export type EventFilterDomainView = {
  enabledCount: string;
  events: EventFilterTypeView[];
  eventsChecked: boolean;
  eventsIndeterminate: boolean;
  eventTypes: string[];
  id: string;
  label: string;
  rpc: EventFilterGroupView[];
};

export type EventFiltersPanelView = {
  domains: EventFilterDomainView[];
  enabledCount: string;
  groups: EventFilterGroupView[];
};

export type EventsPanelMode = 'events' | 'filters';

export const RPC_CALL_EVENT_LIFECYCLES = [
  { label: 'S', suffix: 'started', title: 'Started' },
  { label: 'C', suffix: 'completed', title: 'Completed' },
  { label: 'F', suffix: 'failed', title: 'Failed' },
  { label: 'P', suffix: 'progress', title: 'Progress' }
] as const;

const RPC_CALL_EVENT_TARGETS = [
  'history.getChatHistoryState',
  'history.requestSync',
  'summaries.summaries.requestSummary',
  'telegram.countMessagesInIntervals',
  'telegram.fetchPage',
  'telegram.getChat',
  'telegram.getChatHistoryFacts',
  'telegram.getMessage',
  'telegram.listChatDirectory',
  'telegram.listChats',
  'telegram.listRecentMessages',
  'telegram.searchMessages'
] as const;
const RPC_CALL_EVENT_TYPES = RPC_CALL_EVENT_TARGETS.flatMap((target) =>
  RPC_CALL_EVENT_LIFECYCLES.map((lifecycle) => `${target}.${lifecycle.suffix}`)
);
const TELEGRAM_OPERATION_EVENT_SUFFIXES = ['started', 'completed', 'failed'] as const;
const TELEGRAM_OPERATION_EVENT_TARGETS = ['telegram.login'] as const;
const TELEGRAM_OPERATION_EVENT_TYPES = TELEGRAM_OPERATION_EVENT_TARGETS.flatMap((target) =>
  TELEGRAM_OPERATION_EVENT_SUFFIXES.map((suffix) => `${target}.${suffix}`)
);
const TDLIB_CALL_EVENT_SUFFIXES = ['started', 'completed', 'failed'] as const;
const TDLIB_CALL_EVENT_TARGETS = [
  'telegram.tdlib.close',
  'telegram.tdlib.getChat',
  'telegram.tdlib.getChatHistory',
  'telegram.tdlib.getChatMessageByDate',
  'telegram.tdlib.getChats',
  'telegram.tdlib.getMe',
  'telegram.tdlib.loadChats'
] as const;
const TDLIB_CALL_EVENT_TYPES = TDLIB_CALL_EVENT_TARGETS.flatMap((target) =>
  TDLIB_CALL_EVENT_SUFFIXES.map((suffix) => `${target}.${suffix}`)
);

export const EVENT_GROUPS: EventGroup[] = [
  {
    color: '#6366f1',
    eventTypes: RPC_CALL_EVENT_TYPES,
    id: 'rpc',
    label: 'RPC calls',
    match: isRpcCallEventType
  },
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
      'history.target.deleted',
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
    color: '#0f766e',
    eventTypes: ['telegram.user.updated'],
    id: 'telegram_users',
    label: 'Telegram users',
    match: (type) => type.startsWith('telegram.user.')
  },
  {
    color: '#f59e0b',
    eventTypes: ['telegram.status'],
    id: 'telegram_status',
    label: 'Telegram status',
    match: (type) => type === 'telegram.status'
  },
  {
    color: '#fb923c',
    eventTypes: TELEGRAM_OPERATION_EVENT_TYPES,
    id: 'telegram_operations',
    label: 'Telegram operations',
    match: (type) => TELEGRAM_OPERATION_EVENT_TYPES.includes(type)
  },
  {
    color: '#f97316',
    eventTypes: TDLIB_CALL_EVENT_TYPES,
    id: 'telegram_tdlib',
    label: 'TDLib calls',
    match: (type) => type.startsWith('telegram.tdlib.')
  },
  {
    color: '#14b8a6',
    eventTypes: [
      'summaries.summary.completed',
      'summaries.summary.invalidated',
      'summaries.summary.requested'
    ],
    id: 'summaries',
    label: 'Summaries',
    match: (type) => type.startsWith('summaries.')
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

function isRpcCallEventType(type: string): boolean {
  return RPC_CALL_EVENT_TYPES.includes(type);
}
