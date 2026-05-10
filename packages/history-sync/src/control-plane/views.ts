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

export type SelectedHistorySyncChat = {
  historySyncBeginningReached: boolean;
  historySyncStartAt: string | null;
  id: string;
  isBot: boolean;
  messageCount: number;
  title: string;
  type: string;
  updatedAt: string;
};

export type HistorySyncInterval = {
  endAt: string;
  messageCount?: number;
  startAt: string;
};

export type HistorySyncBoundary =
  | {
      at: string;
      kind: 'absolute';
    }
  | {
      expression: string;
      kind: 'expression';
    };

export type HistorySyncRange = {
  end: HistorySyncBoundary;
  start: HistorySyncBoundary;
};

export type HistorySyncTarget = {
  chatId: string;
  id: string;
  projected?: HistorySyncInterval;
  range: HistorySyncRange;
  templateId?: string | null;
};

export type SelectedHistorySyncState = {
  chat: SelectedHistorySyncChat | null;
  coverage: HistorySyncInterval[];
  desired: HistorySyncInterval[];
  missing: HistorySyncInterval[];
  targets: HistorySyncTarget[];
};

export type SelectedHistorySyncStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

export type SelectedChatHeaderView = {
  historySyncLabel: string | null;
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
      historySyncState: SelectedHistorySyncState;
      scaleButtons: TimelineScaleButtonView[];
      status: 'ready';
      viewportDays: number | null;
    };
