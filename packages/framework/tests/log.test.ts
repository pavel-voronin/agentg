import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ATTR_ERROR_TYPE } from '@opentelemetry/semantic-conventions';

type CapturedLogRecord = {
  attributes?: Record<string, unknown>;
  body?: unknown;
  severityText?: string;
};

const telemetry = vi.hoisted(() => ({
  records: [] as CapturedLogRecord[]
}));

vi.mock('../src/telemetry/recorder.js', () => ({
  recordTelemetryLog(record: unknown) {
    telemetry.records.push(record as CapturedLogRecord);
  }
}));

import { createLogger, logContext, logError } from '../src/log.js';

describe('framework logger', () => {
  beforeEach(() => {
    telemetry.records.length = 0;
  });

  it('emits explicit structured log context to OTLP logs', () => {
    const logger = createLogger('test');

    logger.warn(
      {
        event: 'test.decision',
        ...logContext({
          operation: 'file-download',
          reason: 'stale_retry_limit'
        })
      },
      'test decision'
    );

    expect(telemetry.records).toHaveLength(1);
    const [record] = telemetry.records;
    expect(record).toMatchObject({
      body: 'test decision',
      severityText: 'warn'
    });
    expect(record?.attributes).toMatchObject({
      event: 'test.decision',
      operation: 'file-download',
      reason: 'stale_retry_limit'
    });
  });

  it('emits bounded error metadata without requiring callers to duplicate it', () => {
    const logger = createLogger('test');

    logger.error(
      {
        event: 'test.failed',
        ...logError(new TypeError('transport failed'))
      },
      'test failed'
    );

    expect(telemetry.records).toHaveLength(1);
    const [record] = telemetry.records;
    expect(record).toMatchObject({
      body: 'test failed',
      severityText: 'error'
    });
    expect(record?.attributes).toMatchObject({
      [ATTR_ERROR_TYPE]: 'TypeError',
      'error.message': 'transport failed',
      event: 'test.failed'
    });
  });
});
