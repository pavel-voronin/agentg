import { setTelemetryGauge, telemetryEnabled } from '@agentg/framework';

import { handledUpdateTypes } from './registry.js';

const METRIC_CATALOG = 'agentg.telegram.update_catalog.info';
const METRIC_LAST_SEEN = 'agentg.telegram.update_last_seen.unix_ms';

export function recordHandledUpdateCatalog(): void {
  if (!telemetryEnabled()) {
    return;
  }

  for (const updateType of handledUpdateTypes) {
    setTelemetryGauge(METRIC_CATALOG, 1, {
      handler_status: 'registered',
      operation_kind: 'ingestion.update',
      operation_name: updateType,
      update_type: updateType
    });
  }
}

export function recordUpdateSeen(updateType: string): void {
  if (!telemetryEnabled()) {
    return;
  }

  setTelemetryGauge(METRIC_LAST_SEEN, Date.now(), {
    operation_kind: 'ingestion.update',
    operation_name: updateType,
    update_type: updateType
  });
}
