import { describe, expect, it } from 'vitest';

import { ingestionQueueSignalView, parseIngestionQueueSignal } from './ingestionQueueView.js';

describe('ingestion queue view', () => {
  it('parses and formats queue signal payloads', () => {
    const signal = parseIngestionQueueSignal({
      pendingUpdateCount: 8,
      runningUpdateCount: 4,
      updateConcurrency: 4
    });

    expect(ingestionQueueSignalView(signal, '2026-06-04T00:00:00.000Z')).toMatchObject({
      limit: '4',
      pending: '8',
      running: '4',
      tone: 'bad',
      utilization: '100%'
    });
  });

  it('rejects invalid queue signal payloads', () => {
    expect(() =>
      parseIngestionQueueSignal({
        pendingUpdateCount: -1,
        runningUpdateCount: 0,
        updateConcurrency: 4
      })
    ).toThrow('Ingestion queue signal shape is invalid');
  });
});
