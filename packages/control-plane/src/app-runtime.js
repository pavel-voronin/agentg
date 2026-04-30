import { nextTick } from 'vue';

import { controlPlaneStore, useControlPlaneAppView } from './stores/controlPlaneStore.ts';

export { useControlPlaneAppView };

let mountedRuntimeActions = null;

export function addCustomTarget(start, end) {
  runtimeActions().addCustomTarget(start, end);
}

export function addPresetTarget(preset) {
  runtimeActions().addPresetTarget(preset);
}

export function clearChatSearch() {
  runtimeActions().clearChatSearch();
}

export function closeSelectedChat() {
  runtimeActions().closeSelectedChat();
}

export function openArchiveChats() {
  runtimeActions().openArchiveChats();
}

export function openFolderChats(folderId) {
  runtimeActions().openFolderChats(folderId);
}

export function openMainChats() {
  runtimeActions().openMainChats();
}

export function searchChats(value) {
  runtimeActions().searchChats(value);
}

export function selectTimelineScale(value) {
  runtimeActions().selectTimelineScale(value);
}

export function toggleChat(chatId) {
  runtimeActions().toggleChat(chatId);
}

function runtimeActions() {
  if (mountedRuntimeActions === null) {
    throw new Error('Control Plane runtime is not mounted');
  }
  return mountedRuntimeActions;
}

function mountControlPlaneApp(appStore) {
  const STORAGE_KEYS = {
    dashboardCollapsed: 'agentg.controlPlane.dashboardCollapsed',
    eventsPanelCollapsed: 'agentg.controlPlane.eventsPanelCollapsed'
  };

  const DAY_MS = 86400000;
  const TELEGRAM_HISTORY_START_AT = new Date('2013-08-14T00:00:00.000Z');
  const TIMELINE_MIN_WINDOW_MS = 1000;
  const TIMELINE_SELECTION_MIN_PX = 3;
  const TIMELINE_WHEEL_GESTURE_IDLE_MS = 180;
  const TIMELINE_WHEEL_AXIS_INTENT_PX = 8;
  const TIMELINE_WHEEL_AXIS_DOMINANCE = 1.35;

  const state = {
    get chatFilter() {
      return appStore.state.chatFilter;
    },
    get chatFolderId() {
      return appStore.state.chatFolderId;
    },
    get chatListMode() {
      return appStore.state.chatListMode;
    },
    get events() {
      return appStore.state.events;
    },
    set events(value) {
      appStore.setEvents(value);
    },
    get overview() {
      return appStore.state.overview;
    },
    set overview(value) {
      appStore.setOverview(value);
    },
    get selectedChatId() {
      return appStore.state.selectedChatId;
    },
    get selectedState() {
      return appStore.state.selectedHistoryState;
    },
    get defaultViewportDays() {
      return appStore.state.defaultViewportDays;
    },
    set defaultViewportDays(value) {
      appStore.setDefaultViewportDays(value);
    },
    get viewportDays() {
      return appStore.state.viewportDays;
    },
    set viewportDays(value) {
      appStore.setViewportDays(value);
    },
    dashboardCollapsed: readBooleanStorage(STORAGE_KEYS.dashboardCollapsed, false),
    eventsPanelCollapsed: readBooleanStorage(STORAGE_KEYS.eventsPanelCollapsed, false),
    coverageTableOpen: false,
    renderedSelectedChatId: null,
    socket: null,
    nextId: 1,
    pending: new Map(),
    lastTdlibStatusAt: null,
    tdlibConnected: false,
    tdlibStatusStartedAt: Date.now(),
    tdlibStatusWatchdog: null,
    timelineWheelGesture: null,
    timelineViewport: null,
    timelineSelection: null,
    suppressTimelineClick: false
  };

  const $ = (id) => document.getElementById(id);

  function gatewayWebSocketUrl() {
    const configuredUrl = import.meta.env.VITE_AGENT_GATEWAY_WS_URL;
    const url = new URL(
      configuredUrl && configuredUrl.length > 0 ? configuredUrl : 'ws://127.0.0.1:8787/'
    );
    if (url.search.length === 0) {
      url.search = location.search;
    }
    return url.toString();
  }

  function connect() {
    const socket = new WebSocket(gatewayWebSocketUrl());
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
        payload.error
          ? pending.reject(new Error(payload.error.message))
          : pending.resolve(payload.result);
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
    appStore.setChatListData({
      chats: result.chats,
      navigation: result.navigation || { archiveCount: 0, folders: [], mainCount: 0 }
    });
    if (
      query.length === 0 &&
      state.chatListMode === 'folder' &&
      !appStore.hasChatFolder(state.chatFolderId)
    ) {
      appStore.selectMainChatList();
      await loadChats();
      return;
    }
  }

  async function loadSelectedState() {
    if (!state.selectedChatId) {
      renderSelected();
      return;
    }
    appStore.markSelectedHistoryLoading();
    try {
      appStore.setSelectedHistoryState(
        await rpc('history.getChatHistoryState', {
          chatId: state.selectedChatId
        })
      );
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
    ensureTimelineViewport(state.selectedState);
    renderSelected();
  }

  async function upsertPresetTarget(preset) {
    if (!state.selectedChatId) return;
    await rpc('history.upsertTarget', { chatId: state.selectedChatId, preset });
    await refreshAll();
  }

  async function upsertCustomTarget(start, end) {
    if (!state.selectedChatId) return;
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
    if (!appStore.pushEvent(event)) {
      return;
    }
    renderEvents();
  }

  async function openMainChats() {
    appStore.selectMainChatList();
    await loadChats();
  }

  async function openArchiveChats() {
    appStore.selectArchiveChatList();
    await loadChats();
  }

  async function openFolderChats(folderId) {
    if (!Number.isSafeInteger(folderId)) return;
    appStore.selectFolderChatList(folderId);
    await loadChats();
  }

  async function toggleChat(chatId) {
    if (state.selectedChatId === chatId) {
      clearSelectedChat();
      renderSelected();
      return;
    }
    state.coverageTableOpen = false;
    state.viewportDays = state.defaultViewportDays;
    state.timelineViewport = null;
    appStore.selectChat(chatId);
    await loadSelectedState();
  }

  function searchChats(value) {
    appStore.setChatFilter(value);
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => loadChats().catch(showError), 250);
  }

  function clearChatSearch() {
    appStore.clearChatFilter();
    clearTimeout(refreshTimer);
    loadChats().catch(showError);
  }

  function closeSelectedChat() {
    clearSelectedChat();
    renderSelected();
  }

  function selectTimelineScale(nextViewportDays) {
    if (state.viewportDays === nextViewportDays) {
      state.defaultViewportDays = nextViewportDays;
    }
    state.viewportDays = nextViewportDays;
    resetTimelineViewportToPreset();
    renderTimeline();
  }

  function renderSelected() {
    const data = state.selectedState;
    if (!state.selectedChatId) {
      hideCoverageHoverPanel();
      state.coverageTableOpen = false;
      state.renderedSelectedChatId = null;
      return;
    }
    if (!data || !data.chat) {
      hideCoverageHoverPanel();
      state.coverageTableOpen = false;
      state.renderedSelectedChatId = null;
      appStore.setSelectedHistoryUnavailable();
      return;
    }

    if (state.renderedSelectedChatId !== data.chat.id) {
      state.coverageTableOpen = false;
      state.renderedSelectedChatId = data.chat.id;
    }

    nextTick(() => {
      renderTimeline();
    });
  }

  function renderTimeline() {
    const container = $('timeline');
    const data = state.selectedState;
    if (!container || !data) return;
    const bounds = computeTimelineBounds(data);
    if (!bounds) {
      hideCoverageHoverPanel();
      container.innerHTML =
        '<div class="rounded-lg border border-dashed border-zinc-300 p-5 text-center text-sm text-zinc-500">No timeline intervals yet.</div>';
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
    bindHistoryHoverPanel(container, min, max);
    bindHistoryLinkedHover(container);
    bindCoverageGapTargets(container);
    bindTimelineViewportGestures(container, min, max);
    bindTimelineSelection(container, min, max);
    bindHistoryDetailsActions(container);
    bindTimelineDateDeltas(container);
  }

  function renderTimelineDateLabels(min, max) {
    return (
      '<div class="flex justify-between pl-8 text-xs text-zinc-500">' +
      timelineDateLabel(min, min.getTime() - max.getTime(), 'left') +
      timelineDateLabel(max, max.getTime() - min.getTime(), 'right') +
      '</div>'
    );
  }

  function timelineDateLabel(date, deltaMilliseconds, align) {
    const dateLabel = formatDate(date);
    const deltaLabel = formatSignedDuration(deltaMilliseconds);
    const width = Math.max(dateLabel.length, deltaLabel.length);
    const textAlignClass = align === 'right' ? 'text-right' : 'text-left';
    return (
      '<span class="inline-block cursor-default tabular-nums ' +
      textAlignClass +
      '" style="width:' +
      width +
      'ch" data-timeline-date data-date-label="' +
      escapeHtml(dateLabel) +
      '" data-date-delta="' +
      escapeHtml(deltaLabel) +
      '">' +
      escapeHtml(dateLabel) +
      '</span>'
    );
  }

  function computeTimelineBounds(data) {
    const physical = timelinePhysicalBounds(data);
    ensureTimelineViewport(data);
    const viewport = clampTimelineViewport(state.timelineViewport, physical);
    state.timelineViewport = viewport;
    return {
      max: new Date(viewport.endAt),
      min: new Date(viewport.startAt)
    };
  }

  function timelinePhysicalBounds(data) {
    const now = new Date();
    const historyStart = data.chat?.historyStartAt
      ? new Date(data.chat.historyStartAt)
      : TELEGRAM_HISTORY_START_AT;
    const startAt = Number.isNaN(historyStart.getTime())
      ? TELEGRAM_HISTORY_START_AT.getTime()
      : historyStart.getTime();
    const endAt = now.getTime();
    return {
      endAt,
      startAt: Math.min(startAt, endAt - TIMELINE_MIN_WINDOW_MS)
    };
  }

  function ensureTimelineViewport(data) {
    if (state.viewportDays !== null) {
      resetTimelineViewportToPreset(data);
      return;
    }
    if (state.timelineViewport) {
      state.timelineViewport = clampTimelineViewport(
        state.timelineViewport,
        timelinePhysicalBounds(data)
      );
      return;
    }
    resetTimelineViewportToPreset(data);
  }

  function resetTimelineViewportToPreset(data = state.selectedState) {
    if (!data) return;
    const physical = timelinePhysicalBounds(data);
    const endAt = physical.endAt;
    const startAt = state.viewportDays > 0 ? endAt - state.viewportDays * DAY_MS : physical.startAt;
    state.timelineViewport = clampTimelineViewport({ endAt, startAt }, physical);
  }

  function clampTimelineViewport(viewport, physical) {
    const physicalSpan = physical.endAt - physical.startAt;
    let span = Math.max(TIMELINE_MIN_WINDOW_MS, viewport.endAt - viewport.startAt);
    span = Math.min(span, physicalSpan);
    let startAt = viewport.startAt;
    let endAt = startAt + span;
    if (endAt > physical.endAt) {
      endAt = physical.endAt;
      startAt = endAt - span;
    }
    if (startAt < physical.startAt) {
      startAt = physical.startAt;
      endAt = startAt + span;
    }
    return { endAt, startAt };
  }

  function layeredTimelineRow(data, min, max) {
    const targetDetails = visibleTargetDetails(data.targets, min, max);
    const targetSegments =
      renderTargetUnionTimelineSegments(targetDetails, min, max) +
      renderTargetHighlightTimelineSegments(targetDetails, min, max);
    const jobSegments = data.jobs.map((job) => renderJobTimelineSegment(job, min, max)).join('');
    const coverageSegments = visibleCoverageIntervals(data.coverage, min, max)
      .map((interval) => renderCoverageTimelineSegment(interval, min, max))
      .join('');
    const gapSegments = timelineEmptyGaps(data, targetDetails, min, max)
      .map((gap) => renderCoverageGap(gap, min, max))
      .join('');
    return timelineTrackRow(
      coverageLabel(),
      targetSegments + jobSegments + coverageSegments + gapSegments
    );
  }

  function timelineTrackRow(labelHtml, segments) {
    return (
      '<div class="flex h-12 items-center gap-2">' +
      '<div class="flex w-6 shrink-0 items-center justify-center">' +
      labelHtml +
      '</div>' +
      '<div class="relative h-12 min-w-0 flex-1 touch-none select-none overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100" data-timeline-track>' +
      segments +
      '<div class="timeline-selection" data-timeline-selection></div></div>' +
      '</div>'
    );
  }

  function coverageLabel() {
    return (
      '<button data-toggle-coverage-table class="inline-flex h-4 w-4 items-center justify-center rounded border border-zinc-300 bg-white text-[11px] font-semibold leading-none text-zinc-500 shadow-sm hover:bg-zinc-50 hover:text-zinc-700" aria-label="' +
      (state.coverageTableOpen ? 'Hide timeline intervals' : 'Show timeline intervals') +
      '" aria-expanded="' +
      String(state.coverageTableOpen) +
      '">' +
      '<svg class="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (state.coverageTableOpen ? '<path d="M4 6l4 4 4-4"/>' : '<path d="M6 4l4 4-4 4"/>') +
      '</svg>' +
      '</button>'
    );
  }

  function renderHistoryDetails(data, min, max) {
    if (!state.coverageTableOpen) {
      return '';
    }
    const sections = groupHistoryDetailItems(historyDetailItems(data, min, max));
    if (sections.length === 0) {
      return '<div class="mt-3 rounded-lg border border-dashed border-zinc-300 p-4 text-center text-xs text-zinc-500">No history items in the current scale.</div>';
    }

    return (
      '<div class="mt-3 grid gap-3">' + sections.map(renderHistoryDetailSection).join('') + '</div>'
    );
  }

  function historyDetailItems(data, min, max) {
    return [
      ...visibleTargetDetails(data.targets, min, max),
      ...visibleJobDetails(data.jobs, min, max),
      ...visibleCoverageIntervals(data.coverage, min, max).map((interval) => ({
        endAt: interval.endAt,
        item: interval,
        key: interval.key,
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
          key: targetKey(target),
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
          key: jobKey(job),
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
      return renderTargetDetailsTable(section.items);
    }
    if (section.type === 'job') {
      return renderJobDetailsTable(section.items);
    }
    return renderCoverageDetailsTable(section.items.map((item) => item.item));
  }

  function renderTargetDetailsTable(targets) {
    return renderHistoryDetailTableFrame(
      'Target',
      '<div class="overflow-hidden rounded-lg border border-zinc-200">' +
        '<table class="w-full border-collapse text-left text-xs">' +
        '<thead class="bg-zinc-50 text-zinc-500"><tr><th class="px-3 py-2 font-semibold">Start</th><th class="px-3 py-2 font-semibold">End</th><th class="px-3 py-2 font-semibold">Duration</th><th class="px-3 py-2 font-semibold">Template</th><th class="px-3 py-2 font-semibold">Target id</th><th class="w-20 px-3 py-2"></th></tr></thead>' +
        '<tbody class="divide-y divide-zinc-100 bg-white">' +
        targets
          .map((detail) => {
            const target = detail.item;
            return (
              '<tr class="timeline-table-row" tabindex="0" data-timeline-kind="target" data-timeline-key="' +
              escapeHtml(detail.key) +
              '">' +
              '<td class="px-3 py-2 font-mono text-zinc-700">' +
              escapeHtml(formatTimelineDate(detail.startAt)) +
              '</td>' +
              '<td class="px-3 py-2 font-mono text-zinc-700">' +
              escapeHtml(formatTimelineDate(detail.endAt)) +
              '</td>' +
              '<td class="px-3 py-2 text-zinc-500">' +
              escapeHtml(formatDuration(detail.endAt.getTime() - detail.startAt.getTime())) +
              '</td>' +
              '<td class="px-3 py-2 text-zinc-600">' +
              escapeHtml(target.templateId || '-') +
              '</td>' +
              '<td class="px-3 py-2"><code class="break-all text-zinc-500">' +
              escapeHtml(target.id) +
              '</code></td>' +
              '<td class="px-3 py-1 text-right"><button data-delete-target="' +
              escapeHtml(target.id) +
              '" class="rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium leading-5 text-red-700 hover:bg-red-100">Delete</button></td>' +
              '</tr>'
            );
          })
          .join('') +
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
        '<thead class="bg-zinc-50 text-zinc-500"><tr><th class="px-3 py-2 font-semibold">Start</th><th class="px-3 py-2 font-semibold">End</th><th class="px-3 py-2 font-semibold">Duration</th><th class="px-3 py-2 font-semibold">Status</th><th class="px-3 py-2 font-semibold">id</th><th class="px-3 py-2 font-semibold">cursor</th></tr></thead>' +
        '<tbody class="divide-y divide-zinc-100 bg-white">' +
        jobs
          .map((detail) => {
            const job = detail.item;
            return (
              '<tr class="timeline-table-row" tabindex="0" data-timeline-kind="job" data-timeline-key="' +
              escapeHtml(detail.key) +
              '">' +
              '<td class="px-3 py-2 font-mono text-zinc-700">' +
              escapeHtml(formatTimelineDate(detail.startAt)) +
              '</td>' +
              '<td class="px-3 py-2 font-mono text-zinc-700">' +
              escapeHtml(formatTimelineDate(detail.endAt)) +
              '</td>' +
              '<td class="px-3 py-2 text-zinc-500">' +
              escapeHtml(formatDuration(detail.endAt.getTime() - detail.startAt.getTime())) +
              '</td>' +
              '<td class="px-3 py-2 text-zinc-600">' +
              escapeHtml(job.status) +
              '</td>' +
              '<td class="px-3 py-2"><code class="break-all text-zinc-500">' +
              escapeHtml(job.id) +
              '</code></td>' +
              '<td class="px-3 py-2">' +
              (job.cursor ? '<code>yes</code>' : '') +
              '</td>' +
              '</tr>'
            );
          })
          .join('') +
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
        intervals
          .map(
            (interval) =>
              '<tr class="timeline-table-row coverage-table-row" tabindex="0" data-timeline-kind="coverage" data-timeline-key="' +
              escapeHtml(interval.key) +
              '" data-coverage-key="' +
              escapeHtml(interval.key) +
              '">' +
              '<td class="px-3 py-2 font-mono text-zinc-700">' +
              escapeHtml(formatTimelineDate(interval.startAt)) +
              '</td>' +
              '<td class="px-3 py-2 font-mono text-zinc-700">' +
              escapeHtml(formatTimelineDate(interval.endAt)) +
              '</td>' +
              '<td class="px-3 py-2 text-zinc-500">' +
              escapeHtml(formatDuration(interval.endAt.getTime() - interval.startAt.getTime())) +
              '</td>' +
              '<td class="px-3 py-2 text-zinc-500">' +
              escapeHtml(formatInteger(interval.messageCount || 0)) +
              '</td>' +
              '</tr>'
          )
          .join('') +
        '</tbody>' +
        '</table>' +
        '</div>'
    );
  }

  function renderHistoryDetailTableFrame(title, tableHtml) {
    return (
      '<section class="grid gap-1">' +
      '<div class="text-xs font-semibold text-zinc-500">' +
      escapeHtml(title) +
      '</div>' +
      tableHtml +
      '</section>'
    );
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
    return (
      '<div class="timeline-segment segment-coverage" style="left:' +
      position.left +
      '%;width:' +
      position.width +
      '%" tabindex="0" aria-label="' +
      escapeHtml(tooltip.range + ', ' + tooltip.count) +
      '" data-timeline-kind="coverage" data-timeline-key="' +
      escapeHtml(interval.key) +
      '" data-coverage-key="' +
      escapeHtml(interval.key) +
      '" data-hover-from="' +
      escapeHtml(tooltip.from) +
      '" data-hover-to="' +
      escapeHtml(tooltip.to) +
      '" data-hover-duration="' +
      escapeHtml(tooltip.duration) +
      '" data-hover-messages="' +
      escapeHtml(tooltip.count) +
      '"></div>'
    );
  }

  function renderTargetUnionTimelineSegments(details, min, max) {
    return mergeHistoryDetailsForDisplay(details)
      .map((interval) => {
        const position = timelinePosition(interval, min, max, 0.25);
        return (
          '<div class="timeline-segment segment-target" style="left:' +
          position.left +
          '%;width:' +
          position.width +
          '%"></div>'
        );
      })
      .join('');
  }

  function renderTargetHighlightTimelineSegments(details, min, max) {
    return partitionTargetDetailsForDisplay(details)
      .map((interval) => {
        const position = timelinePosition(interval, min, max, 0);
        if (position.width <= 0) return '';
        return (
          '<div class="timeline-segment segment-target-highlight" style="left:' +
          position.left +
          '%;width:' +
          position.width +
          '%" data-timeline-keys="' +
          escapeHtml(interval.keys.join('|')) +
          '"></div>'
        );
      })
      .join('');
  }

  function mergeHistoryDetailsForDisplay(details) {
    return details
      .map((detail) => ({ endAt: detail.endAt, startAt: detail.startAt }))
      .sort((left, right) => left.startAt.getTime() - right.startAt.getTime())
      .reduce((merged, interval) => {
        const previous = merged[merged.length - 1];
        if (!previous || interval.startAt > previous.endAt) {
          merged.push({ ...interval });
          return merged;
        }
        if (interval.endAt > previous.endAt) {
          previous.endAt = interval.endAt;
        }
        return merged;
      }, []);
  }

  function partitionTargetDetailsForDisplay(details) {
    const points = [
      ...new Set(details.flatMap((detail) => [detail.startAt.getTime(), detail.endAt.getTime()]))
    ].sort((left, right) => left - right);
    const partitions = [];
    for (let index = 1; index < points.length; index += 1) {
      const startAt = points[index - 1];
      const endAt = points[index];
      if (startAt === undefined || endAt === undefined || startAt >= endAt) continue;
      const keys = details
        .filter((detail) => detail.startAt.getTime() < endAt && detail.endAt.getTime() > startAt)
        .map((detail) => detail.key);
      if (keys.length === 0) continue;
      partitions.push({
        endAt: new Date(endAt),
        keys,
        startAt: new Date(startAt)
      });
    }
    return partitions;
  }

  function renderJobTimelineSegment(job, min, max) {
    const interval = toDates(job);
    if (!interval || interval.endAt <= min || interval.startAt >= max) return '';
    const position = timelinePosition(interval, min, max, 0.25);
    const tooltip = jobSegmentTooltip(job, interval);
    return (
      '<div class="timeline-segment ' +
      (job.status === 'running' ? 'segment-job-running' : 'segment-job-pending') +
      '" style="left:' +
      position.left +
      '%;width:' +
      position.width +
      '%" tabindex="0" aria-label="' +
      escapeHtml(tooltip.range + ', ' + tooltip.count) +
      '" data-timeline-kind="job" data-timeline-key="' +
      escapeHtml(jobKey(job)) +
      '" data-hover-from="' +
      escapeHtml(tooltip.from) +
      '" data-hover-to="' +
      escapeHtml(tooltip.to) +
      '" data-hover-duration="' +
      escapeHtml(tooltip.duration) +
      '" data-hover-extra="' +
      escapeHtml(tooltip.count) +
      '"></div>'
    );
  }

  function renderTimelineSegment(raw, min, max, className, tooltipFactory) {
    const interval = toDates(raw);
    if (!interval || interval.endAt <= min || interval.startAt >= max) return '';
    const position = timelinePosition(interval, min, max, 0.25);
    const css = typeof className === 'function' ? className(raw) : className;
    const tooltip = tooltipFactory ? tooltipFactory(raw, interval) : null;
    const tooltipAttrs = tooltip
      ? ' tabindex="0" aria-label="' +
        escapeHtml(tooltip.range + ', ' + tooltip.count) +
        '" data-hover-range="' +
        escapeHtml(tooltip.range) +
        '" data-hover-count="' +
        escapeHtml(tooltip.count) +
        '"'
      : '';
    return (
      '<div class="timeline-segment ' +
      css +
      '" style="left:' +
      position.left +
      '%;width:' +
      position.width +
      '%"' +
      tooltipAttrs +
      '></div>'
    );
  }

  function renderCoverageGap(gap, min, max) {
    if (gap.endAt <= min || gap.startAt >= max) return '';
    const position = timelinePosition(gap, min, max, 0);
    if (position.width <= 0) return '';
    const label = 'Add target for ' + formatDate(gap.startAt) + ' -> ' + formatDate(gap.endAt);
    return (
      '<button class="coverage-gap" style="left:' +
      position.left +
      '%;width:' +
      position.width +
      '%" aria-label="' +
      escapeHtml(label) +
      '" data-gap-start="' +
      escapeHtml(gap.startAt.toISOString()) +
      '" data-gap-end="' +
      escapeHtml(gap.endAt.toISOString()) +
      '"></button>'
    );
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

  function timelineEmptyGaps(data, targetDetails, min, max) {
    const blocks = [
      ...visibleCoverageIntervals(data.coverage, min, max),
      ...targetDetails,
      ...visibleJobDetails(data.jobs, min, max)
    ];
    const normalized = normalizeIntervals(blocks);
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
        previous.messageCount =
          Number(previous.messageCount || 0) + Number(interval.messageCount || 0);
        return acc;
      }, []);
  }

  function coverageSegmentTooltip(raw, interval) {
    const startAt = interval.originalStartAt || interval.startAt;
    const endAt = interval.originalEndAt || interval.endAt;
    return {
      count: formatInteger(raw.messageCount || 0) + ' messages',
      duration: formatDuration(endAt.getTime() - startAt.getTime()),
      from: formatTimelineDate(startAt),
      kind: 'Coverage',
      range: formatTimelineDate(startAt) + ' -> ' + formatTimelineDate(endAt),
      to: formatTimelineDate(endAt)
    };
  }

  function targetSegmentTooltip(target, interval) {
    return {
      duration: formatDuration(interval.endAt.getTime() - interval.startAt.getTime()),
      from: formatTimelineDate(interval.startAt),
      kind: 'Target',
      range: formatTimelineDate(interval.startAt) + ' -> ' + formatTimelineDate(interval.endAt),
      to: formatTimelineDate(interval.endAt)
    };
  }

  function jobSegmentTooltip(job, interval) {
    return {
      count: job.status + ' job #' + job.id,
      duration: formatDuration(interval.endAt.getTime() - interval.startAt.getTime()),
      from: formatTimelineDate(interval.startAt),
      kind: 'Job',
      range: formatTimelineDate(interval.startAt) + ' -> ' + formatTimelineDate(interval.endAt),
      to: formatTimelineDate(interval.endAt)
    };
  }

  function coverageIntervalKey(interval) {
    return interval.startAt.toISOString() + '|' + interval.endAt.toISOString();
  }

  function targetKey(target) {
    return target.id;
  }

  function jobKey(job) {
    return job.id;
  }

  function bindHistoryHoverPanel(container, min, max) {
    const track = container.querySelector('[data-timeline-track]');
    if (track) {
      track.addEventListener('pointermove', (event) => {
        if (event.altKey || state.timelineSelection) {
          hideCoverageHoverPanel();
          clearHistoryHighlight(container);
          return;
        }
        const items = historyItemsAtPointer(track, min, max, event.clientX);
        if (items.length === 0) {
          hideCoverageHoverPanel();
          clearHistoryHighlight(container);
          return;
        }
        showHistoryHoverPanel(items, event.clientX, event.clientY);
        highlightHistoryItems(container, items);
      });
      track.addEventListener('pointerleave', () => {
        hideCoverageHoverPanel();
        clearHistoryHighlight(container);
      });
    }
    container.querySelectorAll('[data-hover-range]').forEach((segment) => {
      segment.addEventListener('focus', () => {
        const rect = segment.getBoundingClientRect();
        showHistoryHoverPanel(
          [historyItemFromElement(segment)],
          rect.left + rect.width / 2,
          rect.bottom
        );
        highlightHistoryItems(container, [historyItemFromElement(segment)]);
      });
      segment.addEventListener('blur', () => {
        hideCoverageHoverPanel();
        clearHistoryHighlight(container);
      });
    });
  }

  function historyItemsAtPointer(track, min, max, clientX) {
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return [];
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    const at = min.getTime() + (max.getTime() - min.getTime()) * ratio;
    return historyDetailItems(state.selectedState, min, max)
      .filter((detail) => detail.startAt.getTime() <= at && detail.endAt.getTime() >= at)
      .map(historyHoverItem)
      .sort(compareHistoryHoverItems);
  }

  function historyHoverItem(detail) {
    const tooltip =
      detail.type === 'coverage'
        ? coverageSegmentTooltip(detail.item, detail.item)
        : detail.type === 'target'
          ? targetSegmentTooltip(detail.item, detail)
          : jobSegmentTooltip(detail.item, detail);
    return {
      duration: tooltip.duration,
      extra:
        detail.type === 'coverage' ? tooltip.count : detail.type === 'job' ? tooltip.count : '',
      from: tooltip.from,
      key: detail.key,
      kind: detail.type,
      label: tooltip.kind,
      to: tooltip.to
    };
  }

  function historyItemFromElement(element) {
    return {
      duration: element.getAttribute('data-hover-duration') || '',
      extra:
        element.getAttribute('data-hover-messages') ||
        element.getAttribute('data-hover-extra') ||
        '',
      from: element.getAttribute('data-hover-from') || '',
      key: element.getAttribute('data-timeline-key') || '',
      kind: element.getAttribute('data-timeline-kind') || '',
      label: historyKindLabel(element.getAttribute('data-timeline-kind') || ''),
      to: element.getAttribute('data-hover-to') || ''
    };
  }

  function compareHistoryHoverItems(left, right) {
    return historyHoverTypeOrder(left.kind) - historyHoverTypeOrder(right.kind);
  }

  function historyHoverTypeOrder(kind) {
    if (kind === 'coverage') return 0;
    if (kind === 'target') return 1;
    if (kind === 'job') return 2;
    return 3;
  }

  function historyKindLabel(kind) {
    if (kind === 'target') return 'Target';
    if (kind === 'job') return 'Job';
    return 'Coverage';
  }

  function bindHistoryLinkedHover(container) {
    container.querySelectorAll('[data-timeline-key]').forEach((element) => {
      element.addEventListener('pointerenter', (event) => {
        if (event.altKey) return;
        highlightHistoryItems(container, [historyItemFromElement(element)]);
      });
      element.addEventListener('pointerleave', () => {
        clearHistoryHighlight(container);
      });
      element.addEventListener('focus', () => {
        highlightHistoryItems(container, [historyItemFromElement(element)]);
      });
      element.addEventListener('blur', () => {
        clearHistoryHighlight(container);
      });
    });
  }

  function highlightHistoryItems(container, items) {
    const keys = new Set(items.map((item) => item.key));
    container.querySelectorAll('[data-timeline-key]').forEach((element) => {
      const active = keys.has(element.getAttribute('data-timeline-key'));
      element.classList.toggle('timeline-linked-hover', active);
      element.classList.toggle(
        'coverage-linked-hover',
        active && element.hasAttribute('data-coverage-key')
      );
    });
    container.querySelectorAll('[data-timeline-keys]').forEach((element) => {
      const elementKeys = (element.getAttribute('data-timeline-keys') || '').split('|');
      element.classList.toggle(
        'timeline-linked-hover',
        elementKeys.some((key) => keys.has(key))
      );
    });
  }

  function clearHistoryHighlight(container) {
    container.querySelectorAll('.timeline-linked-hover').forEach((element) => {
      element.classList.remove('timeline-linked-hover');
    });
    container.querySelectorAll('.coverage-linked-hover').forEach((element) => {
      element.classList.remove('coverage-linked-hover');
    });
  }

  function bindCoverageGapTargets(container) {
    container.querySelectorAll('[data-gap-start][data-gap-end]').forEach((gap) => {
      gap.addEventListener('click', (event) => {
        event.preventDefault();
      });
    });
  }

  function bindTimelineViewportGestures(container, min, max) {
    const track = container.querySelector('[data-timeline-track]');
    if (!track) return;
    track.addEventListener(
      'wheel',
      (event) => {
        const axis = timelineWheelGestureAxis(event);
        if (axis === null) {
          event.preventDefault();
          return;
        }
        if (axis === 'vertical') {
          zoomTimelineViewport(event, min, max);
          return;
        }
        panTimelineViewport(event, min, max);
      },
      { passive: false }
    );
  }

  function timelineWheelGestureAxis(event) {
    if (state.timelineWheelGesture?.timeoutId !== undefined) {
      clearTimeout(state.timelineWheelGesture.timeoutId);
    }
    const gesture = state.timelineWheelGesture ?? {
      axis: null,
      deltaX: 0,
      deltaY: 0,
      timeoutId: undefined
    };
    gesture.deltaX += event.deltaX;
    gesture.deltaY += event.deltaY;
    const axis = gesture.axis ?? dominantTimelineWheelAxis(gesture.deltaX, gesture.deltaY);
    state.timelineWheelGesture = {
      axis,
      deltaX: gesture.deltaX,
      deltaY: gesture.deltaY,
      timeoutId: setTimeout(() => {
        state.timelineWheelGesture = null;
      }, TIMELINE_WHEEL_GESTURE_IDLE_MS)
    };
    return axis;
  }

  function dominantTimelineWheelAxis(deltaX, deltaY) {
    const absoluteX = Math.abs(deltaX);
    const absoluteY = Math.abs(deltaY);
    if (Math.max(absoluteX, absoluteY) < TIMELINE_WHEEL_AXIS_INTENT_PX) {
      return null;
    }
    if (absoluteY >= absoluteX * TIMELINE_WHEEL_AXIS_DOMINANCE) {
      return 'vertical';
    }
    if (absoluteX >= absoluteY * TIMELINE_WHEEL_AXIS_DOMINANCE) {
      return 'horizontal';
    }
    return null;
  }

  function zoomTimelineViewport(event, min, max) {
    event.preventDefault();
    const track = event.currentTarget;
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return;
    const physical = timelinePhysicalBounds(state.selectedState);
    const startAt = min.getTime();
    const endAt = max.getTime();
    const span = endAt - startAt;
    const pointerRatio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const anchorAt = startAt + span * pointerRatio;
    const zoomFactor = Math.exp(event.deltaY * 0.002);
    const nextSpan = clamp(
      span * zoomFactor,
      TIMELINE_MIN_WINDOW_MS,
      physical.endAt - physical.startAt
    );
    state.viewportDays = null;
    state.timelineViewport = clampTimelineViewport(
      {
        endAt: anchorAt + nextSpan * (1 - pointerRatio),
        startAt: anchorAt - nextSpan * pointerRatio
      },
      physical
    );
    renderTimeline();
  }

  function panTimelineViewport(event, min, max) {
    event.preventDefault();
    const track = event.currentTarget;
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return;
    const span = max.getTime() - min.getTime();
    const shift = (event.deltaX / rect.width) * span;
    const physical = timelinePhysicalBounds(state.selectedState);
    state.viewportDays = null;
    state.timelineViewport = clampTimelineViewport(
      {
        endAt: max.getTime() + shift,
        startAt: min.getTime() + shift
      },
      physical
    );
    renderTimeline();
  }

  function bindTimelineSelection(container, min, max) {
    const track = container.querySelector('[data-timeline-track]');
    const selection = container.querySelector('[data-timeline-selection]');
    if (!track || !selection) return;
    track.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      if (
        !event.altKey &&
        event.target instanceof Element &&
        event.target.closest('.segment-coverage')
      ) {
        return;
      }
      event.preventDefault();
      hideCoverageHoverPanel();
      clearHistoryHighlight(container);
      const rect = track.getBoundingClientRect();
      const startX = clamp(event.clientX - rect.left, 0, rect.width);
      const gap = event.target instanceof Element ? event.target.closest('.coverage-gap') : null;
      state.timelineSelection = {
        clickGapEnd: gap?.getAttribute('data-gap-end') || null,
        clickGapStart: gap?.getAttribute('data-gap-start') || null,
        maxAt: max.getTime(),
        minAt: min.getTime(),
        pointerId: event.pointerId,
        startX,
        trackWidth: rect.width
      };
      track.setPointerCapture(event.pointerId);
    });
    track.addEventListener('pointermove', (event) => {
      const current = state.timelineSelection;
      if (!current || current.pointerId !== event.pointerId) return;
      const rect = track.getBoundingClientRect();
      const currentX = clamp(event.clientX - rect.left, 0, rect.width);
      if (Math.abs(currentX - current.startX) < TIMELINE_SELECTION_MIN_PX) {
        return;
      }
      updateTimelineSelection(selection, current.startX, currentX);
    });
    track.addEventListener('pointerup', (event) => {
      finishTimelineSelection(track, selection, event);
    });
    track.addEventListener('pointercancel', (event) => {
      cancelTimelineSelection(track, selection, event.pointerId);
    });
    track.addEventListener(
      'click',
      (event) => {
        if (!state.suppressTimelineClick) return;
        event.preventDefault();
        event.stopPropagation();
        state.suppressTimelineClick = false;
      },
      true
    );
  }

  function updateTimelineSelection(selection, startX, currentX) {
    const left = Math.min(startX, currentX);
    const width = Math.abs(currentX - startX);
    selection.style.left = left + 'px';
    selection.style.width = width + 'px';
    selection.classList.add('is-active');
  }

  function finishTimelineSelection(track, selection, event) {
    const current = state.timelineSelection;
    if (!current || current.pointerId !== event.pointerId) return;
    const rect = track.getBoundingClientRect();
    const endX = clamp(event.clientX - rect.left, 0, rect.width);
    const width = Math.abs(endX - current.startX);
    cancelTimelineSelection(track, selection, event.pointerId);
    if (width < TIMELINE_SELECTION_MIN_PX || current.trackWidth <= 0) {
      if (current.clickGapStart && current.clickGapEnd) {
        addCoverageGapTarget(current.clickGapStart, current.clickGapEnd).catch(showError);
      }
      return;
    }
    state.suppressTimelineClick = true;
    setTimeout(() => {
      state.suppressTimelineClick = false;
    }, 250);
    const leftRatio = Math.min(current.startX, endX) / current.trackWidth;
    const rightRatio = Math.max(current.startX, endX) / current.trackWidth;
    const span = current.maxAt - current.minAt;
    const startAt = new Date(current.minAt + span * leftRatio);
    const endAt = new Date(current.minAt + span * rightRatio);
    addCoverageGapTarget(startAt.toISOString(), endAt.toISOString()).catch(showError);
  }

  function cancelTimelineSelection(track, selection, pointerId) {
    if (state.timelineSelection?.pointerId === pointerId) {
      state.timelineSelection = null;
    }
    selection.classList.remove('is-active');
    selection.style.width = '0px';
    try {
      track.releasePointerCapture(pointerId);
    } catch {}
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

  function showHistoryHoverPanel(items, x, y) {
    const panel = $('coverageHoverPanel');
    panel.innerHTML = items.map(renderHistoryHoverPopover).join('');
    panel.classList.remove('hidden');
    positionCoverageHoverPanel(x, y);
  }

  function renderHistoryHoverPopover(item) {
    return (
      '<div class="app-hover-popover">' +
      '<div class="font-semibold text-zinc-900">' +
      escapeHtml(item.label) +
      '</div>' +
      '<div class="mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-0.5">' +
      hoverField('from', item.from) +
      hoverField('to', item.to) +
      hoverField('duration', item.duration) +
      (item.extra ? hoverField(item.kind === 'coverage' ? 'messages' : 'status', item.extra) : '') +
      '</div>' +
      '</div>'
    );
  }

  function hoverField(label, value) {
    return (
      '<div class="text-zinc-400">' +
      escapeHtml(label) +
      '</div>' +
      '<div class="font-mono text-zinc-700">' +
      escapeHtml(value) +
      '</div>'
    );
  }

  function positionCoverageHoverPanel(x, y) {
    const panel = $('coverageHoverPanel');
    if (panel.classList.contains('hidden')) return;
    const padding = 8;
    const offset = 12;
    let left = x + offset;
    let top = y + offset;
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    if (left + width > window.innerWidth - padding) {
      left = x - width - offset;
    }
    if (top + height > window.innerHeight - padding) {
      top = y - height - offset;
    }
    panel.style.transform =
      'translate(' + Math.max(padding, left) + 'px, ' + Math.max(padding, top) + 'px)';
  }

  function hideCoverageHoverPanel() {
    const panel = $('coverageHoverPanel');
    panel.classList.add('hidden');
    panel.innerHTML = '';
  }

  function renderEvents() {
    const containers = [$('events'), $('eventsPreview')];
    const scrollState = captureEventScrollState(containers);
    nextTick(() => {
      restoreEventScrollState(scrollState);
    });
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
      state.container.scrollTop =
        state.scrollTop + state.container.scrollHeight - state.scrollHeight;
    });
  }

  function setEventsPanelCollapsed(collapsed) {
    state.eventsPanelCollapsed = collapsed;
    writeStorage(STORAGE_KEYS.eventsPanelCollapsed, collapsed ? '1' : '0');
    applyEventsPanelState();
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

  function applyEventsPanelState() {
    const collapsed = state.eventsPanelCollapsed === true;
    $('mainLayout').className = collapsed
      ? 'grid min-h-0 flex-1 grid-cols-[380px_minmax(0,1fr)] gap-4 overflow-hidden bg-zinc-100 p-4 pt-0'
      : 'grid min-h-0 flex-1 grid-cols-[380px_minmax(0,1fr)_400px] gap-4 overflow-hidden bg-zinc-100 p-4 pt-0';
    $('eventsPanel').classList.toggle('hidden', collapsed);

    const topToggle = $('toggleEventsPanelTop');
    setHeaderActionButtonState(topToggle, !collapsed, collapsed ? 'Show events' : 'Hide events');
    if (!collapsed) {
      hidePreview('eventsPreviewPanel', 'flex');
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
    const panel = $('eventsPreviewPanel');
    panel.style.top = rect.top + paddingTop + 'px';
    panel.style.right = window.innerWidth - rect.right + paddingRight + 'px';
    panel.style.width = '400px';
    panel.style.height = Math.max(160, rect.height - paddingTop - paddingBottom) + 'px';
  }

  function repositionVisiblePreviews() {
    if (!$('dashboardPreviewPanel').classList.contains('hidden')) {
      positionDashboardPreview();
    }
    if (!$('eventsPreviewPanel').classList.contains('hidden')) {
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
      '<span class="h-2 w-2 rounded-full ' +
      (classes[kind] || classes.warn) +
      '"></span>' +
      '<span>' +
      escapeHtml(text) +
      '</span>';
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
      renderSelected();
      refreshAll().catch((refreshError) => {
        pushLocalEvent('ui.error', { message: refreshError.message || String(refreshError) });
      });
      return;
    }
    pushLocalEvent('ui.error', { message: error.message || String(error) });
  }

  function clearSelectedChat() {
    appStore.clearSelectedChat();
    state.coverageTableOpen = false;
    state.renderedSelectedChatId = null;
    state.timelineSelection = null;
    state.timelineWheelGesture = null;
    state.timelineViewport = null;
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

  function writeStorage(key, value) {
    try {
      if (value === null || value === undefined || value === '') {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, value);
      }
    } catch {}
  }

  function toDates(raw) {
    const startAt = new Date(raw.startAt);
    const endAt = new Date(raw.endAt);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) return null;
    return { ...raw, startAt, endAt };
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
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

  function formatTimelineDate(value) {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 19).replace('T', ' ');
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  mountedRuntimeActions = {
    addCustomTarget(start, end) {
      upsertCustomTarget(start, end).catch(showError);
    },
    addPresetTarget(preset) {
      upsertPresetTarget(preset).catch(showError);
    },
    clearChatSearch,
    closeSelectedChat,
    openArchiveChats() {
      openArchiveChats().catch(showError);
    },
    openFolderChats(folderId) {
      openFolderChats(folderId).catch(showError);
    },
    openMainChats() {
      openMainChats().catch(showError);
    },
    searchChats,
    selectTimelineScale,
    toggleChat(chatId) {
      toggleChat(chatId).catch(showError);
    }
  };

  $('clearEvents').addEventListener('click', () => {
    state.events = [];
    renderEvents();
  });
  document.querySelector('[data-preview-clear-events]').addEventListener('click', () => {
    state.events = [];
    renderEvents();
  });
  $('toggleDashboardTop').addEventListener('click', () => {
    setDashboardCollapsed(!state.dashboardCollapsed);
  });
  $('toggleEventsPanelTop').addEventListener('click', () => {
    setEventsPanelCollapsed(!state.eventsPanelCollapsed);
  });
  window.addEventListener('resize', repositionVisiblePreviews);
  bindHoverPreview(
    'toggleDashboardTop',
    'dashboardPreviewPanel',
    () => state.dashboardCollapsed === true,
    positionDashboardPreview
  );
  bindHoverPreview(
    'toggleEventsPanelTop',
    'eventsPreviewPanel',
    () => state.eventsPanelCollapsed === true,
    positionEventsPreview,
    'flex'
  );
  applyDashboardPanelState();
  applyEventsPanelState();
  startTdlibStatusWatchdog();
  renderEvents();
  renderSelected();
  connect();
}

export function mountControlPlaneAppRuntime() {
  mountControlPlaneApp(controlPlaneStore);
}
