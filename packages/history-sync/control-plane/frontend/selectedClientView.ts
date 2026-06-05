import {
  TIMELINE_SCALE_PRESETS,
  type SelectedChatHeaderView,
  type SelectedHistorySyncChat,
  type SelectedHistorySyncState,
  type SelectedHistorySyncStatus,
  type SelectedClientView,
  type TimelineScaleButtonView
} from './views.js';

export type SelectedClientViewSource = {
  defaultViewportDays: number;
  selectedChatId: string | null;
  selectedHistorySyncLoadingVisible: boolean;
  selectedHistorySyncState: SelectedHistorySyncState | null;
  selectedHistorySyncStatus: SelectedHistorySyncStatus;
  viewportDays: number | null;
};

export function selectedClientView(source: SelectedClientViewSource): SelectedClientView {
  if (source.selectedChatId === null) {
    return { status: 'empty' };
  }
  if (
    source.selectedHistorySyncStatus === 'loading' ||
    source.selectedHistorySyncStatus === 'idle'
  ) {
    return source.selectedHistorySyncLoadingVisible ? { status: 'loading' } : { status: 'pending' };
  }
  if (
    source.selectedHistorySyncStatus === 'unavailable' ||
    !source.selectedHistorySyncState?.chat
  ) {
    return { status: 'unavailable' };
  }
  return {
    chat: selectedChatHeaderView(source.selectedHistorySyncState.chat),
    historySyncState: source.selectedHistorySyncState,
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

function selectedChatHeaderView(chat: SelectedHistorySyncChat): SelectedChatHeaderView {
  return {
    historySyncLabel: selectedChatHistorySyncLabel(chat),
    id: chat.id,
    messageCount: `${formatInteger(chat.messageCount)} messages`,
    title: chat.title,
    type: chat.type
  };
}

function selectedChatHistorySyncLabel(chat: SelectedHistorySyncChat): string | null {
  if (chat.historySyncStartAt !== null) {
    return `history starts ${formatDate(chat.historySyncStartAt)}`;
  }
  if (chat.historySyncBeginningReached) {
    return 'history beginning reached';
  }
  return null;
}

function timelineScaleButtons(source: SelectedClientViewSource): TimelineScaleButtonView[] {
  return TIMELINE_SCALE_PRESETS.map((preset) => ({
    active: source.viewportDays === preset.value,
    isDefault: source.defaultViewportDays === preset.value,
    label: preset.label,
    value: preset.value
  }));
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 16).replace('T', ' ');
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat().format(Number.isFinite(value) ? value : 0);
}
