import {
  TIMELINE_SCALE_PRESETS,
  type SelectedChatHeaderView,
  type SelectedHistoryChat,
  type SelectedHistoryState,
  type SelectedHistoryStatus,
  type SelectedWorkspaceView,
  type TimelineScaleButtonView
} from '../stores/controlPlaneTypes.js';
import { formatDate, formatInteger } from './formatters.js';

export type SelectedWorkspaceViewSource = {
  defaultViewportDays: number;
  selectedChatId: string | null;
  selectedHistoryState: SelectedHistoryState | null;
  selectedHistoryStatus: SelectedHistoryStatus;
  viewportDays: number | null;
};

export function selectedWorkspaceView(source: SelectedWorkspaceViewSource): SelectedWorkspaceView {
  if (source.selectedChatId === null) {
    return { status: 'empty' };
  }
  if (source.selectedHistoryStatus === 'loading' || source.selectedHistoryStatus === 'idle') {
    return { status: 'loading' };
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

function timelineScaleButtons(source: SelectedWorkspaceViewSource): TimelineScaleButtonView[] {
  return TIMELINE_SCALE_PRESETS.map((preset) => ({
    active: source.viewportDays === preset.value,
    isDefault: source.defaultViewportDays === preset.value,
    label: preset.label,
    value: preset.value
  }));
}
