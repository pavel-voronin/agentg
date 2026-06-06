import type { MetricRowView, MetricSortKey, ReportSorts } from './report/reportView.js';
import type { TelemetryStatusSourceRegistration } from './status/statusSources.js';

export type MetricTableId = keyof ReportSorts;
export type MetricColumnSortKey = Exclude<MetricSortKey, 'name'>;
export type MetricPanelId = 'metrics' | 'samples';
export type ReportTabId = string;
export type ReportRequestMode = 'custom' | 'live';
export type SortAria = 'ascending' | 'descending' | 'none';

export type MetricColumnView = {
  key: MetricColumnSortKey;
  label: string;
};

export type ReportTabView = {
  id: ReportTabId;
  label: string;
  order: number;
  statusSource: TelemetryStatusSourceRegistration | null;
};

export type NestedTabView<TId extends string> = {
  id: TId;
  label: string;
};

export type MetricSectionView = {
  emptyLabel: string;
  firstColumnLabel: string;
  id: MetricTableId;
  rows: MetricRowView[];
  title: string;
};
