export const DEFAULT_VIEWPORT_DAYS = 30;
export const TIMELINE_SCALE_PRESETS = [
  { label: '7d', value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
  { label: '1y', value: 365 },
  { label: 'All', value: 0 }
] as const;

export type ControlPlaneEvent = {
  data?: unknown;
  id?: string;
  meta?: unknown;
  occurredAt?: Date | string;
  type?: string;
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
      status: 'pending';
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
