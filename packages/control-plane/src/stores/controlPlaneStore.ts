import { computed, reactive, type ComputedRef } from 'vue';

const EVENT_FILTER_STORAGE_KEY = 'agentg.controlPlane.eventFilters';
const EVENT_LIMIT_STORAGE_KEY = 'agentg.controlPlane.eventLimit';
const CHAT_FILTER_STORAGE_KEY = 'agentg.controlPlane.chatFilter';
const CHAT_LIST_SELECTION_STORAGE_KEY = 'agentg.controlPlane.chatListSelection';
const SELECTED_CHAT_ID_STORAGE_KEY = 'agentg.controlPlane.selectedChatId';
const DEFAULT_VIEWPORT_DAYS_STORAGE_KEY = 'agentg.controlPlane.defaultViewportDays';
const DASHBOARD_COLLAPSED_STORAGE_KEY = 'agentg.controlPlane.dashboardCollapsed';
const EVENTS_PANEL_COLLAPSED_STORAGE_KEY = 'agentg.controlPlane.eventsPanelCollapsed';
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
  dashboardCollapsed: boolean;
  eventsPanelCollapsed: boolean;
  gatewayStatus: StatusBadgeView;
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

export type ControlPlaneState = {
  chatFilter: string;
  chatFolderId: number | null;
  chatListMode: ChatListMode;
  chatNavigation: ChatNavigation;
  chats: ControlPlaneChat[];
  dashboardCollapsed: boolean;
  defaultViewportDays: number;
  eventFilters: EventFiltersState;
  eventLimit: number;
  events: ControlPlaneEvent[];
  eventsPanelMode: EventsPanelMode;
  eventsPanelCollapsed: boolean;
  gatewayStatus: StatusBadgeKind;
  overview: HistoryOverview | null;
  selectedChatId: string | null;
  selectedHistoryState: SelectedHistoryState | null;
  selectedHistoryStatus: 'idle' | 'loading' | 'ready' | 'unavailable';
  tdlibStatus: StatusBadgeKind;
  viewportDays: number | null;
};

export type ControlPlaneStore = {
  clearChatFilter: () => void;
  clearEvents: () => void;
  clearSelectedChat: () => void;
  clearSelectedHistoryState: () => void;
  hasChatFolder: (folderId: number | null) => boolean;
  isEventEnabled: (event: ControlPlaneEvent) => boolean;
  markSelectedHistoryLoading: () => void;
  pushEvent: (event: ControlPlaneEvent) => boolean;
  selectArchiveChatList: () => void;
  selectChat: (chatId: string) => void;
  selectFolderChatList: (folderId: number) => void;
  selectMainChatList: () => void;
  setChatFilter: (value: string) => void;
  setChatListData: (data: { chats: ControlPlaneChat[]; navigation: ChatNavigation }) => void;
  setDashboardCollapsed: (collapsed: boolean) => void;
  setDefaultViewportDays: (value: number) => void;
  setEventGroupEnabled: (groupId: string, enabled: boolean) => void;
  setEventLimit: (value: number | string) => void;
  setEventTypeEnabled: (type: string, enabled: boolean) => void;
  setEventsPanelCollapsed: (collapsed: boolean) => void;
  setEventsPanelMode: (mode: EventsPanelMode) => void;
  setEvents: (events: ControlPlaneEvent[]) => void;
  setGatewayStatus: (status: StatusBadgeKind) => void;
  setOverview: (overview: HistoryOverview | null) => void;
  setSelectedHistoryState: (selectedState: SelectedHistoryState | null) => void;
  setSelectedHistoryUnavailable: () => void;
  setTdlibStatus: (status: StatusBadgeKind) => void;
  setViewportDays: (value: number | null) => void;
  state: ControlPlaneState;
  toggleEventsPanelMode: () => void;
};

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

export const controlPlaneStore = createControlPlaneStore();

const appShell = computed(() => appShellView(controlPlaneStore.state));
const dashboardMetrics = computed(() =>
  dashboardMetricsFromOverview(controlPlaneStore.state.overview ?? {})
);
const chatSidebar = computed(() => chatSidebarView(controlPlaneStore.state));
const selectedWorkspace = computed(() => selectedWorkspaceView(controlPlaneStore.state));
const eventItems = computed(() => controlPlaneStore.state.events.map(eventListItem));
const hasEvents = computed(() => controlPlaneStore.state.events.length > 0);
const eventFiltersPanel = computed(() => eventFiltersPanelView(controlPlaneStore.state));
const eventFiltersVisible = computed(() => controlPlaneStore.state.eventsPanelMode === 'filters');

export function createControlPlaneStore(): ControlPlaneStore {
  const initialChatListSelection = readStoredChatListSelection();
  const state = reactive<ControlPlaneState>({
    chatFilter: readStorage(CHAT_FILTER_STORAGE_KEY) ?? '',
    chatFolderId: initialChatListSelection.folderId,
    chatListMode: initialChatListSelection.mode,
    chatNavigation: emptyChatNavigation(),
    chats: [],
    dashboardCollapsed: readStoredBoolean(DASHBOARD_COLLAPSED_STORAGE_KEY, false),
    defaultViewportDays: readStoredViewportDays(),
    eventFilters: readStoredEventFilters(),
    eventLimit: readStoredEventLimit(),
    events: [],
    eventsPanelMode: 'events',
    eventsPanelCollapsed: readStoredBoolean(EVENTS_PANEL_COLLAPSED_STORAGE_KEY, false),
    gatewayStatus: 'warn',
    overview: null,
    selectedChatId: readSelectedChatId(),
    selectedHistoryState: null,
    selectedHistoryStatus: 'idle',
    tdlibStatus: 'warn',
    viewportDays: readStoredViewportDays()
  });

  return {
    clearChatFilter() {
      state.chatFilter = '';
      writeStorage(CHAT_FILTER_STORAGE_KEY, '');
    },
    clearEvents() {
      state.events = [];
    },
    clearSelectedChat() {
      state.selectedChatId = null;
      state.selectedHistoryState = null;
      state.selectedHistoryStatus = 'idle';
      writeStorage(SELECTED_CHAT_ID_STORAGE_KEY, '');
    },
    clearSelectedHistoryState() {
      state.selectedHistoryState = null;
      state.selectedHistoryStatus = state.selectedChatId === null ? 'idle' : 'loading';
    },
    hasChatFolder(folderId) {
      return (
        Number.isSafeInteger(folderId) &&
        (state.chatNavigation.folders ?? []).some((folder) => folder.id === folderId)
      );
    },
    isEventEnabled(event) {
      return isEventEnabledInState(state, event);
    },
    markSelectedHistoryLoading() {
      if (state.selectedChatId === null) {
        state.selectedHistoryState = null;
        state.selectedHistoryStatus = 'idle';
        return;
      }
      if (state.selectedHistoryState?.chat) {
        state.selectedHistoryStatus = 'ready';
        return;
      }
      state.selectedHistoryState = null;
      state.selectedHistoryStatus = 'loading';
    },
    pushEvent(event) {
      if (!isEventEnabledInState(state, event)) {
        return false;
      }
      state.events = [event, ...state.events].slice(0, state.eventLimit);
      return true;
    },
    selectArchiveChatList() {
      state.chatListMode = 'archive';
      state.chatFolderId = null;
      state.chatFilter = '';
      writeStorage(CHAT_FILTER_STORAGE_KEY, '');
      writeStoredChatListSelection({ folderId: null, mode: 'main' });
    },
    selectChat(chatId) {
      state.selectedChatId = chatId;
      state.selectedHistoryState = null;
      state.selectedHistoryStatus = 'loading';
      state.viewportDays = state.defaultViewportDays;
      writeStorage(SELECTED_CHAT_ID_STORAGE_KEY, chatId);
    },
    selectFolderChatList(folderId) {
      if (!Number.isSafeInteger(folderId)) {
        return;
      }
      state.chatListMode = 'folder';
      state.chatFolderId = folderId;
      state.chatFilter = '';
      writeStorage(CHAT_FILTER_STORAGE_KEY, '');
      writeStoredChatListSelection({ folderId, mode: 'folder' });
    },
    selectMainChatList() {
      state.chatListMode = 'main';
      state.chatFolderId = null;
      state.chatFilter = '';
      writeStorage(CHAT_FILTER_STORAGE_KEY, '');
      writeStoredChatListSelection({ folderId: null, mode: 'main' });
    },
    setChatFilter(value) {
      state.chatFilter = value;
      writeStorage(CHAT_FILTER_STORAGE_KEY, value);
    },
    setChatListData(data) {
      state.chats = data.chats;
      state.chatNavigation = normalizeChatNavigation(data.navigation);
    },
    setDashboardCollapsed(collapsed) {
      state.dashboardCollapsed = collapsed;
      writeStorage(DASHBOARD_COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0');
    },
    setDefaultViewportDays(value) {
      state.defaultViewportDays = normalizeViewportDays(value);
      writeStorage(DEFAULT_VIEWPORT_DAYS_STORAGE_KEY, String(state.defaultViewportDays));
    },
    setEventGroupEnabled(groupId, enabled) {
      const group = EVENT_GROUPS.find((item) => item.id === groupId);
      if (!group || group.filterable === false) {
        return;
      }
      state.eventFilters.groups[groupId] = enabled;
      for (const type of eventTypesForGroupInState(state, group)) {
        state.eventFilters.types[type] = enabled;
      }
      writeStoredEventFilters(state.eventFilters);
      if (!enabled) {
        state.events = state.events.filter((event) => eventGroupForEvent(event).id !== groupId);
      }
    },
    setEventLimit(value) {
      state.eventLimit = normalizeEventLimit(value);
      writeStorage(EVENT_LIMIT_STORAGE_KEY, String(state.eventLimit));
      state.events = state.events.slice(0, state.eventLimit);
    },
    setEventTypeEnabled(type, enabled) {
      const group = eventGroupForType(type);
      if (group.filterable === false) {
        return;
      }
      state.eventFilters.types[type] = enabled;
      const groupState = eventGroupFilterStateInState(state, group);
      state.eventFilters.groups[group.id] = groupState.checked || groupState.indeterminate;
      writeStoredEventFilters(state.eventFilters);
      if (!enabled) {
        state.events = state.events.filter((event) => (event.type ?? '') !== type);
      }
    },
    setEventsPanelCollapsed(collapsed) {
      state.eventsPanelCollapsed = collapsed;
      writeStorage(EVENTS_PANEL_COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0');
    },
    setEventsPanelMode(mode) {
      state.eventsPanelMode = mode === 'filters' ? 'filters' : 'events';
    },
    state,
    setEvents(events) {
      state.events = events.slice(0, state.eventLimit);
    },
    setGatewayStatus(status) {
      state.gatewayStatus = status;
    },
    setOverview(overview) {
      state.overview = overview;
    },
    setSelectedHistoryState(selectedState) {
      state.selectedHistoryState = selectedState;
      state.selectedHistoryStatus = selectedState?.chat ? 'ready' : 'unavailable';
    },
    setSelectedHistoryUnavailable() {
      state.selectedHistoryState = null;
      state.selectedHistoryStatus = state.selectedChatId === null ? 'idle' : 'unavailable';
    },
    setTdlibStatus(status) {
      state.tdlibStatus = status;
    },
    setViewportDays(value) {
      state.viewportDays = value === null ? null : normalizeViewportDays(value);
    },
    toggleEventsPanelMode() {
      state.eventsPanelMode = state.eventsPanelMode === 'filters' ? 'events' : 'filters';
    }
  };
}

export function useControlPlaneAppView(): {
  appShell: ComputedRef<AppShellView>;
  chatSidebar: ComputedRef<ChatSidebarView>;
  dashboardMetrics: ComputedRef<DashboardMetric[]>;
  eventFiltersPanel: ComputedRef<EventFiltersPanelView>;
  eventFiltersVisible: ComputedRef<boolean>;
  eventItems: ComputedRef<AppEventItem[]>;
  hasEvents: ComputedRef<boolean>;
  selectedWorkspace: ComputedRef<SelectedWorkspaceView>;
} {
  return {
    appShell,
    chatSidebar,
    dashboardMetrics,
    eventFiltersPanel,
    eventFiltersVisible,
    eventItems,
    hasEvents,
    selectedWorkspace
  };
}

export function eventGroupForEvent(event: ControlPlaneEvent): EventGroup {
  return eventGroupForType(event.type ?? '');
}

export function eventGroupForType(type: string): EventGroup {
  const fallbackGroup = EVENT_GROUPS.at(-1);
  if (fallbackGroup === undefined) {
    throw new Error('EVENT_GROUPS must contain a fallback group');
  }
  return EVENT_GROUPS.find((group) => group.match(type)) ?? fallbackGroup;
}

export function filterableEventGroups(): EventGroup[] {
  return EVENT_GROUPS.filter((group) => group.filterable !== false);
}

export function normalizeEventLimit(value: number | string): number {
  const limit = Number(value);
  if (!Number.isFinite(limit)) {
    return DEFAULT_EVENT_LIMIT;
  }
  return Math.min(MAX_EVENT_LIMIT, Math.max(MIN_EVENT_LIMIT, Math.round(limit)));
}

function appShellView(state: ControlPlaneState): AppShellView {
  return {
    dashboardCollapsed: state.dashboardCollapsed,
    eventsPanelCollapsed: state.eventsPanelCollapsed,
    gatewayStatus: statusBadgeView('GATEWAY', state.gatewayStatus),
    tdlibStatus: statusBadgeView('TDLIB', state.tdlibStatus)
  };
}

function statusBadgeView(label: string, kind: StatusBadgeKind): StatusBadgeView {
  return {
    kind,
    label
  };
}

function selectedWorkspaceView(state: ControlPlaneState): SelectedWorkspaceView {
  if (state.selectedChatId === null) {
    return { status: 'empty' };
  }
  if (state.selectedHistoryStatus === 'loading' || state.selectedHistoryStatus === 'idle') {
    return { status: 'loading' };
  }
  if (state.selectedHistoryStatus === 'unavailable' || !state.selectedHistoryState?.chat) {
    return { status: 'unavailable' };
  }
  return {
    chat: selectedChatHeaderView(state.selectedHistoryState.chat),
    historyState: state.selectedHistoryState,
    scaleButtons: timelineScaleButtons(state),
    status: 'ready',
    viewportDays: state.viewportDays
  };
}

function selectedChatHeaderView(chat: SelectedHistoryChat): SelectedChatHeaderView {
  return {
    historyLabel: selectedChatHistoryLabel(chat),
    id: chat.id,
    messageCount: `${formatInteger(chat.messageCount ?? 0)} messages`,
    title: chat.title ?? chat.id,
    type: chat.type ?? ''
  };
}

function selectedChatHistoryLabel(chat: SelectedHistoryChat): string | null {
  if (chat.historyStartAt !== undefined) {
    return `history starts ${formatDate(chat.historyStartAt)}`;
  }
  if (chat.historyBeginningReached === true) {
    return 'history beginning reached';
  }
  return null;
}

function timelineScaleButtons(state: ControlPlaneState): TimelineScaleButtonView[] {
  return TIMELINE_SCALE_PRESETS.map((preset) => ({
    active: state.viewportDays === preset.value,
    isDefault: state.defaultViewportDays === preset.value,
    label: preset.label,
    value: preset.value
  }));
}

function normalizeViewportDays(value: number | string): number {
  const days = Number(value);
  if (!Number.isFinite(days)) {
    return DEFAULT_VIEWPORT_DAYS;
  }
  return Math.max(0, Math.round(days));
}

function chatSidebarView(state: ControlPlaneState): ChatSidebarView {
  const search = state.chatFilter;
  const hasSearch = search.trim().length > 0;
  const header = chatListHeader(state, hasSearch);
  const chats = state.chats.map((chat) => chatListItemView(state, chat));
  return {
    archiveShortcut: chatArchiveShortcut(state, hasSearch),
    chats,
    emptyMessage: chats.length === 0 ? chatListEmptyMessage(hasSearch) : null,
    folders: chatFolderNavItems(state),
    hasSearch,
    header,
    search
  };
}

function chatListHeader(state: ControlPlaneState, hasSearch: boolean): ChatListHeaderView | null {
  if (hasSearch) {
    return {
      kind: 'search',
      title: 'Search results across all chats'
    };
  }
  if (state.chatListMode === 'archive') {
    return {
      kind: 'archive',
      subtitle: 'All chats folder',
      title: 'Archived chats'
    };
  }
  return null;
}

function chatArchiveShortcut(
  state: ControlPlaneState,
  hasSearch: boolean
): ChatArchiveShortcutView | null {
  const archiveCount = state.chatNavigation.archiveCount ?? 0;
  return !hasSearch && state.chatListMode === 'main' && archiveCount > 0
    ? { count: formatInteger(archiveCount) }
    : null;
}

function chatListEmptyMessage(hasSearch: boolean): string {
  return hasSearch ? 'No chats match this search.' : 'No chats in this list.';
}

function chatFolderNavItems(state: ControlPlaneState): ChatFolderNavItem[] {
  const navigation = normalizeChatNavigation(state.chatNavigation);
  return [
    {
      active: state.chatListMode !== 'folder',
      badge: formatOptionalBadge(navigation.mainCount),
      id: 'main',
      label: 'All',
      title: 'All chats',
      type: 'main'
    },
    ...navigation.folders.map((folder) => ({
      active: state.chatListMode === 'folder' && state.chatFolderId === folder.id,
      badge: formatOptionalBadge(folder.count),
      folderId: folder.id,
      id: `folder:${String(folder.id)}`,
      label: folder.title ?? `#${String(folder.id)}`,
      title: folder.title ?? `#${String(folder.id)}`,
      type: 'folder' as const
    }))
  ];
}

function chatListItemView(state: ControlPlaneState, chat: ControlPlaneChat): ChatListItemView {
  return {
    active: chat.id === state.selectedChatId,
    coverageIntervals: formatInteger(chat.coverageIntervals ?? 0),
    icon: chatIcon(chat),
    id: chat.id,
    pendingJobs: formatInteger(chat.pendingJobs ?? 0),
    runningJobs: formatInteger(chat.runningJobs ?? 0),
    targets: formatInteger(chat.targets ?? 0),
    title: chat.title ?? chat.id
  };
}

function chatIcon(chat: ControlPlaneChat): ChatIconKind | null {
  if (chat.isBot === true) {
    return 'bot';
  }
  if (chat.type === 'channel' || chat.type === 'group' || chat.type === 'secret') {
    return chat.type;
  }
  return null;
}

function normalizeChatNavigation(navigation: ChatNavigation): Required<ChatNavigation> {
  return {
    archiveCount: navigation.archiveCount ?? 0,
    folders: navigation.folders ?? [],
    mainCount: navigation.mainCount ?? 0
  };
}

function emptyChatNavigation(): Required<ChatNavigation> {
  return {
    archiveCount: 0,
    folders: [],
    mainCount: 0
  };
}

function formatOptionalBadge(value: number | undefined): string {
  return value === undefined || value <= 0 ? '' : formatInteger(value);
}

function readStoredChatListSelection(): { folderId: number | null; mode: ChatListMode } {
  const raw = readStorage(CHAT_LIST_SELECTION_STORAGE_KEY);
  if (raw === null) {
    return { folderId: null, mode: 'main' };
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      isPlainRecord(parsed) &&
      parsed.mode === 'folder' &&
      Number.isSafeInteger(parsed.folderId)
    ) {
      return { folderId: parsed.folderId as number, mode: 'folder' };
    }
  } catch {
    return { folderId: null, mode: 'main' };
  }
  return { folderId: null, mode: 'main' };
}

function writeStoredChatListSelection(selection: {
  folderId: number | null;
  mode: ChatListMode;
}): void {
  const folderId =
    selection.mode === 'folder' && Number.isSafeInteger(selection.folderId)
      ? selection.folderId
      : null;
  writeStorage(
    CHAT_LIST_SELECTION_STORAGE_KEY,
    JSON.stringify(folderId === null ? { mode: 'main' } : { folderId, mode: 'folder' })
  );
}

function eventListItem(event: ControlPlaneEvent, index: number): AppEventItem {
  const group = eventGroupForEvent(event);
  const type = event.type ?? '';
  return {
    color: group.color,
    dataJson: JSON.stringify(event.data ?? {}),
    key: event.id ?? `${formatOptionalValue(event.occurredAt)}:${type}:${String(index)}`,
    occurredAt: formatEventTime(event.occurredAt),
    type
  };
}

function eventFiltersPanelView(state: ControlPlaneState): EventFiltersPanelView {
  return {
    enabledCount: String(enabledEventFiltersCountInState(state)),
    groups: filterableEventGroups().map((group) => eventFilterGroupView(state, group)),
    limit: state.eventLimit,
    maxLimit: MAX_EVENT_LIMIT,
    minLimit: MIN_EVENT_LIMIT,
    step: EVENT_LIMIT_STEP
  };
}

function eventFilterGroupView(state: ControlPlaneState, group: EventGroup): EventFilterGroupView {
  const filterState = eventGroupFilterStateInState(state, group);
  return {
    checked: filterState.checked,
    color: group.color,
    id: group.id,
    indeterminate: filterState.indeterminate,
    label: group.label,
    types: eventTypesForGroupInState(state, group).map((type) => ({
      enabled: isEventTypeEnabledInState(state, group, type),
      groupId: group.id,
      type
    }))
  };
}

function eventTypesForGroupInState(state: ControlPlaneState, group: EventGroup): string[] {
  const observed = state.events
    .filter((event) => eventGroupForEvent(event).id === group.id)
    .map((event) => event.type ?? 'unknown');
  const configured = Object.keys(state.eventFilters.types).filter(
    (type) => eventGroupForType(type).id === group.id
  );
  return [...new Set([...group.eventTypes, ...observed, ...configured])].sort();
}

function isEventEnabledInState(state: ControlPlaneState, event: ControlPlaneEvent): boolean {
  const type = event.type ?? '';
  const group = eventGroupForType(type);
  if (group.filterable === false) {
    return true;
  }
  return isEventTypeEnabledInState(state, group, type);
}

function isEventTypeEnabledInState(
  state: ControlPlaneState,
  group: EventGroup,
  type: string
): boolean {
  if (group.filterable === false) {
    return true;
  }
  const stored = state.eventFilters.types[type];
  if (typeof stored === 'boolean') {
    return stored;
  }
  return state.eventFilters.groups[group.id] !== false;
}

function eventGroupFilterStateInState(
  state: ControlPlaneState,
  group: EventGroup
): { checked: boolean; indeterminate: boolean } {
  const types = eventTypesForGroupInState(state, group);
  const enabled = types.filter((type) => isEventTypeEnabledInState(state, group, type)).length;
  return {
    checked: types.length > 0 && enabled === types.length,
    indeterminate: enabled > 0 && enabled < types.length
  };
}

function enabledEventFiltersCountInState(state: ControlPlaneState): number {
  return filterableEventGroups().reduce(
    (count, group) =>
      count +
      eventTypesForGroupInState(state, group).filter((type) =>
        isEventTypeEnabledInState(state, group, type)
      ).length,
    0
  );
}

function defaultEventFilters(): EventFiltersState {
  return {
    groups: Object.fromEntries(EVENT_GROUPS.map((group) => [group.id, true])),
    types: {}
  };
}

function readStoredEventFilters(): EventFiltersState {
  const filters = defaultEventFilters();
  const raw = readStorage(EVENT_FILTER_STORAGE_KEY);
  if (raw === null) {
    return filters;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isPlainRecord(parsed)) {
      return filters;
    }
    if (isPlainRecord(parsed.groups)) {
      for (const group of filterableEventGroups()) {
        const enabled = parsed.groups[group.id];
        if (typeof enabled === 'boolean') {
          filters.groups[group.id] = enabled;
        }
      }
    }
    if (isPlainRecord(parsed.types)) {
      for (const [type, enabled] of Object.entries(parsed.types)) {
        if (typeof enabled === 'boolean' && eventGroupForType(type).filterable !== false) {
          filters.types[type] = enabled;
        }
      }
    }
  } catch {
    return filters;
  }
  return filters;
}

function writeStoredEventFilters(filters: EventFiltersState): void {
  writeStorage(
    EVENT_FILTER_STORAGE_KEY,
    JSON.stringify({
      groups: Object.fromEntries(
        filterableEventGroups().map((group) => [group.id, filters.groups[group.id] !== false])
      ),
      types: Object.fromEntries(
        Object.entries(filters.types).filter(
          ([type]) => eventGroupForType(type).filterable !== false
        )
      )
    })
  );
}

function readStoredEventLimit(): number {
  return normalizeEventLimit(readStorage(EVENT_LIMIT_STORAGE_KEY) ?? DEFAULT_EVENT_LIMIT);
}

function readStoredViewportDays(): number {
  return normalizeViewportDays(
    readStorage(DEFAULT_VIEWPORT_DAYS_STORAGE_KEY) ?? DEFAULT_VIEWPORT_DAYS
  );
}

function readStoredBoolean(key: string, fallback: boolean): boolean {
  const value = readStorage(key);
  if (value === null) {
    return fallback;
  }
  if (value === '1' || value === 'true') {
    return true;
  }
  if (value === '0' || value === 'false') {
    return false;
  }
  return fallback;
}

function readSelectedChatId(): string | null {
  const value = readStorage(SELECTED_CHAT_ID_STORAGE_KEY);
  return value === null || value.length === 0 ? null : value;
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    if (value.length === 0) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, value);
  } catch {
    return;
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function dashboardMetricsFromOverview(overview: HistoryOverview): DashboardMetric[] {
  const activeJob = overview.activeJob;
  return [
    dashboardMetric('Chats', overview.chats ?? 0),
    dashboardMetric('Targets', overview.targets ?? 0),
    dashboardMetric('Coverage intervals', overview.coverageIntervals ?? 0),
    dashboardMetric(
      'Current job',
      activeJob?.status ?? '—',
      activeJob
        ? `${formatOptionalValue(activeJob.chatId)} · ${dashboardShortInterval(activeJob)}`
        : 'idle'
    )
  ];
}

function dashboardMetric(label: string, value: number | string, detail = ''): DashboardMetric {
  return {
    detail,
    label,
    value: formatDashboardMetricValue(value)
  };
}

function formatDashboardMetricValue(value: number | string): string {
  return typeof value === 'number' ? formatDashboardInteger(value) : value;
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat().format(Number.isFinite(value) ? value : 0);
}

function formatDashboardInteger(value: number): string {
  return formatInteger(value);
}

function formatOptionalValue(value: Date | number | string | undefined): string {
  return value === undefined ? '' : String(value);
}

function dashboardShortInterval(interval: {
  endAt?: Date | string;
  startAt?: Date | string;
}): string {
  return `${dashboardShortDate(interval.startAt)} → ${dashboardShortDate(interval.endAt)}`;
}

function dashboardShortDate(value: Date | string | undefined): string {
  const date = value instanceof Date ? value : new Date(value ?? '');
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(5, 16).replace('T', ' ');
}

function formatDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 16).replace('T', ' ');
}

function formatEventTime(value: Date | string | undefined): string {
  const date = value instanceof Date ? value : new Date(value ?? '');
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString();
}
