export const historyPageHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AgenTG History Observatory</title>
  <script src="/history/tailwindcss-browser.js"></script>
  <style>
    * { box-sizing: border-box; }
    body { font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    button, input, select { font: inherit; }
    .timeline-segment {
      position: absolute;
      top: 0;
      bottom: 0;
      min-width: 2px;
    }
    .segment-target { background: rgba(113, 113, 122, .42); z-index: 1; }
    .segment-coverage { background: #10b981; z-index: 3; }
    .segment-coverage.coverage-linked-hover {
      background: #059669;
      box-shadow: inset 0 0 0 2px rgba(6, 78, 59, .42);
      z-index: 5;
    }
    .coverage-table-row.coverage-linked-hover {
      background: #ecfdf5;
    }
    .segment-job-pending { background: rgba(124, 58, 237, .42); z-index: 2; }
    .segment-job-running { background: #7c3aed; z-index: 2; }
    .coverage-gap {
      align-items: center;
      bottom: 0;
      cursor: pointer;
      display: flex;
      justify-content: center;
      position: absolute;
      top: 0;
      z-index: 4;
    }
    .coverage-gap::after {
      align-items: center;
      background: #ffffff;
      border: 1px solid #10b981;
      border-radius: 9999px;
      color: #047857;
      content: '+';
      display: flex;
      font-weight: 700;
      height: 18px;
      justify-content: center;
      line-height: 1;
      opacity: 0;
      transform: scale(.92);
      transition: opacity .08s ease, transform .08s ease;
      width: 18px;
    }
    .coverage-gap:hover,
    .coverage-gap:focus-visible {
      background: rgba(16, 185, 129, .10);
      outline: none;
    }
    .coverage-gap:hover::after,
    .coverage-gap:focus-visible::after {
      opacity: 1;
      transform: scale(1);
    }
  </style>
</head>
<body class="h-screen overflow-hidden bg-zinc-100 text-zinc-950 antialiased">
  <div class="flex h-screen min-h-0 flex-col">
    <header class="shrink-0 bg-zinc-100 px-4 py-3">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="min-w-0">
          <h1 class="truncate text-base font-semibold tracking-normal">AgenTG History Observatory</h1>
          <div class="text-xs text-zinc-500">Targets, reconcile state, backfill jobs, coverage, and history events</div>
        </div>
        <div class="flex flex-wrap items-center justify-end gap-3">
          <div class="flex flex-wrap items-center justify-end gap-2">
            <span id="wsStatus" class="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600"></span>
            <span id="tdlibStatus" class="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600"></span>
          </div>
          <div class="flex flex-wrap items-center justify-end gap-2">
            <button id="toggleDashboardTop" type="button" aria-pressed="true" class="group inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-2.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50" title="Toggle dashboard">
              <span data-preview-trigger class="relative inline-flex h-3.5 w-3.5 items-center justify-center">
                <svg data-action-icon class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3h5v5H3z"/><path d="M12 3h5v5h-5z"/><path d="M3 12h5v5H3z"/><path d="M12 12h5v5h-5z"/></svg>
                <svg data-preview-icon class="absolute hidden h-3.5 w-3.5 group-hover:block" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 10S5.5 5 10 5s7.5 5 7.5 5-3 5-7.5 5-7.5-5-7.5-5Z"/><path d="M10 8.25a1.75 1.75 0 1 1 0 3.5 1.75 1.75 0 0 1 0-3.5Z"/></svg>
              </span>
              <span>Dashboard</span>
            </button>
            <button id="toggleEventsPanelTop" type="button" aria-pressed="true" class="group inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-2.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50" title="Toggle events">
              <span data-preview-trigger class="relative inline-flex h-3.5 w-3.5 items-center justify-center">
                <svg data-action-icon class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h12"/><path d="M4 10h12"/><path d="M4 15h8"/></svg>
                <svg data-preview-icon class="absolute hidden h-3.5 w-3.5 group-hover:block" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 10S5.5 5 10 5s7.5 5 7.5 5-3 5-7.5 5-7.5-5-7.5-5Z"/><path d="M10 8.25a1.75 1.75 0 1 1 0 3.5 1.75 1.75 0 0 1 0-3.5Z"/></svg>
              </span>
              <span>Events</span>
            </button>
          </div>
        </div>
      </div>
    </header>

    <section id="dashboardPanel" class="shrink-0 bg-zinc-100 p-4 pt-0">
      <div id="dashboardMetrics" class="grid grid-cols-4 gap-3"></div>
    </section>

    <main id="mainLayout" class="grid min-h-0 flex-1 grid-cols-[380px_minmax(0,1fr)_400px] gap-4 overflow-hidden bg-zinc-100 p-4 pt-0">
      <aside class="flex min-h-0 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <div class="grid shrink-0 gap-2 border-b border-zinc-200 p-3">
          <div class="relative">
            <input id="chatSearch" class="w-full rounded-lg border border-zinc-300 bg-white py-2 pl-3 pr-9 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" placeholder="Search title or id">
            <button id="chatSearchClear" type="button" aria-label="Clear search" title="Clear search" class="absolute right-2 top-1/2 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-lg leading-none text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">×</button>
          </div>
        </div>
        <div class="grid min-h-0 flex-1 grid-cols-[76px_minmax(0,1fr)] overflow-hidden">
          <nav id="chatFolders" class="min-h-0 overflow-auto bg-slate-800"></nav>
          <div id="chatList" class="min-h-0 overflow-auto"></div>
        </div>
      </aside>

      <section id="workspaceShell" class="flex min-h-0 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <div id="selectedPanel" class="min-h-0 flex-1 overflow-auto"></div>
      </section>

      <aside id="historyEventsPanel" class="flex min-h-0 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <div class="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-200 p-3">
          <div>
            <div class="text-sm font-semibold">Events</div>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <button id="eventFiltersToggle" data-event-filter-toggle type="button" class="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
              <svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5h14"/><path d="M6 10h8"/><path d="M8 15h4"/></svg>
              <span>Filters</span>
              <span data-event-filter-count class="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] leading-none text-zinc-500">0/0</span>
            </button>
            <button id="clearEvents" class="h-8 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium hover:bg-zinc-50">Clear</button>
          </div>
        </div>
        <div id="events" class="min-h-0 flex-1 overflow-auto bg-white"></div>
        <div id="eventFilters" class="hidden min-h-0 flex-1 overflow-auto bg-white"></div>
      </aside>
    </main>
  </div>
  <div id="coverageHoverPanel" class="pointer-events-none fixed left-0 top-0 z-50 hidden max-w-xs rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-black/5">
    <div id="coverageHoverRange" class="whitespace-nowrap font-medium text-zinc-900"></div>
    <div id="coverageHoverCount" class="mt-0.5 text-zinc-500"></div>
  </div>
  <section id="dashboardPreviewPanel" class="fixed left-0 right-0 z-40 hidden bg-zinc-100 p-4 pt-0">
    <div id="dashboardPreviewMetrics" class="grid grid-cols-4 gap-3"></div>
  </section>
  <aside id="historyEventsPreviewPanel" class="fixed z-40 hidden min-h-0 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white">
    <div class="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-200 p-3">
      <div>
        <div class="text-sm font-semibold">Events</div>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <button data-preview-filter-events data-event-filter-toggle type="button" class="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
          <svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5h14"/><path d="M6 10h8"/><path d="M8 15h4"/></svg>
          <span>Filters</span>
          <span data-event-filter-count class="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] leading-none text-zinc-500">0/0</span>
        </button>
        <button data-preview-clear-events class="h-8 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium hover:bg-zinc-50">Clear</button>
      </div>
    </div>
    <div id="eventsPreview" class="min-h-0 flex-1 overflow-auto bg-white"></div>
    <div id="eventFiltersPreview" class="hidden min-h-0 flex-1 overflow-auto bg-white"></div>
  </aside>

  <script>
    const STORAGE_KEYS = {
      chatFilter: 'agentg.history.chatFilter',
      chatListSelection: 'agentg.history.chatListSelection',
      dashboardCollapsed: 'agentg.history.dashboardCollapsed',
      eventFilters: 'agentg.history.eventFilters',
      eventLimit: 'agentg.history.eventLimit',
      eventsPanelCollapsed: 'agentg.history.eventsPanelCollapsed',
      selectedChatId: 'agentg.history.selectedChatId',
      viewportDays: 'agentg.history.viewportDays'
    };

    const DEFAULT_EVENT_LIMIT = 200;
    const MAX_EVENT_LIMIT = 2000;
    const MIN_EVENT_LIMIT = 20;
    const EVENT_GROUPS = [
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

    const initialChatListSelection = readChatListSelection();
    const state = {
      chats: [],
      chatListMode: initialChatListSelection.mode,
      chatNavigation: { archiveCount: 0, folders: [], mainCount: 0 },
      events: [],
      overview: null,
      chatFilter: readStorage(STORAGE_KEYS.chatFilter) ?? '',
      chatFolderId: initialChatListSelection.folderId,
      dashboardCollapsed: readBooleanStorage(STORAGE_KEYS.dashboardCollapsed, false),
      eventFilters: readEventFilters(),
      eventLimit: readEventLimit(),
      eventsPanelMode: 'events',
      eventsPanelCollapsed: readBooleanStorage(STORAGE_KEYS.eventsPanelCollapsed, false),
      selectedChatId: readStorage(STORAGE_KEYS.selectedChatId),
      selectedState: null,
      coverageTableOpen: false,
      renderedSelectedChatId: null,
      socket: null,
      nextId: 1,
      pending: new Map(),
      lastTdlibStatusAt: null,
      tdlibConnected: false,
      tdlibStatusStartedAt: Date.now(),
      tdlibStatusWatchdog: null,
      viewportDays: readNumberStorage(STORAGE_KEYS.viewportDays, 30)
    };

    const $ = (id) => document.getElementById(id);

    function connect() {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(protocol + '//' + location.host + '/' + location.search);
      state.socket = socket;

      socket.addEventListener('open', () => {
        setGatewayStatus('ok', 'Gateway connected');
        refreshAll().catch(showError);
      });
      socket.addEventListener('close', () => {
        setGatewayStatus('bad', 'Gateway disconnected');
        setTimeout(connect, 1000);
      });
      socket.addEventListener('message', (message) => {
        const payload = JSON.parse(message.data);
        if (payload.id !== undefined && state.pending.has(payload.id)) {
          const pending = state.pending.get(payload.id);
          state.pending.delete(payload.id);
          payload.error ? pending.reject(new Error(payload.error.message)) : pending.resolve(payload.result);
          return;
        }
        if (payload.event) {
          receiveEvent(payload.event);
        }
      });
    }

    function rpc(method, params = {}) {
      if (!state.socket || state.socket.readyState !== WebSocket.OPEN) {
        return Promise.reject(new Error('Gateway WebSocket is not connected'));
      }
      const id = state.nextId++;
      state.socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => {
        state.pending.set(id, { resolve, reject });
        setTimeout(() => {
          if (state.pending.has(id)) {
            state.pending.delete(id);
            reject(new Error(method + ' timed out'));
          }
        }, 15000);
      });
    }

    async function refreshAll() {
      await Promise.all([loadOverview(), loadChats()]);
      if (state.selectedChatId) {
        await loadSelectedState();
      } else {
        renderSelected();
      }
    }

    async function loadOverview() {
      state.overview = await rpc('history.getOverview');
      renderOverview();
    }

    async function loadChats() {
      const query = state.chatFilter.trim();
      const params = { query, limit: 200 };
      if (query.length === 0) {
        params.list = state.chatListMode;
        if (state.chatListMode === 'folder') {
          params.folderId = state.chatFolderId;
        }
      }
      const result = await rpc('history.listChats', params);
      state.chats = result.chats;
      state.chatNavigation = result.navigation || { archiveCount: 0, folders: [], mainCount: 0 };
      if (query.length === 0 && state.chatListMode === 'folder' && !chatFolderExists(state.chatFolderId)) {
        state.chatListMode = 'main';
        state.chatFolderId = null;
        writeChatListSelection();
        await loadChats();
        return;
      }
      renderChatFolders();
      renderChats();
    }

    async function loadSelectedState() {
      if (!state.selectedChatId) {
        renderSelected();
        return;
      }
      try {
        state.selectedState = await rpc('history.getChatHistoryState', { chatId: state.selectedChatId });
      } catch (error) {
        if (isNotFoundLikeError(error)) {
          clearSelectedChat();
          renderSelected();
          await loadChats();
          return;
        }
        throw error;
      }
      if (!state.selectedState?.chat) {
        clearSelectedChat();
        renderSelected();
        await loadChats();
        return;
      }
      renderSelected();
    }

    async function addPresetTarget(preset) {
      if (!state.selectedChatId) return;
      await rpc('history.upsertTarget', { chatId: state.selectedChatId, preset });
      await refreshAll();
    }

    async function addCustomTarget() {
      if (!state.selectedChatId) return;
      const start = $('customStart').value.trim();
      const end = $('customEnd').value.trim();
      await rpc('history.upsertTarget', { chatId: state.selectedChatId, start, end });
      await refreshAll();
    }

    async function addCoverageGapTarget(start, end) {
      if (!state.selectedChatId || !start || !end) return;
      await rpc('history.upsertTarget', { chatId: state.selectedChatId, start, end });
      await refreshAll();
    }

    async function deleteTarget(targetId) {
      if (!targetId) return;
      await rpc('history.deleteTarget', { targetId });
      await refreshAll();
    }

    function receiveEvent(event) {
      if (event.type === 'telegram.tdlib.status') {
        receiveTdlibStatus(event);
      }
      if (event.type) {
        pushEvent(event);
      }
      if (event.type && event.type.startsWith('history.')) {
        debounceRefresh();
      }
      if (event.type === 'telegram.chat.updated' || event.type === 'telegram.chat_folders.updated') {
        debounceRefresh();
      }
    }

    function receiveTdlibStatus(event) {
      const connected = event.data?.connected === true;
      state.tdlibConnected = connected;
      state.lastTdlibStatusAt = new Date(event.occurredAt || Date.now());
      updateTdlibStatus();
    }

    let refreshTimer = null;
    function debounceRefresh() {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        refreshAll().catch(showError);
      }, 350);
    }

    function pushLocalEvent(type, data) {
      pushEvent({ type, occurredAt: new Date().toISOString(), data });
    }

    function pushEvent(event) {
      if (!isEventEnabled(event)) {
        return;
      }
      state.events.unshift(event);
      state.events = state.events.slice(0, state.eventLimit);
      renderEvents();
    }

    function renderOverview() {
      const overview = state.overview || {};
      const html = dashboardMetricsHtml(overview);
      $('dashboardMetrics').innerHTML = html;
      $('dashboardPreviewMetrics').innerHTML = html;
    }

    function dashboardMetricsHtml(overview) {
      const activeJob = overview.activeJob;
      return (
        dashboardMetricCard('Chats', overview.chats ?? 0) +
        dashboardMetricCard('Targets', overview.targets ?? 0) +
        dashboardMetricCard('Coverage intervals', overview.coverageIntervals ?? 0) +
        dashboardMetricCard('Current job', activeJob ? activeJob.status : '—', activeJob ? activeJob.chatId + ' · ' + shortInterval(activeJob) : 'idle')
      );
    }

    function dashboardMetricCard(label, value, detail = '') {
      return '<div class="rounded-lg border border-zinc-200 bg-white p-3">' +
        '<div class="text-xs text-zinc-500">' + escapeHtml(label) + '</div>' +
        '<div class="mt-1 truncate text-2xl font-semibold">' + escapeHtml(formatMetricValue(value)) + '</div>' +
        (detail ? '<div class="mt-1 truncate text-xs text-zinc-500">' + escapeHtml(detail) + '</div>' : '') +
      '</div>';
    }

    function formatMetricValue(value) {
      return typeof value === 'number' ? formatInteger(value) : String(value);
    }

    function renderChats() {
      const list = $('chatList');
      const queryActive = state.chatFilter.trim().length > 0;
      const rows = state.chats.map((chat) => {
        const active = chat.id === state.selectedChatId;
        return '<button class="' + chatButtonClass(active) + '" data-chat-id="' + escapeHtml(chat.id) + '">' +
          '<div class="flex min-w-0 items-center justify-between gap-2">' +
            '<div class="flex min-w-0 items-center gap-1.5">' +
              chatTypeIcon(chat) +
              '<div class="min-w-0 truncate font-semibold">' + escapeHtml(chat.title || chat.id) + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">' +
            '<span>targets ' + chat.targets + '</span>' +
            '<span>coverage ' + chat.coverageIntervals + '</span>' +
            '<span>jobs ' + chat.pendingJobs + '/' + chat.runningJobs + '</span>' +
          '</div>' +
        '</button>';
      }).join('');
      const chrome = queryActive ? searchResultsHeader() : chatListChrome();
      const empty = state.chats.length === 0
        ? '<div class="p-6 text-center text-sm text-zinc-500">' + (queryActive ? 'No chats match this search.' : 'No chats in this list.') + '</div>'
        : '';
      list.innerHTML = chrome + rows + empty;
      list.querySelectorAll('[data-open-archive]').forEach((button) => {
        button.addEventListener('click', () => openArchiveChats().catch(showError));
      });
      list.querySelectorAll('[data-open-main]').forEach((button) => {
        button.addEventListener('click', () => openMainChats().catch(showError));
      });
      list.querySelectorAll('[data-chat-id]').forEach((button) => {
        button.addEventListener('click', async () => {
          const chatId = button.getAttribute('data-chat-id');
          if (state.selectedChatId === chatId) {
            clearSelectedChat();
            renderChats();
            renderSelected();
            return;
          }
          state.coverageTableOpen = false;
          state.selectedChatId = chatId;
          writeStorage(STORAGE_KEYS.selectedChatId, state.selectedChatId);
          renderChats();
          await loadSelectedState().catch(showError);
        });
      });
    }

    function renderChatFolders() {
      const nav = $('chatFolders');
      const navigation = state.chatNavigation || { archiveCount: 0, folders: [], mainCount: 0 };
      nav.innerHTML =
        folderButton({
          active: state.chatListMode !== 'folder',
          badge: navigation.mainCount,
          label: 'All',
          title: 'All chats',
          type: 'main'
        }) +
        (navigation.folders || []).map((folder) =>
          folderButton({
            active: state.chatListMode === 'folder' && state.chatFolderId === folder.id,
            badge: folder.count,
            folderId: folder.id,
            label: folder.title || ('#' + folder.id),
            title: folder.title,
            type: 'folder'
          })
        ).join('');
      nav.querySelectorAll('[data-folder-nav]').forEach((button) => {
        button.addEventListener('click', () => {
          if (button.getAttribute('data-folder-nav') === 'main') {
            openMainChats().catch(showError);
            return;
          }
          openFolderChats(Number(button.getAttribute('data-folder-id'))).catch(showError);
        });
      });
    }

    function folderButton(options) {
      const activeClass = options.active
        ? 'bg-sky-500/20 text-sky-200'
        : 'text-slate-300 hover:bg-slate-700/70';
      return '<button class="relative flex min-h-16 w-full flex-col items-center justify-center px-1 py-2 text-center text-[11px] font-medium ' + activeClass + '" data-folder-nav="' + escapeHtml(options.type) + '"' + (options.folderId === undefined ? '' : ' data-folder-id="' + options.folderId + '"') + ' title="' + escapeHtml(options.title) + '">' +
        '<span class="truncate">' + escapeHtml(options.label) + '</span>' +
        (options.badge > 0 ? '<span class="mt-1 rounded-full bg-slate-500 px-1.5 py-0.5 text-[10px] leading-none text-white">' + formatInteger(options.badge) + '</span>' : '') +
      '</button>';
    }

    function searchResultsHeader() {
      return '<div class="border-b border-zinc-100 px-3 py-2 text-xs text-zinc-500">Search results across all chats</div>';
    }

    function chatListChrome() {
      const navigation = state.chatNavigation || { archiveCount: 0 };
      if (state.chatListMode === 'archive') {
        return '<div class="border-b border-zinc-100 p-3">' +
          '<div class="flex items-center justify-between gap-2">' +
            '<div class="min-w-0"><div class="truncate text-sm font-semibold">Archived chats</div><div class="text-xs text-zinc-500">All chats folder</div></div>' +
            '<button data-open-main class="shrink-0 rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium hover:bg-zinc-50">Main</button>' +
          '</div>' +
        '</div>';
      }
      if (state.chatListMode === 'main' && navigation.archiveCount > 0) {
        return '<button data-open-archive class="block w-full border-b border-zinc-100 bg-zinc-50 px-3 py-3 text-left hover:bg-zinc-100">' +
          '<div class="flex min-w-0 items-center justify-between gap-2">' +
            '<div class="min-w-0 truncate font-semibold">Archived chats</div>' +
            '<span class="shrink-0 rounded-full bg-zinc-300 px-2 py-0.5 text-xs font-semibold text-white">' + formatInteger(navigation.archiveCount) + '</span>' +
          '</div>' +
          '<div class="mt-1 text-xs text-zinc-500">Open archive</div>' +
        '</button>';
      }
      return '';
    }

    async function openMainChats() {
      state.chatListMode = 'main';
      state.chatFolderId = null;
      state.chatFilter = '';
      setChatSearchValue('');
      writeStorage(STORAGE_KEYS.chatFilter, '');
      writeChatListSelection();
      await loadChats();
    }

    async function openArchiveChats() {
      state.chatListMode = 'archive';
      state.chatFolderId = null;
      state.chatFilter = '';
      setChatSearchValue('');
      writeStorage(STORAGE_KEYS.chatFilter, '');
      writeChatListSelection({ mode: 'main', folderId: null });
      await loadChats();
    }

    async function openFolderChats(folderId) {
      if (!Number.isSafeInteger(folderId)) return;
      state.chatListMode = 'folder';
      state.chatFolderId = folderId;
      state.chatFilter = '';
      setChatSearchValue('');
      writeStorage(STORAGE_KEYS.chatFilter, '');
      writeChatListSelection();
      await loadChats();
    }

    function chatButtonClass(active) {
      const base = 'block w-full border-b border-zinc-100 px-3 py-3 text-left hover:bg-zinc-50';
      return active ? base + ' bg-teal-50 ring-1 ring-inset ring-teal-200' : base + ' bg-white';
    }

    function chatTypeIcon(chat) {
      if (chat.isBot) {
        return iconSvg(
          'Bot',
          '<path d="M5.5 7.5h7a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3h-7a3 3 0 0 1-3-3v-3a3 3 0 0 1 3-3Z"/><path d="M9 7.5V4.75"/><path d="M6.5 11.25h.01"/><path d="M11.5 11.25h.01"/>'
        );
      }
      if (chat.type === 'channel') {
        return iconSvg(
          'Channel',
          '<path d="M3 10.5 15.5 5v14L3 13.5v-3Z"/><path d="M6.5 14.75 8 19"/>'
        );
      }
      if (chat.type === 'group') {
        return iconSvg(
          'Group',
          '<path d="M8 11.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M14.5 10.5a2.5 2.5 0 1 0 0-5"/><path d="M2.5 18a5.5 5.5 0 0 1 11 0"/><path d="M13.5 13.5A4.5 4.5 0 0 1 18 18"/>'
        );
      }
      if (chat.type === 'secret') {
        return iconSvg(
          'Secret chat',
          '<path d="M5.5 9.5V7a3.5 3.5 0 0 1 7 0v2.5"/><path d="M4.5 9.5h9v7h-9v-7Z"/>'
        );
      }
      return '';
    }

    function iconSvg(label, paths) {
      return '<svg class="h-3.5 w-3.5 shrink-0 text-zinc-700" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="' + escapeHtml(label) + '">' + paths + '</svg>';
    }

    function renderSelected() {
      const shell = $('workspaceShell');
      const panel = $('selectedPanel');
      const data = state.selectedState;
      if (!state.selectedChatId) {
        hideCoverageHoverPanel();
        state.coverageTableOpen = false;
        state.renderedSelectedChatId = null;
        shell.className = 'flex min-h-0 flex-col overflow-hidden';
        panel.innerHTML =
          '<div class="p-8 text-center">' +
            '<div class="mx-auto max-w-xl text-center">' +
              '<div class="text-base font-semibold">No chat selected</div>' +
              '<div class="mt-2 text-sm text-zinc-500">No chat is selected. Use the chat list to inspect one chat, or keep this global workspace open while watching metrics and history events.</div>' +
            '</div>' +
          '</div>';
        return;
      }
      shell.className =
        'flex min-h-0 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white';
      if (!data || !data.chat) {
        hideCoverageHoverPanel();
        state.coverageTableOpen = false;
        state.renderedSelectedChatId = null;
        panel.innerHTML = '<div class="p-8 text-center text-sm text-zinc-500">Selected chat is not available.</div>';
        return;
      }

      if (state.renderedSelectedChatId !== data.chat.id || !$('selectedChatHeader')) {
        state.coverageTableOpen = false;
        panel.innerHTML = renderSelectedShell();
        state.renderedSelectedChatId = data.chat.id;
        bindSelectedShell(panel);
      }

      renderSelectedHeader(data.chat);
      renderTargetManagerInto();
      syncViewportButtons();
      renderTimeline();
    }

    function renderSelectedShell() {
      return (
        '<div class="border-b border-zinc-200 p-4">' +
          '<div class="flex flex-wrap items-stretch justify-between gap-3">' +
            '<div id="selectedChatHeader" class="min-w-0"></div>' +
            '<div class="flex shrink-0 items-center gap-2">' +
              '<button id="closeChat" aria-label="Close chat" title="Close chat" class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-300 bg-white text-lg leading-none text-zinc-600 hover:bg-zinc-50">×</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="grid gap-4 p-4">' +
          '<div id="targetManager"></div>' +
          renderTimelineSection() +
        '</div>'
      );
    }

    function bindSelectedShell(panel) {
      $('closeChat').addEventListener('click', () => {
        clearSelectedChat();
        renderChats();
        renderSelected();
      });
      $('targetManager').addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const customButton = target.closest('#customTarget');
        if (customButton) {
          addCustomTarget().catch(showError);
          return;
        }
        const presetButton = target.closest('[data-preset]');
        if (presetButton) {
          addPresetTarget(presetButton.getAttribute('data-preset')).catch(showError);
          return;
        }
        const deleteButton = target.closest('[data-delete-target]');
        if (deleteButton) {
          deleteTarget(deleteButton.getAttribute('data-delete-target')).catch(showError);
        }
      });
      $('viewportScaleButtons').addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const button = target.closest('[data-viewport-days]');
        if (!button) return;
        state.viewportDays = Number(button.getAttribute('data-viewport-days'));
        writeStorage(STORAGE_KEYS.viewportDays, String(state.viewportDays));
        syncViewportButtons();
        renderTimeline();
      });
    }

    function renderSelectedHeader(chat) {
      $('selectedChatHeader').innerHTML =
        '<div class="truncate text-base font-semibold">' + escapeHtml(chat.title || chat.id) + '</div>' +
        '<div class="mt-1 flex flex-wrap gap-2 text-xs text-zinc-500">' +
          '<code class="rounded bg-zinc-100 px-1.5 py-0.5">' + escapeHtml(chat.id) + '</code>' +
          '<span>' + escapeHtml(chat.type) + '</span>' +
          '<span>' + formatInteger(chat.messageCount || 0) + ' messages</span>' +
          renderHistoryStartBadge(chat) +
        '</div>';
    }

    function renderTargetManagerInto() {
      const container = $('targetManager');
      const signature = 'target-form';
      if (container.dataset.signature === signature) {
        return;
      }
      container.dataset.signature = signature;
      container.innerHTML = renderTargetManager();
    }

    function syncViewportButtons() {
      const container = $('viewportScaleButtons');
      if (!container) return;
      container.querySelectorAll('[data-viewport-days]').forEach((button) => {
        const active = Number(button.getAttribute('data-viewport-days')) === state.viewportDays;
        button.setAttribute('aria-pressed', String(active));
        button.className = active
          ? 'h-7 rounded-lg border border-zinc-800 bg-zinc-800 px-2.5 text-xs font-medium text-white shadow-sm'
          : 'h-7 rounded-lg border border-zinc-300 bg-white px-2.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50';
      });
    }

    function renderTargetManager() {
      return '<section class="grid gap-3">' +
        '<div class="flex flex-wrap items-center justify-between gap-2">' +
          '<div><div class="text-sm font-semibold">Targets</div><div class="text-xs text-zinc-500">Target history coverage for this chat</div></div>' +
          '<div class="flex flex-wrap gap-2">' +
            '<button data-preset="last7d" class="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-zinc-50">Last 7d</button>' +
            '<button data-preset="last30d" class="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-zinc-50">Last 30d</button>' +
            '<button data-preset="full" class="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-zinc-50">Past..now</button>' +
          '</div>' +
        '</div>' +
        '<div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">' +
          '<input id="customStart" class="rounded-lg border border-zinc-300 bg-white px-3 py-2 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" placeholder="Start: past, now-30d, 2026-01-01">' +
          '<input id="customEnd" class="rounded-lg border border-zinc-300 bg-white px-3 py-2 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" placeholder="End: now, 2026-02-01">' +
          '<button id="customTarget" class="rounded-lg border border-zinc-800 bg-zinc-800 px-3 py-2 font-medium text-white hover:bg-zinc-950">Add</button>' +
        '</div>' +
      '</section>';
    }

    function renderHistoryStartBadge(chat) {
      if (chat.historyStartAt) {
        return '<span>history starts ' + escapeHtml(formatDate(chat.historyStartAt)) + '</span>';
      }
      if (chat.historyBeginningReached) {
        return '<span>history beginning reached</span>';
      }
      return '';
    }

    function renderTimelineSection(data) {
      return '<section class="grid gap-3 border-t border-zinc-200 pt-4">' +
        '<div class="flex flex-wrap items-center justify-between gap-2">' +
          '<div class="text-sm font-semibold">History</div>' +
          '<div class="flex flex-wrap items-center gap-2">' +
            '<span class="text-xs text-zinc-500">Scale</span>' +
            '<div id="viewportScaleButtons" class="flex flex-wrap gap-1.5">' +
              viewportScaleButton(7, '7d') +
              viewportScaleButton(30, '30d') +
              viewportScaleButton(90, '90d') +
              viewportScaleButton(365, '1y') +
              viewportScaleButton(0, 'All') +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div id="timeline"></div>' +
      '</section>';
    }

    function viewportScaleButton(value, label) {
      const active = Number(value) === state.viewportDays;
      const className = active
        ? 'h-7 rounded-lg border border-zinc-800 bg-zinc-800 px-2.5 text-xs font-medium text-white shadow-sm'
        : 'h-7 rounded-lg border border-zinc-300 bg-white px-2.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50';
      return '<button type="button" data-viewport-days="' + String(value) + '" aria-pressed="' + String(active) + '" class="' + className + '">' + escapeHtml(label) + '</button>';
    }

    function renderTimeline() {
      const container = $('timeline');
      const data = state.selectedState;
      if (!container || !data) return;
      const bounds = computeTimelineBounds(data);
      if (!bounds) {
        hideCoverageHoverPanel();
        container.innerHTML = '<div class="rounded-lg border border-dashed border-zinc-300 p-5 text-center text-sm text-zinc-500">No timeline intervals yet.</div>';
        return;
      }
      const min = bounds.min;
      const max = bounds.max;
      container.innerHTML =
        '<div class="grid gap-2">' +
          layeredTimelineRow(data, min, max) +
          renderTimelineDateLabels(min, max) +
          renderHistoryDetails(data, min, max) +
        '</div>';
      const coverageToggle = container.querySelector('[data-toggle-coverage-table]');
      if (coverageToggle) {
        coverageToggle.addEventListener('click', () => {
          state.coverageTableOpen = !state.coverageTableOpen;
          renderTimeline();
        });
      }
      bindCoverageHoverPanel(container);
      bindCoverageLinkedHover(container);
      bindCoverageGapTargets(container);
      bindHistoryDetailsActions(container);
      bindTimelineDateDeltas(container);
    }

    function renderTimelineDateLabels(min, max) {
      return '<div class="flex justify-between pl-8 text-xs text-zinc-500">' +
        timelineDateLabel(min, min.getTime() - max.getTime(), 'left') +
        timelineDateLabel(max, max.getTime() - min.getTime(), 'right') +
      '</div>';
    }

    function timelineDateLabel(date, deltaMilliseconds, align) {
      const dateLabel = formatDate(date);
      const deltaLabel = formatSignedDuration(deltaMilliseconds);
      const width = Math.max(dateLabel.length, deltaLabel.length);
      const textAlignClass = align === 'right' ? 'text-right' : 'text-left';
      return '<span class="inline-block cursor-default tabular-nums ' + textAlignClass + '" style="width:' + width + 'ch" data-timeline-date data-date-label="' + escapeHtml(dateLabel) + '" data-date-delta="' + escapeHtml(deltaLabel) + '">' + escapeHtml(dateLabel) + '</span>';
    }

    function computeTimelineBounds(data) {
      const intervals = [
        ...data.desired,
        ...data.coverage,
        ...data.jobs
      ].map(toDates).filter(Boolean);
      if (intervals.length === 0) {
        return null;
      }
      const now = new Date();
      let min = intervals.reduce((acc, interval) => interval.startAt < acc ? interval.startAt : acc, intervals[0].startAt);
      let max = intervals.reduce((acc, interval) => interval.endAt > acc ? interval.endAt : acc, intervals[0].endAt);
      if (state.viewportDays > 0 && now > max) {
        max = now;
      }
      if (state.viewportDays > 0) {
        min = new Date(max.getTime() - state.viewportDays * 86400000);
      }
      if (max <= min) {
        max = new Date(min.getTime() + 86400000);
      }
      return { min, max };
    }

    function layeredTimelineRow(data, min, max) {
      const targetSegments = data.desired
        .map((raw) => renderTimelineSegment(raw, min, max, 'segment-target'))
        .join('');
      const jobSegments = data.jobs
        .map((job) => renderTimelineSegment(job, min, max, job.status === 'running' ? 'segment-job-running' : 'segment-job-pending', jobSegmentTooltip))
        .join('');
      const coverageSegments = visibleCoverageIntervals(data.coverage, min, max)
        .map((interval) => renderCoverageTimelineSegment(interval, min, max))
        .join('');
      const gapSegments = coverageGaps(data.coverage)
        .map((gap) => renderCoverageGap(gap, min, max))
        .join('');
      return timelineTrackRow(coverageLabel(), targetSegments + jobSegments + coverageSegments + gapSegments);
    }

    function timelineTrackRow(labelHtml, segments) {
      return '<div class="flex h-6 items-center gap-2">' +
        '<div class="flex w-6 shrink-0 items-center justify-center">' + labelHtml + '</div>' +
        '<div class="relative h-6 min-w-0 flex-1 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">' + segments + '</div>' +
      '</div>';
    }

    function coverageLabel() {
      return '<button data-toggle-coverage-table class="inline-flex h-4 w-4 items-center justify-center rounded border border-zinc-300 bg-white text-[11px] font-semibold leading-none text-zinc-500 shadow-sm hover:bg-zinc-50 hover:text-zinc-700" aria-label="' + (state.coverageTableOpen ? 'Hide timeline intervals' : 'Show timeline intervals') + '" aria-expanded="' + String(state.coverageTableOpen) + '">' +
        '<svg class="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          (state.coverageTableOpen ? '<path d="M4 6l4 4 4-4"/>' : '<path d="M6 4l4 4-4 4"/>') +
        '</svg>' +
      '</button>';
    }

    function renderHistoryDetails(data, min, max) {
      if (!state.coverageTableOpen) {
        return '';
      }
      const sections = groupHistoryDetailItems(historyDetailItems(data, min, max));
      if (sections.length === 0) {
        return '<div class="mt-3 rounded-lg border border-dashed border-zinc-300 p-4 text-center text-xs text-zinc-500">No history items in the current scale.</div>';
      }

      return '<div class="mt-3 grid gap-3">' + sections.map(renderHistoryDetailSection).join('') + '</div>';
    }

    function historyDetailItems(data, min, max) {
      return [
        ...visibleTargetDetails(data.targets, min, max),
        ...visibleJobDetails(data.jobs, min, max),
        ...visibleCoverageIntervals(data.coverage, min, max).map((interval) => ({
          endAt: interval.endAt,
          item: interval,
          startAt: interval.startAt,
          type: 'coverage'
        }))
      ].sort(compareHistoryDetailItems);
    }

    function visibleTargetDetails(targets, min, max) {
      return targets
        .map((target) => {
          const interval = target.projected ? toDates(target.projected) : null;
          if (!interval || interval.endAt <= min || interval.startAt >= max) return null;
          return {
            endAt: interval.endAt,
            item: target,
            startAt: interval.startAt,
            type: 'target'
          };
        })
        .filter(Boolean);
    }

    function visibleJobDetails(jobs, min, max) {
      return jobs
        .map((job) => {
          const interval = toDates(job);
          if (!interval || interval.endAt <= min || interval.startAt >= max) return null;
          return {
            endAt: interval.endAt,
            item: job,
            startAt: interval.startAt,
            type: 'job'
          };
        })
        .filter(Boolean);
    }

    function compareHistoryDetailItems(left, right) {
      const startDifference = left.startAt.getTime() - right.startAt.getTime();
      if (startDifference !== 0) return startDifference;
      const endDifference = left.endAt.getTime() - right.endAt.getTime();
      if (endDifference !== 0) return endDifference;
      return historyDetailTypeOrder(left.type) - historyDetailTypeOrder(right.type);
    }

    function historyDetailTypeOrder(type) {
      if (type === 'target') return 0;
      if (type === 'job') return 1;
      return 2;
    }

    function groupHistoryDetailItems(items) {
      return items.reduce((sections, item) => {
        const last = sections[sections.length - 1];
        if (!last || last.type !== item.type) {
          sections.push({
            items: [item],
            type: item.type
          });
          return sections;
        }
        last.items.push(item);
        return sections;
      }, []);
    }

    function renderHistoryDetailSection(section) {
      if (section.type === 'target') {
        return renderTargetDetailsTable(section.items.map((item) => item.item));
      }
      if (section.type === 'job') {
        return renderJobDetailsTable(section.items.map((item) => item.item));
      }
      return renderCoverageDetailsTable(section.items.map((item) => item.item));
    }

    function renderTargetDetailsTable(targets) {
      return renderHistoryDetailTableFrame(
        'Target',
        '<div class="overflow-hidden rounded-lg border border-zinc-200">' +
        '<table class="w-full border-collapse text-left text-xs">' +
          '<thead class="bg-zinc-50 text-zinc-500"><tr><th class="px-3 py-2 font-semibold">Target range</th><th class="px-3 py-2 font-semibold">Owner</th><th class="px-3 py-2 font-semibold">Target id</th><th class="w-20 px-3 py-2"></th></tr></thead>' +
          '<tbody class="divide-y divide-zinc-100 bg-white">' +
            targets.map((target) => '<tr>' +
              '<td class="px-3 py-2"><code class="rounded bg-zinc-100 px-1.5 py-0.5">' + escapeHtml(rangeLabel(target.range)) + '</code></td>' +
              '<td class="px-3 py-2 text-zinc-600">' + escapeHtml(target.templateId || 'standalone') + '</td>' +
              '<td class="px-3 py-2"><code class="break-all text-zinc-500">' + escapeHtml(target.id) + '</code></td>' +
              '<td class="px-3 py-2 text-right"><button data-delete-target="' + escapeHtml(target.id) + '" class="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100">Delete</button></td>' +
            '</tr>').join('') +
          '</tbody>' +
        '</table>' +
        '</div>'
      );
    }

    function renderJobDetailsTable(jobs) {
      return renderHistoryDetailTableFrame(
        'Jobs',
        '<div class="overflow-hidden rounded-lg border border-zinc-200">' +
        '<table class="w-full border-collapse text-left text-xs">' +
          '<thead class="bg-zinc-50 text-zinc-500"><tr><th class="px-3 py-2 font-semibold">id</th><th class="px-3 py-2 font-semibold">status</th><th class="px-3 py-2 font-semibold">interval</th><th class="px-3 py-2 font-semibold">cursor</th></tr></thead>' +
          '<tbody class="divide-y divide-zinc-100 bg-white">' +
            jobs.map((job) => '<tr><td class="px-3 py-2"><code>' + escapeHtml(job.id) + '</code></td><td class="px-3 py-2">' + escapeHtml(job.status) + '</td><td class="px-3 py-2 whitespace-nowrap">' + formatPreciseDate(job.startAt) + ' -> ' + formatPreciseDate(job.endAt) + '</td><td class="px-3 py-2">' + (job.cursor ? '<code>yes</code>' : '') + '</td></tr>').join('') +
          '</tbody>' +
        '</table>' +
        '</div>'
      );
    }

    function renderCoverageDetailsTable(intervals) {
      return renderHistoryDetailTableFrame(
        'Coverage',
        '<div class="overflow-hidden rounded-lg border border-zinc-200">' +
        '<table class="w-full border-collapse text-left text-xs">' +
          '<thead class="bg-zinc-50 text-zinc-500"><tr><th class="px-3 py-2 font-semibold">Start</th><th class="px-3 py-2 font-semibold">End</th><th class="px-3 py-2 font-semibold">Duration</th><th class="px-3 py-2 font-semibold">Messages</th></tr></thead>' +
          '<tbody class="divide-y divide-zinc-100 bg-white">' +
            intervals.map((interval) => '<tr class="coverage-table-row" tabindex="0" data-coverage-key="' + escapeHtml(interval.key) + '">' +
              '<td class="px-3 py-2 font-mono text-zinc-700">' + escapeHtml(formatPreciseDate(interval.startAt)) + '</td>' +
              '<td class="px-3 py-2 font-mono text-zinc-700">' + escapeHtml(formatPreciseDate(interval.endAt)) + '</td>' +
              '<td class="px-3 py-2 text-zinc-500">' + escapeHtml(formatDuration(interval.endAt.getTime() - interval.startAt.getTime())) + '</td>' +
              '<td class="px-3 py-2 text-zinc-500">' + escapeHtml(formatInteger(interval.messageCount || 0)) + '</td>' +
            '</tr>').join('') +
          '</tbody>' +
        '</table>' +
        '</div>'
      );
    }

    function renderHistoryDetailTableFrame(title, tableHtml) {
      return '<section class="grid gap-1">' +
        '<div class="text-xs font-semibold text-zinc-500">' + escapeHtml(title) + '</div>' +
        tableHtml +
      '</section>';
    }

    function visibleCoverageIntervals(intervals, min, max) {
      return normalizeIntervals(intervals)
        .filter((interval) => interval.endAt > min && interval.startAt < max)
        .map((interval) => ({
          endAt: interval.endAt < max ? interval.endAt : max,
          key: coverageIntervalKey(interval),
          messageCount: interval.messageCount || 0,
          originalEndAt: interval.endAt,
          originalStartAt: interval.startAt,
          startAt: interval.startAt > min ? interval.startAt : min
        }));
    }

    function renderCoverageTimelineSegment(interval, min, max) {
      const position = timelinePosition(interval, min, max, 0.25);
      const tooltip = coverageSegmentTooltip(interval, interval);
      return '<div class="timeline-segment segment-coverage" style="left:' + position.left + '%;width:' + position.width + '%" tabindex="0" aria-label="' + escapeHtml(tooltip.range + ', ' + tooltip.count) + '" data-coverage-key="' + escapeHtml(interval.key) + '" data-hover-range="' + escapeHtml(tooltip.range) + '" data-hover-count="' + escapeHtml(tooltip.count) + '"></div>';
    }

    function renderTimelineSegment(raw, min, max, className, tooltipFactory) {
      const interval = toDates(raw);
      if (!interval || interval.endAt <= min || interval.startAt >= max) return '';
      const position = timelinePosition(interval, min, max, 0.25);
      const css = typeof className === 'function' ? className(raw) : className;
      const tooltip = tooltipFactory ? tooltipFactory(raw, interval) : null;
      const tooltipAttrs = tooltip
        ? ' tabindex="0" aria-label="' + escapeHtml(tooltip.range + ', ' + tooltip.count) + '" data-hover-range="' + escapeHtml(tooltip.range) + '" data-hover-count="' + escapeHtml(tooltip.count) + '"'
        : '';
      return '<div class="timeline-segment ' + css + '" style="left:' + position.left + '%;width:' + position.width + '%"' + tooltipAttrs + '></div>';
    }

    function renderCoverageGap(gap, min, max) {
      if (gap.endAt <= min || gap.startAt >= max) return '';
      const position = timelinePosition(gap, min, max, 0);
      if (position.width <= 0) return '';
      const label = 'Add target for ' + formatDate(gap.startAt) + ' -> ' + formatDate(gap.endAt);
      return '<button class="coverage-gap" style="left:' + position.left + '%;width:' + position.width + '%" aria-label="' + escapeHtml(label) + '" data-gap-start="' + escapeHtml(gap.startAt.toISOString()) + '" data-gap-end="' + escapeHtml(gap.endAt.toISOString()) + '"></button>';
    }

    function timelinePosition(interval, min, max, minWidth) {
      const start = Math.max(interval.startAt.getTime(), min.getTime());
      const end = Math.min(interval.endAt.getTime(), max.getTime());
      const total = max.getTime() - min.getTime();
      return {
        left: ((start - min.getTime()) / total) * 100,
        width: Math.max(((end - start) / total) * 100, minWidth)
      };
    }

    function coverageGaps(intervals) {
      const normalized = normalizeIntervals(intervals);
      const gaps = [];
      for (let index = 1; index < normalized.length; index += 1) {
        const previous = normalized[index - 1];
        const current = normalized[index];
        if (current.startAt > previous.endAt) {
          gaps.push({
            endAt: current.startAt,
            startAt: previous.endAt
          });
        }
      }
      return gaps;
    }

    function normalizeIntervals(intervals) {
      return intervals
        .map(toDates)
        .filter(Boolean)
        .sort((left, right) => left.startAt.getTime() - right.startAt.getTime())
        .reduce((acc, interval) => {
          const previous = acc[acc.length - 1];
          if (!previous || interval.startAt > previous.endAt) {
            acc.push({
              endAt: interval.endAt,
              messageCount: Number(interval.messageCount || 0),
              startAt: interval.startAt
            });
            return acc;
          }
          if (interval.endAt > previous.endAt) {
            previous.endAt = interval.endAt;
          }
          previous.messageCount = Number(previous.messageCount || 0) + Number(interval.messageCount || 0);
          return acc;
        }, []);
    }

    function coverageSegmentTooltip(raw, interval) {
      return {
        count: formatInteger(raw.messageCount || 0) + ' messages',
        range: formatDate(interval.originalStartAt || interval.startAt) + ' -> ' + formatDate(interval.originalEndAt || interval.endAt)
      };
    }

    function jobSegmentTooltip(job, interval) {
      return {
        count: job.status + ' job #' + job.id,
        range: formatDate(interval.startAt) + ' -> ' + formatDate(interval.endAt)
      };
    }

    function coverageIntervalKey(interval) {
      return interval.startAt.toISOString() + '|' + interval.endAt.toISOString();
    }

    function bindCoverageHoverPanel(container) {
      container.querySelectorAll('[data-hover-range]').forEach((segment) => {
        segment.addEventListener('pointerenter', (event) => {
          showCoverageHoverPanel(segment, event.clientX, event.clientY);
        });
        segment.addEventListener('pointermove', (event) => {
          positionCoverageHoverPanel(event.clientX, event.clientY);
        });
        segment.addEventListener('pointerleave', hideCoverageHoverPanel);
        segment.addEventListener('focus', () => {
          const rect = segment.getBoundingClientRect();
          showCoverageHoverPanel(segment, rect.left + rect.width / 2, rect.bottom);
        });
        segment.addEventListener('blur', hideCoverageHoverPanel);
      });
    }

    function bindCoverageLinkedHover(container) {
      container.querySelectorAll('[data-coverage-key]').forEach((element) => {
        element.addEventListener('pointerenter', () => {
          highlightCoverageKey(container, element.getAttribute('data-coverage-key'));
        });
        element.addEventListener('pointerleave', () => {
          clearCoverageHighlight(container);
        });
        element.addEventListener('focus', () => {
          highlightCoverageKey(container, element.getAttribute('data-coverage-key'));
        });
        element.addEventListener('blur', () => {
          clearCoverageHighlight(container);
        });
      });
    }

    function highlightCoverageKey(container, key) {
      container.querySelectorAll('[data-coverage-key]').forEach((element) => {
        element.classList.toggle('coverage-linked-hover', element.getAttribute('data-coverage-key') === key);
      });
    }

    function clearCoverageHighlight(container) {
      container.querySelectorAll('.coverage-linked-hover').forEach((element) => {
        element.classList.remove('coverage-linked-hover');
      });
    }

    function bindCoverageGapTargets(container) {
      container.querySelectorAll('[data-gap-start][data-gap-end]').forEach((gap) => {
        gap.addEventListener('click', () => {
          addCoverageGapTarget(gap.getAttribute('data-gap-start'), gap.getAttribute('data-gap-end')).catch(showError);
        });
      });
    }

    function bindHistoryDetailsActions(container) {
      container.querySelectorAll('[data-delete-target]').forEach((button) => {
        button.addEventListener('click', () => {
          deleteTarget(button.getAttribute('data-delete-target')).catch(showError);
        });
      });
    }

    function bindTimelineDateDeltas(container) {
      container.querySelectorAll('[data-timeline-date]').forEach((label) => {
        label.addEventListener('pointerenter', () => {
          label.textContent = label.getAttribute('data-date-delta') || '';
        });
        label.addEventListener('pointerleave', () => {
          label.textContent = label.getAttribute('data-date-label') || '';
        });
      });
    }

    function showCoverageHoverPanel(segment, x, y) {
      const panel = $('coverageHoverPanel');
      $('coverageHoverRange').textContent = segment.dataset.hoverRange || '';
      $('coverageHoverCount').textContent = segment.dataset.hoverCount || '';
      panel.classList.remove('hidden');
      positionCoverageHoverPanel(x, y);
    }

    function positionCoverageHoverPanel(x, y) {
      const panel = $('coverageHoverPanel');
      if (panel.classList.contains('hidden')) return;
      const padding = 8;
      const offset = 12;
      let left = x + offset;
      let top = y + offset;
      if (left + panel.offsetWidth > window.innerWidth - padding) {
        left = x - panel.offsetWidth - offset;
      }
      if (top + panel.offsetHeight > window.innerHeight - padding) {
        top = y - panel.offsetHeight - offset;
      }
      panel.style.transform = 'translate(' + Math.max(padding, left) + 'px, ' + Math.max(padding, top) + 'px)';
    }

    function hideCoverageHoverPanel() {
      $('coverageHoverPanel').classList.add('hidden');
    }

    function renderEvents() {
      const containers = [$('events'), $('eventsPreview')];
      const scrollState = captureEventScrollState(containers);
      if (state.events.length === 0) {
        const empty = '<div class="p-6 text-center text-sm text-zinc-500">No events yet.</div>';
        containers.forEach((container) => {
          container.innerHTML = empty;
        });
        restoreEventScrollState(scrollState);
        renderEventFilters();
        return;
      }
      const html = state.events.map((event) => {
        const group = eventGroupForEvent(event);
        return '<div class="relative border-b border-zinc-200 bg-white py-2 pl-4 pr-3 font-mono text-xs leading-relaxed">' +
          '<div class="absolute left-0 top-0 h-full w-1.5" style="background:' + group.color + '"></div>' +
          '<div class="mb-1 flex flex-wrap items-center gap-2">' +
            '<span class="text-zinc-500">' + escapeHtml(formatTime(event.occurredAt)) + '</span>' +
            '<span class="font-semibold text-zinc-900">' + escapeHtml(event.type) + '</span>' +
          '</div>' +
          '<pre class="m-0 whitespace-pre-wrap break-words text-zinc-700">' + escapeHtml(JSON.stringify(event.data || {})) + '</pre>' +
        '</div>';
      }).join('');
      containers.forEach((container) => {
        container.innerHTML = html;
      });
      restoreEventScrollState(scrollState);
      renderEventFilters();
    }

    function captureEventScrollState(containers) {
      return containers.map((container) => ({
        container,
        scrollHeight: container.scrollHeight,
        scrollTop: container.scrollTop,
        stickyTop: container.scrollTop <= 4
      }));
    }

    function restoreEventScrollState(states) {
      states.forEach((state) => {
        if (state.stickyTop) {
          state.container.scrollTop = 0;
          return;
        }
        state.container.scrollTop = state.scrollTop + state.container.scrollHeight - state.scrollHeight;
      });
    }

    function renderEventFilters() {
      const html =
        '<div class="grid gap-3 p-3">' +
          filterableEventGroups().map((group) => renderEventFilterGroup(group)).join('') +
          renderEventLimitControl() +
          '<button data-close-event-filters class="mt-1 h-9 rounded-lg border border-zinc-800 bg-zinc-800 px-3 text-sm font-medium text-white hover:bg-zinc-950">Close Filters</button>' +
        '</div>';
      [$('eventFilters'), $('eventFiltersPreview')].forEach((container) => {
        container.innerHTML = html;
      });
      renderEventFilterControls();
    }

    function renderEventFilterGroup(group) {
      const state = eventGroupFilterState(group);
      const checked = state.checked ? ' checked' : '';
      return '<section class="rounded-lg border border-zinc-200 bg-white p-3">' +
        '<label class="flex cursor-pointer items-center gap-2">' +
          '<input data-event-group-filter="' + escapeHtml(group.id) + '" type="checkbox" class="h-4 w-4 rounded border-zinc-300"' + checked + '>' +
          '<span class="h-3 w-3 rounded-sm" style="background:' + group.color + '"></span>' +
          '<span class="min-w-0 flex-1 text-sm font-semibold">' + escapeHtml(group.label) + '</span>' +
        '</label>' +
        '<div class="mt-2 flex flex-wrap gap-1.5 pl-6">' +
          eventTypesForGroup(group).map((type) => eventTypeLegendChip(group, type)).join('') +
        '</div>' +
      '</section>';
    }

    function renderEventLimitControl() {
      return '<section class="rounded-lg border border-zinc-200 bg-white p-3">' +
        '<label class="grid gap-2">' +
          '<span class="text-sm font-semibold">Event limit</span>' +
          '<input data-event-limit type="number" min="' + MIN_EVENT_LIMIT + '" max="' + MAX_EVENT_LIMIT + '" step="20" value="' + state.eventLimit + '" class="h-9 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100">' +
        '</label>' +
      '</section>';
    }

    function eventTypeLegendChip(group, type) {
      const checked = isEventTypeEnabled(group, type) ? ' checked' : '';
      return '<label class="inline-flex min-w-0 cursor-pointer items-center gap-1 rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600">' +
        '<input data-event-type-filter="' + escapeHtml(type) + '" data-event-type-group="' + escapeHtml(group.id) + '" type="checkbox" class="h-3 w-3 rounded border-zinc-300"' + checked + '>' +
        '<span class="truncate">' + escapeHtml(type) + '</span>' +
      '</label>';
    }

    function eventTypesForGroup(group) {
      const observed = state.events
        .filter((event) => eventGroupForEvent(event).id === group.id)
        .map((event) => String(event.type || 'unknown'));
      const configured = Object.keys(state.eventFilters.types || {}).filter(
        (type) => eventGroupForType(type).id === group.id
      );
      return [...new Set([...group.eventTypes, ...observed, ...configured])].sort();
    }

    function setEventsPanelMode(mode) {
      state.eventsPanelMode = mode === 'filters' ? 'filters' : 'events';
      applyEventsPanelMode();
    }

    function applyEventsPanelMode() {
      const filtersVisible = state.eventsPanelMode === 'filters';
      $('events').classList.toggle('hidden', filtersVisible);
      $('eventsPreview').classList.toggle('hidden', filtersVisible);
      $('eventFilters').classList.toggle('hidden', !filtersVisible);
      $('eventFiltersPreview').classList.toggle('hidden', !filtersVisible);
      renderEventFilterControls();
    }

    function renderEventFilterControls() {
      const enabled = enabledEventFiltersCount();
      document.querySelectorAll('[data-event-filter-count]').forEach((element) => {
        element.textContent = String(enabled);
      });
      document.querySelectorAll('[data-event-filter-toggle]').forEach((button) => {
        const active = state.eventsPanelMode === 'filters';
        button.className = active
          ? 'inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-800 px-2.5 text-sm font-medium text-white hover:bg-zinc-950'
          : 'inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50';
      });
      document.querySelectorAll('[data-event-group-filter]').forEach((input) => {
        if (!(input instanceof HTMLInputElement)) return;
        const group = EVENT_GROUPS.find((item) => item.id === input.getAttribute('data-event-group-filter'));
        if (!group) return;
        const state = eventGroupFilterState(group);
        input.checked = state.checked;
        input.indeterminate = state.indeterminate;
      });
    }

    function setEventGroupEnabled(groupId, enabled) {
      const group = EVENT_GROUPS.find((item) => item.id === groupId);
      if (!group || group.filterable === false) {
        return;
      }
      state.eventFilters.groups[groupId] = enabled;
      for (const type of eventTypesForGroup(group)) {
        state.eventFilters.types[type] = enabled;
      }
      writeEventFilters();
      if (!enabled) {
        state.events = state.events.filter((event) => eventGroupForEvent(event).id !== groupId);
      }
      renderEvents();
      applyEventsPanelMode();
    }

    function setEventTypeEnabled(type, enabled) {
      const group = eventGroupForType(type);
      if (group.filterable === false) {
        return;
      }
      state.eventFilters.types[type] = enabled;
      const groupState = eventGroupFilterState(group);
      state.eventFilters.groups[group.id] = groupState.checked || groupState.indeterminate;
      writeEventFilters();
      if (!enabled) {
        state.events = state.events.filter((event) => String(event.type || '') !== type);
      }
      renderEvents();
      applyEventsPanelMode();
    }

    function setEventLimit(value) {
      state.eventLimit = normalizeEventLimit(value);
      writeStorage(STORAGE_KEYS.eventLimit, String(state.eventLimit));
      state.events = state.events.slice(0, state.eventLimit);
      renderEvents();
      applyEventsPanelMode();
    }

    function normalizeEventLimit(value) {
      const limit = Number(value);
      if (!Number.isFinite(limit)) {
        return DEFAULT_EVENT_LIMIT;
      }
      return Math.min(MAX_EVENT_LIMIT, Math.max(MIN_EVENT_LIMIT, Math.round(limit)));
    }

    function isEventEnabled(event) {
      const type = String(event?.type || '');
      const group = eventGroupForType(type);
      if (group.filterable === false) {
        return true;
      }
      return isEventTypeEnabled(group, type);
    }

    function isEventTypeEnabled(group, type) {
      if (group.filterable === false) {
        return true;
      }
      const stored = state.eventFilters.types?.[type];
      if (typeof stored === 'boolean') {
        return stored;
      }
      return state.eventFilters.groups?.[group.id] !== false;
    }

    function eventGroupFilterState(group) {
      const types = eventTypesForGroup(group);
      const enabled = types.filter((type) => isEventTypeEnabled(group, type)).length;
      return {
        checked: types.length > 0 && enabled === types.length,
        indeterminate: enabled > 0 && enabled < types.length
      };
    }

    function enabledEventFiltersCount() {
      return filterableEventGroups().reduce(
        (count, group) =>
          count + eventTypesForGroup(group).filter((type) => isEventTypeEnabled(group, type)).length,
        0
      );
    }

    function filterableEventGroups() {
      return EVENT_GROUPS.filter((group) => group.filterable !== false);
    }

    function eventGroupForEvent(event) {
      return eventGroupForType(String(event?.type || ''));
    }

    function eventGroupForType(type) {
      return EVENT_GROUPS.find((group) => group.match(type)) || EVENT_GROUPS[EVENT_GROUPS.length - 1];
    }

    function setHistoryEventsCollapsed(collapsed) {
      state.eventsPanelCollapsed = collapsed;
      writeStorage(STORAGE_KEYS.eventsPanelCollapsed, collapsed ? '1' : '0');
      applyHistoryEventsPanelState();
    }

    function setDashboardCollapsed(collapsed) {
      state.dashboardCollapsed = collapsed;
      writeStorage(STORAGE_KEYS.dashboardCollapsed, collapsed ? '1' : '0');
      applyDashboardPanelState();
    }

    function applyDashboardPanelState() {
      const collapsed = state.dashboardCollapsed === true;
      $('dashboardPanel').classList.toggle('hidden', collapsed);
      setHeaderActionButtonState(
        $('toggleDashboardTop'),
        !collapsed,
        collapsed ? 'Show dashboard' : 'Hide dashboard'
      );
      if (!collapsed) {
        hidePreview('dashboardPreviewPanel');
      }
    }

    function applyHistoryEventsPanelState() {
      const collapsed = state.eventsPanelCollapsed === true;
      $('mainLayout').className = collapsed
        ? 'grid min-h-0 flex-1 grid-cols-[380px_minmax(0,1fr)] gap-4 overflow-hidden bg-zinc-100 p-4 pt-0'
        : 'grid min-h-0 flex-1 grid-cols-[380px_minmax(0,1fr)_400px] gap-4 overflow-hidden bg-zinc-100 p-4 pt-0';
      $('historyEventsPanel').classList.toggle('hidden', collapsed);

      const topToggle = $('toggleEventsPanelTop');
      setHeaderActionButtonState(
        topToggle,
        !collapsed,
        collapsed ? 'Show events' : 'Hide events'
      );
      if (!collapsed) {
        hidePreview('historyEventsPreviewPanel', 'flex');
      }
    }

    function setHeaderActionButtonState(button, active, title) {
      button.setAttribute('aria-pressed', String(active));
      button.setAttribute('title', title);
      button.className = active
        ? 'group inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-900 bg-zinc-900 px-2.5 text-xs font-medium text-white shadow-sm hover:bg-zinc-800'
        : 'group inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-2.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50';
      const actionIcon = button.querySelector('[data-action-icon]');
      const previewIcon = button.querySelector('[data-preview-icon]');
      actionIcon?.classList.toggle('group-hover:hidden', !active);
      previewIcon?.classList.toggle('group-hover:block', !active);
    }

    function bindHoverPreview(buttonId, panelId, canShow, positionPanel, displayClass = null) {
      const button = $(buttonId);
      const trigger = button.querySelector('[data-preview-trigger]') || button;
      const panel = $(panelId);
      const show = () => {
        if (canShow()) {
          positionPanel();
          panel.classList.remove('hidden');
          if (displayClass) {
            panel.classList.add(displayClass);
          }
        }
      };
      const hide = () => hidePreview(panelId, displayClass);
      trigger.addEventListener('mouseenter', show);
      trigger.addEventListener('mouseleave', hide);
      button.addEventListener('mouseleave', hide);
      button.addEventListener('blur', hide);
    }

    function hidePreview(panelId, displayClass = null) {
      const panel = $(panelId);
      panel.classList.add('hidden');
      if (displayClass) {
        panel.classList.remove(displayClass);
      }
    }

    function positionDashboardPreview() {
      const headerRect = document.querySelector('header').getBoundingClientRect();
      $('dashboardPreviewPanel').style.top = headerRect.bottom + 'px';
    }

    function positionEventsPreview() {
      const main = $('mainLayout');
      const rect = main.getBoundingClientRect();
      const styles = getComputedStyle(main);
      const paddingTop = parseFloat(styles.paddingTop) || 0;
      const paddingRight = parseFloat(styles.paddingRight) || 0;
      const paddingBottom = parseFloat(styles.paddingBottom) || 0;
      const panel = $('historyEventsPreviewPanel');
      panel.style.top = rect.top + paddingTop + 'px';
      panel.style.right = window.innerWidth - rect.right + paddingRight + 'px';
      panel.style.width = '400px';
      panel.style.height = Math.max(160, rect.height - paddingTop - paddingBottom) + 'px';
    }

    function repositionVisiblePreviews() {
      if (!$('dashboardPreviewPanel').classList.contains('hidden')) {
        positionDashboardPreview();
      }
      if (!$('historyEventsPreviewPanel').classList.contains('hidden')) {
        positionEventsPreview();
      }
    }

    function setGatewayStatus(kind, text) {
      const el = $('wsStatus');
      setStatusBadge(el, kind, text);
    }

    function setTdlibStatus(kind, text) {
      const el = $('tdlibStatus');
      setStatusBadge(el, kind, text);
    }

    function setStatusBadge(el, kind, text) {
      const classes = {
        ok: 'bg-emerald-500',
        warn: 'bg-amber-400',
        bad: 'bg-red-500'
      };
      el.className = 'inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600';
      el.innerHTML =
        '<span class="h-2 w-2 rounded-full ' + (classes[kind] || classes.warn) + '"></span>' +
        '<span>' + escapeHtml(text) + '</span>';
    }

    function updateTdlibStatus() {
      const now = Date.now();
      if (!state.lastTdlibStatusAt) {
        setTdlibStatus(
          now - state.tdlibStatusStartedAt > 15000 ? 'bad' : 'warn',
          now - state.tdlibStatusStartedAt > 15000 ? 'TDLib disconnected' : 'TDLib checking'
        );
        return;
      }

      const age = now - state.lastTdlibStatusAt.getTime();
      if (state.tdlibConnected && age <= 15000) {
        setTdlibStatus('ok', 'TDLib connected');
        return;
      }

      setTdlibStatus('bad', 'TDLib disconnected');
    }

    function startTdlibStatusWatchdog() {
      updateTdlibStatus();
      state.tdlibStatusWatchdog = setInterval(updateTdlibStatus, 1000);
    }

    function showError(error) {
      if (state.selectedChatId && isNotFoundLikeError(error)) {
        clearSelectedChat();
        renderChats();
        renderSelected();
        refreshAll().catch((refreshError) => {
          pushLocalEvent('ui.error', { message: refreshError.message || String(refreshError) });
        });
        return;
      }
      pushLocalEvent('ui.error', { message: error.message || String(error) });
    }

    function clearSelectedChat() {
      state.selectedChatId = null;
      state.selectedState = null;
      state.coverageTableOpen = false;
      state.renderedSelectedChatId = null;
      removeStorage(STORAGE_KEYS.selectedChatId);
    }

    function setChatSearchValue(value) {
      const input = $('chatSearch');
      input.value = value;
      updateChatSearchClear();
    }

    function updateChatSearchClear() {
      const button = $('chatSearchClear');
      const hasValue = $('chatSearch').value.trim().length > 0;
      button.classList.toggle('hidden', !hasValue);
      button.classList.toggle('inline-flex', hasValue);
    }

    function isNotFoundLikeError(error) {
      const message = error?.message || String(error);
      return /not found|not available|unknown chat|данные не найдены/i.test(message);
    }

    function readStorage(key) {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    }

    function readNumberStorage(key, fallback) {
      const value = Number(readStorage(key));
      return Number.isFinite(value) ? value : fallback;
    }

    function readBooleanStorage(key, fallback) {
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

    function readEventFilters() {
      const filters = {
        groups: Object.fromEntries(EVENT_GROUPS.map((group) => [group.id, true])),
        types: {}
      };
      const raw = readStorage(STORAGE_KEYS.eventFilters);
      if (!raw) {
        return filters;
      }
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const group of filterableEventGroups()) {
            filters.groups[group.id] = parsed.includes(group.id);
          }
          return filters;
        }
        if (parsed && typeof parsed === 'object') {
          if (parsed.groups && typeof parsed.groups === 'object') {
            for (const group of filterableEventGroups()) {
              if (typeof parsed.groups[group.id] === 'boolean') {
                filters.groups[group.id] = parsed.groups[group.id];
              }
            }
          }
          if (parsed.types && typeof parsed.types === 'object') {
            for (const [type, enabled] of Object.entries(parsed.types)) {
              if (typeof enabled === 'boolean' && eventGroupForType(type).filterable !== false) {
                filters.types[type] = enabled;
              }
            }
            return filters;
          }
          for (const group of filterableEventGroups()) {
            if (typeof parsed[group.id] === 'boolean') {
              filters.groups[group.id] = parsed[group.id];
            }
          }
        }
      } catch {
      }
      return filters;
    }

    function readEventLimit() {
      return normalizeEventLimit(readStorage(STORAGE_KEYS.eventLimit) ?? DEFAULT_EVENT_LIMIT);
    }

    function writeEventFilters() {
      const filters = {
        groups: Object.fromEntries(
          filterableEventGroups().map((group) => [group.id, state.eventFilters.groups[group.id] !== false])
        ),
        types: Object.fromEntries(
          Object.entries(state.eventFilters.types || {}).filter(
            ([type]) => eventGroupForType(type).filterable !== false
          )
        )
      };
      writeStorage(STORAGE_KEYS.eventFilters, JSON.stringify(filters));
    }

    function readChatListSelection() {
      const raw = readStorage(STORAGE_KEYS.chatListSelection);
      if (!raw) {
        return { folderId: null, mode: 'main' };
      }
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.mode === 'folder' && Number.isSafeInteger(parsed.folderId)) {
          return { folderId: parsed.folderId, mode: 'folder' };
        }
      } catch {
      }
      return { folderId: null, mode: 'main' };
    }

    function writeChatListSelection(selection = state) {
      const mode = selection.mode ?? selection.chatListMode;
      const rawFolderId = selection.folderId ?? selection.chatFolderId;
      const folderId = mode === 'folder' && Number.isSafeInteger(rawFolderId)
        ? rawFolderId
        : null;
      writeStorage(
        STORAGE_KEYS.chatListSelection,
        JSON.stringify(folderId === null ? { mode: 'main' } : { folderId, mode: 'folder' })
      );
    }

    function chatFolderExists(folderId) {
      return Number.isSafeInteger(folderId) &&
        (state.chatNavigation?.folders || []).some((folder) => folder.id === folderId);
    }

    function writeStorage(key, value) {
      try {
        if (value === null || value === undefined || value === '') {
          localStorage.removeItem(key);
        } else {
          localStorage.setItem(key, value);
        }
      } catch {
      }
    }

    function removeStorage(key) {
      try {
        localStorage.removeItem(key);
      } catch {
      }
    }

    function toDates(raw) {
      const startAt = new Date(raw.startAt);
      const endAt = new Date(raw.endAt);
      if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) return null;
      return { ...raw, startAt, endAt };
    }

    function rangeLabel(range) {
      return boundaryLabel(range.start) + ' -> ' + boundaryLabel(range.end);
    }

    function boundaryLabel(boundary) {
      return boundary.kind === 'absolute' ? boundary.at : boundary.expression;
    }

    function formatDate(value) {
      const date = value instanceof Date ? value : new Date(value);
      return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 16).replace('T', ' ');
    }

    function shortInterval(interval) {
      return formatShortDate(interval.startAt) + ' → ' + formatShortDate(interval.endAt);
    }

    function formatShortDate(value) {
      const date = value instanceof Date ? value : new Date(value);
      return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(5, 16).replace('T', ' ');
    }

    function formatInteger(value) {
      return new Intl.NumberFormat().format(Number(value) || 0);
    }

    function formatDuration(milliseconds) {
      const minutes = Math.max(0, Math.round(milliseconds / 60000));
      const days = Math.floor(minutes / 1440);
      const hours = Math.floor((minutes % 1440) / 60);
      const remainingMinutes = minutes % 60;
      const parts = [];
      if (days > 0) parts.push(days + 'd');
      if (hours > 0) parts.push(hours + 'h');
      if (remainingMinutes > 0 || parts.length === 0) parts.push(remainingMinutes + 'm');
      return parts.join(' ');
    }

    function formatSignedDuration(milliseconds) {
      if (milliseconds === 0) {
        return '0m';
      }
      return (milliseconds < 0 ? '-' : '+') + formatDuration(Math.abs(milliseconds));
    }

    function formatPreciseDate(value) {
      const date = value instanceof Date ? value : new Date(value);
      return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 23).replace('T', ' ');
    }

    function formatTime(value) {
      const date = value instanceof Date ? value : new Date(value);
      return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString();
    }

    function escapeHtml(value) {
      return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
    }

    $('clearEvents').addEventListener('click', () => {
      state.events = [];
      renderEvents();
    });
    document.querySelector('[data-preview-clear-events]').addEventListener('click', () => {
      state.events = [];
      renderEvents();
    });
    $('eventFiltersToggle').addEventListener('click', () => {
      setEventsPanelMode(state.eventsPanelMode === 'filters' ? 'events' : 'filters');
    });
    document.querySelector('[data-preview-filter-events]').addEventListener('click', () => {
      setEventsPanelMode(state.eventsPanelMode === 'filters' ? 'events' : 'filters');
    });
    $('toggleDashboardTop').addEventListener('click', () => {
      setDashboardCollapsed(!state.dashboardCollapsed);
    });
    $('toggleEventsPanelTop').addEventListener('click', () => {
      setHistoryEventsCollapsed(!state.eventsPanelCollapsed);
    });
    [$('eventFilters'), $('eventFiltersPreview')].forEach((container) => {
      container.addEventListener('change', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) return;
        if (target.hasAttribute('data-event-limit')) {
          setEventLimit(target.value);
          return;
        }
        const eventType = target.getAttribute('data-event-type-filter');
        if (eventType) {
          setEventTypeEnabled(eventType, target.checked);
          return;
        }
        const groupId = target.getAttribute('data-event-group-filter');
        if (groupId) {
          setEventGroupEnabled(groupId, target.checked);
        }
      });
      container.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (target.closest('[data-close-event-filters]')) {
          setEventsPanelMode('events');
        }
      });
    });
    $('chatSearch').addEventListener('input', () => {
      state.chatFilter = $('chatSearch').value;
      writeStorage(STORAGE_KEYS.chatFilter, state.chatFilter);
      updateChatSearchClear();
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => loadChats().catch(showError), 250);
    });
    $('chatSearchClear').addEventListener('click', () => {
      state.chatFilter = '';
      writeStorage(STORAGE_KEYS.chatFilter, '');
      setChatSearchValue('');
      $('chatSearch').focus();
      clearTimeout(refreshTimer);
      loadChats().catch(showError);
    });
    window.addEventListener('resize', repositionVisiblePreviews);
    setChatSearchValue(state.chatFilter || '');
    bindHoverPreview(
      'toggleDashboardTop',
      'dashboardPreviewPanel',
      () => state.dashboardCollapsed === true,
      positionDashboardPreview
    );
    bindHoverPreview(
      'toggleEventsPanelTop',
      'historyEventsPreviewPanel',
      () => state.eventsPanelCollapsed === true,
      positionEventsPreview,
      'flex'
    );
    applyDashboardPanelState();
    applyHistoryEventsPanelState();
    startTdlibStatusWatchdog();
    renderOverview();
    renderEvents();
    applyEventsPanelMode();
    renderSelected();
    connect();
  </script>
</body>
</html>`;
