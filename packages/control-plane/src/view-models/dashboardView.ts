import type { DashboardMetric, HistoryOverview } from '../stores/controlPlaneTypes.js';
import { formatInteger, formatOptionalValue } from './formatters.js';

export function dashboardMetricsFromOverview(overview: HistoryOverview | null): DashboardMetric[] {
  const activeJob = overview?.activeJob ?? null;
  return [
    dashboardMetric('Chats', overview?.chats ?? 0),
    dashboardMetric('Targets', overview?.targets ?? 0),
    dashboardMetric('Coverage intervals', overview?.coverageIntervals ?? 0),
    dashboardMetric(
      'Current job',
      activeJob?.status ?? '\u2014',
      activeJob
        ? `${formatOptionalValue(activeJob.chatId)} \u00b7 ${dashboardShortInterval(activeJob)}`
        : 'idle'
    )
  ];
}

function dashboardMetric(label: string, value: number | string, detail = ''): DashboardMetric {
  return {
    detail,
    label,
    value: typeof value === 'number' ? formatInteger(value) : value
  };
}

function dashboardShortInterval(interval: {
  endAt?: Date | string;
  startAt?: Date | string;
}): string {
  return `${dashboardShortDate(interval.startAt)} -> ${dashboardShortDate(interval.endAt)}`;
}

function dashboardShortDate(value: Date | string | undefined): string {
  const date = value instanceof Date ? value : new Date(value ?? '');
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(5, 16).replace('T', ' ');
}
