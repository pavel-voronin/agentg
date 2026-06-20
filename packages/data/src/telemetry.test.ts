import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@agentg/framework', () => ({
  incrementTelemetryCounter: vi.fn(),
  recordTelemetryHistogram: vi.fn()
}));

import { incrementTelemetryCounter, recordTelemetryHistogram } from '@agentg/framework';
import { recordWrite, timeOperation } from './telemetry.js';

describe('data telemetry', () => {
  beforeEach(() => {
    vi.mocked(incrementTelemetryCounter).mockReset();
    vi.mocked(recordTelemetryHistogram).mockReset();
  });

  it('records operation duration with bounded labels', async () => {
    await expect(timeOperation('select', () => Promise.resolve('ok'))).resolves.toBe('ok');

    expect(recordTelemetryHistogram).toHaveBeenCalledWith(
      'data.operation.duration',
      expect.any(Number),
      {
        'data.operation': 'select',
        'data.operation.result': 'ok'
      },
      {
        description: 'Data operation runtime by bounded operation and result.',
        unit: 's'
      }
    );

    const calls = JSON.stringify(vi.mocked(recordTelemetryHistogram).mock.calls);
    expect(calls).not.toContain('subjectId');
    expect(calls).not.toContain('messageId');
    expect(calls).not.toContain('chatId');
  });

  it('records failed operation duration with error type only', async () => {
    await expect(
      timeOperation('write_annotation', () => Promise.reject(new TypeError('bad value')))
    ).rejects.toThrow('bad value');

    expect(recordTelemetryHistogram).toHaveBeenCalledWith(
      'data.operation.duration',
      expect.any(Number),
      {
        'data.operation': 'write_annotation',
        'data.operation.result': 'failed',
        'error.type': 'TypeError'
      },
      {
        description: 'Data operation runtime by bounded operation and result.',
        unit: 's'
      }
    );
  });

  it('records writes by kind and mode without addresses', () => {
    recordWrite('collection_item', 'append', 3);

    expect(incrementTelemetryCounter).toHaveBeenCalledWith('data.writes', 3, {
      'data.write.kind': 'collection_item',
      'data.write.mode': 'append'
    });
    expect(JSON.stringify(vi.mocked(incrementTelemetryCounter).mock.calls)).not.toContain(
      'telegram.message'
    );
  });
});
