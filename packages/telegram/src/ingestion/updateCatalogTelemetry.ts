import { setTelemetryGauge, telemetryEnabled } from '@agentg/framework';

import { handledUpdateTypes } from './catalog.js';

const METRIC_CATALOG = 'telegram.update.catalog.info';
const METRIC_LAST_SEEN = 'telegram.update.last_seen.unix_seconds';

export function recordHandledUpdateCatalog(): void {
  if (!telemetryEnabled()) {
    return;
  }

  for (const updateType of handledUpdateTypes) {
    setTelemetryGauge(METRIC_CATALOG, 1, {
      handler_status: 'registered',
      'telegram.update.type': updateType
    });
  }
}

export function recordUpdateSeen(updateType: string): void {
  if (!telemetryEnabled()) {
    return;
  }

  setTelemetryGauge(METRIC_LAST_SEEN, Date.now() / 1000, {
    'telegram.update.type': updateType
  });
}
