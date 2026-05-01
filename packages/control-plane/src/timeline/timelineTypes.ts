export type TimelineViewport = {
  endAt: number;
  startAt: number;
};

export type TimelineBounds = {
  max: Date;
  min: Date;
};

export type TimelinePosition = {
  left: number;
  width: number;
};

export type TimelineDateLabel = {
  align: 'left' | 'right';
  delta: string;
  key: string;
  label: string;
  widthCh: number;
};

export type TimelineHoverItem = {
  duration: string;
  extra: string;
  from: string;
  fromNote?: string;
  key: string;
  kind: TimelineDetailType;
  label: string;
  to: string;
  toNote?: string;
};

export type TimelineDetailType = 'coverage' | 'job' | 'target';

export type TimelineDetail = {
  count?: string;
  cursor?: boolean;
  duration: string;
  endAt: Date;
  endNote?: string;
  endValue: string;
  id?: string;
  item: TimelineCoverageInterval | TimelineJob | TimelineTarget;
  key: string;
  startNote?: string;
  startValue: string;
  startAt: Date;
  status?: string;
  templateId?: string;
  type: TimelineDetailType;
};

export type TimelineDetailSection = {
  items: TimelineDetail[];
  title: string;
  type: TimelineDetailType;
};

export type TimelineSegment =
  | {
      kind: 'coverage';
      ariaLabel: string;
      hover: TimelineHoverItem;
      key: string;
      position: TimelinePosition;
    }
  | {
      kind: 'gap';
      ariaLabel: string;
      endIso: string;
      key: string;
      position: TimelinePosition;
      startIso: string;
    }
  | {
      kind: 'job';
      ariaLabel: string;
      hover: TimelineHoverItem;
      key: string;
      position: TimelinePosition;
      running: boolean;
    }
  | {
      kind: 'target-highlight';
      key: string;
      keys: string[];
      position: TimelinePosition;
    }
  | {
      kind: 'target-union';
      key: string;
      position: TimelinePosition;
    };

export type TimelineViewModel = TimelineBounds & {
  dateLabels: TimelineDateLabel[];
  detailSections: TimelineDetailSection[];
  detailsEmpty: boolean;
  segments: TimelineSegment[];
};

export type TimelineRawInterval = {
  endAt?: Date | string;
  messageCount?: number;
  startAt?: Date | string;
};

export type TimelineInterval = {
  endAt: Date;
  messageCount?: number;
  originalEndAt?: Date;
  originalStartAt?: Date;
  startAt: Date;
};

export type TimelineCoverageInterval = TimelineInterval & {
  key: string;
  messageCount: number;
};

export type TimelineTarget = {
  id?: string;
  projected?: TimelineRawInterval | null;
  range?: TimelineRange;
  templateId?: string | null;
};

export type TimelineBoundary =
  | {
      at?: string;
      kind?: 'absolute';
    }
  | {
      expression?: string;
      kind?: 'expression';
    };

export type TimelineRange = {
  end?: TimelineBoundary;
  start?: TimelineBoundary;
};

export type TimelineJob = TimelineRawInterval & {
  cursor?: unknown;
  id?: number | string;
  status?: string;
};

export type TimelineHistoryDetailCommon = {
  endAt: Date;
  key: string;
  startAt: Date;
};

export type TimelineHistoryDetail =
  | (TimelineHistoryDetailCommon & {
      item: TimelineCoverageInterval;
      type: 'coverage';
    })
  | (TimelineHistoryDetailCommon & {
      item: TimelineJob;
      type: 'job';
    })
  | (TimelineHistoryDetailCommon & {
      item: TimelineTarget;
      type: 'target';
    });

export type TimelineTooltip = {
  count?: string;
  duration: string;
  from: string;
  fromNote?: string;
  kind: string;
  range: string;
  to: string;
  toNote?: string;
};
