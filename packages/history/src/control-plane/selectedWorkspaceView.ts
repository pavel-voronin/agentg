import {
  TIMELINE_SCALE_PRESETS,
  type SelectedChatHeaderView,
  type SelectedHistoryChat,
  type SelectedHistoryState,
  type SelectedHistoryStatus,
  type SelectedWorkspaceView,
  type TimelineScaleButtonView
} from './views.js';

export type SelectedWorkspaceViewSource = {
  defaultViewportDays: number;
  selectedChatId: string | null;
  selectedHistoryLoadingVisible: boolean;
  selectedHistoryState: SelectedHistoryState | null;
  selectedHistoryStatus: SelectedHistoryStatus;
  viewportDays: number | null;
};

export function selectedWorkspaceView(source: SelectedWorkspaceViewSource): SelectedWorkspaceView {
  if (source.selectedChatId === null) {
    return { status: 'empty' };
  }
  if (source.selectedHistoryStatus === 'loading' || source.selectedHistoryStatus === 'idle') {
    return source.selectedHistoryLoadingVisible ? { status: 'loading' } : { status: 'pending' };
  }
  if (source.selectedHistoryStatus === 'unavailable' || !source.selectedHistoryState?.chat) {
    return { status: 'unavailable' };
  }
  return {
    chat: selectedChatHeaderView(source.selectedHistoryState.chat),
    historyState: source.selectedHistoryState,
    scaleButtons: timelineScaleButtons(source),
    status: 'ready',
    viewportDays: source.viewportDays
  };
}

export function normalizeViewportDays(value: number | string): number {
  const days = Number(value);
  if (!Number.isFinite(days)) {
    return 30;
  }
  return Math.max(0, Math.round(days));
}

function selectedChatHeaderView(chat: SelectedHistoryChat): SelectedChatHeaderView {
  return {
    historyLabel: selectedChatHistoryLabel(chat),
    id: chat.id,
    messageCount: `${formatInteger(chat.messageCount)} messages`,
    title: chat.title,
    type: chat.type
  };
}

function selectedChatHistoryLabel(chat: SelectedHistoryChat): string | null {
  if (chat.historyStartAt !== null) {
    return `history starts ${formatDate(chat.historyStartAt)}`;
  }
  if (chat.historyBeginningReached) {
    return 'history beginning reached';
  }
  return null;
}

function timelineScaleButtons(source: SelectedWorkspaceViewSource): TimelineScaleButtonView[] {
  return TIMELINE_SCALE_PRESETS.map((preset) => ({
    active: source.viewportDays === preset.value,
    isDefault: source.defaultViewportDays === preset.value,
    label: preset.label,
    value: preset.value
  }));
}

function formatDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 16).replace('T', ' ');
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat().format(Number.isFinite(value) ? value : 0);
}
