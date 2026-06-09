import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

type DashboardTarget = {
  expr?: string;
};

type DashboardPanel = {
  panels?: DashboardPanel[];
  targets?: DashboardTarget[];
  title?: string;
};

type Dashboard = {
  panels: DashboardPanel[];
  title: string;
  uid: string;
};

const dashboardPath = fileURLToPath(
  new URL('../../../observability/grafana/dashboards/agentgFiles.json', import.meta.url)
);

describe('Files Grafana dashboard', () => {
  const dashboard = JSON.parse(readFileSync(dashboardPath, 'utf8')) as Dashboard;
  const panels = collectPanels(dashboard.panels);

  it('keeps the Files dashboard route identity stable', () => {
    expect(dashboard.title).toBe('Files');
    expect(dashboard.uid).toBe('agentg-files');
  });

  it('does not flatten missing top-row telemetry into unconditional zeroes', () => {
    for (const title of [
      'Queued Jobs',
      'Failed Assets',
      'Backlog Without Ticks',
      'Failure Rate',
      'Download Defer Rate',
      'Stale Recovery Rate'
    ]) {
      expect(expressionsForPanel(panels, title).join('\n')).not.toContain('or vector(0)');
    }
  });

  it('uses queue telemetry as the zero anchor for rare top-row event counters', () => {
    expect(expressionsForPanel(panels, 'Failure Rate')).toEqual([
      'sum(rate(telegram_file_worker_jobs_total{telegram_file_worker_job_outcome="failed"}[$__rate_interval])) or (0 * sum(telegram_file_queue_jobs))'
    ]);
    expect(expressionsForPanel(panels, 'Download Defer Rate')).toEqual([
      'sum(rate(telegram_file_worker_wake_total{telegram_file_worker_wake_reason="file_download_defer"}[$__rate_interval])) or (0 * sum(telegram_file_queue_jobs))'
    ]);
    expect(expressionsForPanel(panels, 'Stale Recovery Rate')).toEqual([
      'sum(rate(telegram_file_worker_jobs_total{telegram_file_worker_job_source="stale"}[$__rate_interval])) or (0 * sum(telegram_file_queue_jobs))'
    ]);
  });

  it('keeps file download defers in worker wake metrics instead of job outcomes', () => {
    expect(expressionsForPanel(panels, 'Download Defer Rate').join('\n')).toContain(
      'telegram_file_worker_wake_total'
    );
    expect(expressionsForPanel(panels, 'Job Outcomes By Source').join('\n')).toContain(
      'telegram_file_worker_jobs_total'
    );
    expect(JSON.stringify(dashboard)).not.toContain('telegram_file_worker_job_source="pressure"');
    expect(JSON.stringify(dashboard)).not.toContain('telegram_file_worker_job_outcome="delayed"');
    expect(JSON.stringify(dashboard)).not.toContain('delayed by pressure');
  });
});

function collectPanels(panels: DashboardPanel[]): DashboardPanel[] {
  const collected: DashboardPanel[] = [];
  for (const panel of panels) {
    collected.push(panel);
    if (panel.panels !== undefined) {
      collected.push(...collectPanels(panel.panels));
    }
  }
  return collected;
}

function expressionsForPanel(panels: DashboardPanel[], title: string): string[] {
  const panel = panels.find((candidate) => candidate.title === title);
  if (panel === undefined) {
    throw new Error(`Dashboard panel not found: ${title}`);
  }
  return (panel.targets ?? []).map((target) => target.expr ?? '');
}
