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
  key: string;
  kind: TimelineDetailType;
  label: string;
  to: string;
};

export type TimelineDetailType = 'coverage';

export type TimelineDetail = {
  count?: string;
  duration: string;
  endAt: Date;
  endValue: string;
  item: TimelineCoverageInterval;
  key: string;
  startValue: string;
  startAt: Date;
  type: TimelineDetailType;
};

export type TimelineDetailSection = {
  items: TimelineDetail[];
  title: string;
  type: TimelineDetailType;
};

export type TimelineSegment =
  | {
      ariaLabel: string;
      hover: TimelineHoverItem;
      key: string;
      kind: 'coverage';
      position: TimelinePosition;
    }
  | {
      ariaLabel: string;
      endIso: string;
      key: string;
      kind: 'gap';
      position: TimelinePosition;
      startIso: string;
    };

export type TimelineViewModel = TimelineBounds & {
  dateLabels: TimelineDateLabel[];
  detailSections: TimelineDetailSection[];
  detailsEmpty: boolean;
  segments: TimelineSegment[];
};

export type TimelineRawInterval = {
  coveredAt?: Date | string;
  endAt?: Date | string;
  messageCount?: number;
  startAt?: Date | string;
};

export type TimelineInterval = {
  coveredAt?: Date;
  endAt: Date;
  messageCount?: number;
  originalEndAt?: Date;
  originalStartAt?: Date;
  startAt: Date;
};

export type TimelineCoverageInterval = TimelineInterval & {
  key: string;
};

export type TimelineCoverageDetail = {
  endAt: Date;
  item: TimelineCoverageInterval;
  key: string;
  startAt: Date;
  type: 'coverage';
};

export type TimelineTooltip = {
  count?: string;
  duration: string;
  from: string;
  kind: string;
  range: string;
  to: string;
};
