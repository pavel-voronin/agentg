import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

type DashboardTarget = {
  expr?: string;
};

type DashboardPanel = {
  datasource?: {
    type?: string;
    uid?: string;
  };
  fieldConfig?: {
    defaults?: {
      links?: { targetBlank?: boolean; title?: string; url?: string }[];
    };
  };
  gridPos?: {
    x?: number;
    y?: number;
  };
  links?: { targetBlank?: boolean; title?: string; type?: string; url?: string }[];
  options?: {
    content?: string;
  };
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
      'Stale Recovery Rate',
      'Stale Downloading',
      'Oldest Downloading'
    ]) {
      expect(expressionsForPanel(panels, title).join('\n')).not.toContain('or vector(0)');
    }
  });

  it('uses queue telemetry as the zero anchor for rare top-row event counters', () => {
    expect(expressionsForPanel(panels, 'Failure Rate')).toEqual([
      'sum(rate(telegram_file_worker_jobs_total{telegram_file_worker_job_outcome="failed"}[$__rate_interval])) or (0 * sum(telegram_file_queue_jobs{service_name="telegram"}))'
    ]);
    expect(expressionsForPanel(panels, 'Download Defer Rate')).toEqual([
      'sum(rate(telegram_file_worker_wake_total{telegram_file_worker_wake_reason="file_download_defer"}[$__rate_interval])) or (0 * sum(telegram_file_queue_jobs{service_name="telegram"}))'
    ]);
    expect(expressionsForPanel(panels, 'Stale Recovery Rate')).toEqual([
      'sum(rate(telegram_file_worker_jobs_total{telegram_file_worker_job_source="stale"}[$__rate_interval])) or (0 * sum(telegram_file_queue_jobs{service_name="telegram"}))'
    ]);
  });

  it('surfaces active stale downloading state directly', () => {
    expect(expressionsForPanel(panels, 'Stale Downloading')).toEqual([
      'sum(telegram_file_queue_stale_downloading{service_name="telegram"})'
    ]);
    expect(expressionsForPanel(panels, 'Oldest Downloading')).toEqual([
      'max(telegram_file_queue_oldest_downloading_age{service_name="telegram"})'
    ]);
  });

  it('reads file queue state from the Telegram service owner', () => {
    expect(expressionsForPanel(panels, 'Queued Jobs')).toEqual([
      'sum(telegram_file_queue_jobs{service_name="telegram", telegram_file_job_status="queued"})'
    ]);
    expect(expressionsForPanel(panels, 'Failed Assets')).toEqual([
      'sum(telegram_file_queue_assets{service_name="telegram", telegram_file_asset_status="failed"})'
    ]);
    expect(expressionsForPanel(panels, 'Backlog Without Ticks')).toEqual([
      'sum(telegram_file_queue_jobs{service_name="telegram", telegram_file_job_status="queued"}) * on() ((sum(rate(telegram_file_worker_stage_duration_seconds_count{telegram_file_worker_stage="tick"}[$__rate_interval])) or (0 * sum(telegram_file_queue_jobs{service_name="telegram"}))) == bool 0)'
    ]);
    expect(expressionsForPanel(panels, 'Asset State')).toEqual([
      'telegram_file_queue_assets{service_name="telegram"}'
    ]);
    expect(expressionsForPanel(panels, 'Download Jobs')).toEqual([
      'telegram_file_queue_jobs{service_name="telegram"}'
    ]);
    expect(expressionsForPanel(panels, 'Known Bytes')).toEqual([
      'telegram_file_queue_bytes{service_name="telegram"}'
    ]);
    expect(expressionsForPanel(panels, 'Unknown-Size Remaining Files')).toEqual([
      'telegram_file_queue_unknown_remaining{service_name="telegram"}'
    ]);
  });

  it('links failed assets to the triage section', () => {
    const panel = panelByTitle(panels, 'Failed Assets');

    expect(panel.fieldConfig?.defaults?.links).toEqual([
      {
        targetBlank: false,
        title: 'Inspect failed assets',
        url: '/d/agentg-files/files?orgId=1&from=${__from}&to=${__to}&viewPanel=44'
      }
    ]);
  });

  it('surfaces failed asset triage with bounded labels', () => {
    expect(expressionsForPanel(panels, 'Failed Assets By Reason')).toEqual([
      'telegram_file_queue_failures{service_name="telegram"}'
    ]);
    expect(panelByTitle(panels, 'Failed Assets By Reason').links).toEqual([
      expect.objectContaining({
        targetBlank: true,
        title: 'Open failure logs in Loki',
        type: 'link'
      }),
      expect.objectContaining({
        targetBlank: true,
        title: 'Open file worker traces in Jaeger',
        type: 'link'
      })
    ]);
    expect(expressionsForPanel(panels, 'New Failed Worker Jobs')).toEqual([
      'sum by (telegram_file_worker_job_source) (increase(telegram_file_worker_jobs_total{telegram_file_worker_job_outcome="failed"}[$__range]))'
    ]);
    expect(expressionsForPanel(panels, 'Failure Logs')).toEqual([
      '{service_name="telegram"} |= "telegram.file_download_failed"'
    ]);
    expect(panelByTitle(panels, 'Failure Logs').datasource).toEqual({
      type: 'loki',
      uid: 'loki'
    });
    expect(panelByTitle(panels, 'Failure Logs').links).toEqual([
      expect.objectContaining({
        targetBlank: true,
        title: 'Open failure logs in Loki',
        type: 'link'
      })
    ]);
    const tracePanel = panelByTitle(panels, 'Recent File Worker Traces');
    expect(tracePanel.datasource).toEqual({
      type: 'jaeger',
      uid: 'jaeger'
    });
    expect(tracePanel.gridPos).toMatchObject({
      x: 12,
      y: 22
    });

    const serialized = JSON.stringify(dashboard);
    expect(serialized).toContain('Failed Assets Triage');
    expect(serialized).toContain('Failure Decision Guide');
    expect(serialized).toContain('assetKey, raw error message, and trace_id');
    expect(serialized).not.toContain('download_error');
    expect(serialized).not.toContain('downloadError');
  });

  it('documents every required file metric family in the metric dictionary', () => {
    const metricMeanings = textPanelContent(panels, 'Metric Meanings');

    for (const metric of [
      'telegram.file.queue.assets',
      'telegram.file.queue.failures',
      'telegram.file.queue.jobs',
      'telegram.file.queue.oldest_downloading_age',
      'telegram.file.queue.stale_downloading',
      'telegram.file.queue.bytes',
      'telegram.file.queue.unknown_remaining',
      'telegram.file.generation.duration',
      'telegram.file.generation.outcomes',
      'telegram.file.worker.wake',
      'telegram.file.worker.jobs',
      'telegram.file.worker.stage.duration',
      'telegram.file.record.stage.duration'
    ]) {
      expect(metricMeanings).toContain(`\`${metric}\``);
    }
  });

  it('surfaces file generation outcomes and latency', () => {
    expect(expressionsForPanel(panels, 'Generation Outcomes')).toEqual([
      'sum by (telegram_file_generation_outcome, telegram_file_generation_failure_reason) (rate(telegram_file_generation_outcomes_total[$__rate_interval]))'
    ]);
    expect(expressionsForPanel(panels, 'Generation Duration P95')).toEqual([
      'histogram_quantile(0.95, sum by (le) (rate(telegram_file_generation_duration_seconds_bucket[$__rate_interval])))'
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

  it('filters Dashboard file RPC panels to the request procedure only', () => {
    const serialized = JSON.stringify(dashboard);

    expect(expressionsForPanel(panels, 'Dashboard File Request RPC Rate')).toEqual([
      'sum by (rpc_method) (rate(rpc_server_call_duration_seconds_count{service_name="dashboard-server", rpc_method="telegram.dashboard.requestFile"}[$__rate_interval]))'
    ]);
    expect(expressionsForPanel(panels, 'Dashboard File Request RPC P95')).toEqual([
      'histogram_quantile(0.95, sum by (rpc_method, le) (rate(rpc_server_call_duration_seconds_bucket{service_name="dashboard-server", rpc_method="telegram.dashboard.requestFile"}[$__rate_interval])))'
    ]);
    expect(serialized).not.toContain('telegram.dashboard.file');
    expect(serialized).not.toContain('telegram[.]dashboard[.](file|requestFile)');
    expect(serialized).not.toContain('telegram[.]cp[.](file|requestFile)');
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
  const panel = panelByTitle(panels, title);
  return (panel.targets ?? []).map((target) => target.expr ?? '');
}

function panelByTitle(panels: DashboardPanel[], title: string): DashboardPanel {
  const panel = panels.find((candidate) => candidate.title === title);
  if (panel === undefined) {
    throw new Error(`Dashboard panel not found: ${title}`);
  }
  return panel;
}

function textPanelContent(panels: DashboardPanel[], title: string): string {
  const content = panelByTitle(panels, title).options?.content;
  if (content === undefined) {
    throw new Error(`Dashboard text panel has no content: ${title}`);
  }
  return content;
}
