import { afterEach, describe, expect, it, vi } from 'vitest';

import { handledUpdateTypes } from './registry.js';
import { recordHandledUpdateCatalog, recordUpdateSeen } from './updateCatalogTelemetry.js';

const telemetry = vi.hoisted(() => ({
  setTelemetryGauge: vi.fn()
}));

vi.mock('@agentg/framework', async (importOriginal) => {
  const framework = await importOriginal<typeof import('@agentg/framework')>();
  return {
    ...framework,
    setTelemetryGauge: telemetry.setTelemetryGauge
  };
});

const originalTelemetry = process.env.AGENTG_TELEMETRY;

describe('update catalog telemetry', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    telemetry.setTelemetryGauge.mockReset();
    if (originalTelemetry === undefined) {
      delete process.env.AGENTG_TELEMETRY;
      return;
    }
    process.env.AGENTG_TELEMETRY = originalTelemetry;
  });

  it('records one catalog gauge per handled update type', () => {
    process.env.AGENTG_TELEMETRY = '1';

    recordHandledUpdateCatalog();

    expect(telemetry.setTelemetryGauge).toHaveBeenCalledTimes(handledUpdateTypes.length);
    for (const [index, updateType] of handledUpdateTypes.entries()) {
      expect(telemetry.setTelemetryGauge).toHaveBeenNthCalledWith(
        index + 1,
        'agentg.telegram.update_catalog.info',
        1,
        {
          handler_status: 'registered',
          operation_kind: 'ingestion.update',
          operation_name: updateType,
          update_type: updateType
        }
      );
    }
  });

  it('does not record catalog gauges when telemetry is disabled', () => {
    process.env.AGENTG_TELEMETRY = '0';

    recordHandledUpdateCatalog();

    expect(telemetry.setTelemetryGauge).not.toHaveBeenCalled();
  });

  it('records last seen time for an update type', () => {
    process.env.AGENTG_TELEMETRY = '1';
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_780_816_800_000);

    recordUpdateSeen('updateNewMessage');

    expect(telemetry.setTelemetryGauge).toHaveBeenCalledWith(
      'agentg.telegram.update_last_seen.unix_ms',
      1_780_816_800_000,
      {
        operation_kind: 'ingestion.update',
        operation_name: 'updateNewMessage',
        update_type: 'updateNewMessage'
      }
    );
    now.mockRestore();
  });
});
