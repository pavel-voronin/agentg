import { describe, expect, it, vi } from 'vitest';

const logs = vi.hoisted(() => [] as Record<string, unknown>[]);

vi.mock('../src/log.js', () => ({
  createLogger: () => ({
    error(entry: Record<string, unknown>) {
      logs.push(entry);
    }
  }),
  logError: (error: unknown) => ({
    'error.type': error instanceof Error ? error.name : typeof error,
    error
  })
}));

import {
  consumeEventMessages,
  type EventMessage,
  type EventMessageSource
} from '../src/events/subscription.js';

describe('event subscription consumption', () => {
  it('continues consuming after a handler error', async () => {
    const handled: string[] = [];
    logs.length = 0;

    await consumeEventMessages({
      closed: () => false,
      decode: (data) => Buffer.from(data).toString('utf8'),
      handler(event) {
        handled.push(event.type);
        if (event.type === 'alpha.failed') {
          throw new Error('handler boom');
        }
      },
      source: eventSource([envelope('alpha.failed'), envelope('alpha.next')])
    });

    expect(handled).toEqual(['alpha.failed', 'alpha.next']);
    expect(logs).toEqual([
      expect.objectContaining({
        event: 'event_bus.handler_failed'
      })
    ]);
  });
});

function eventSource(payloads: string[]): EventMessageSource {
  return {
    [Symbol.asyncIterator]() {
      let index = 0;
      return {
        next(): Promise<IteratorResult<EventMessage>> {
          const payload = payloads[index];
          index += 1;
          return Promise.resolve(
            payload === undefined
              ? {
                  done: true,
                  value: undefined
                }
              : {
                  done: false,
                  value: {
                    data: Buffer.from(payload)
                  }
                }
          );
        }
      };
    },
    getSubject() {
      return 'alpha.>';
    }
  };
}

function envelope(type: string): string {
  return JSON.stringify({
    at: '2026-06-03T00:00:00.000Z',
    id: `evt:${type}`,
    trace: {
      traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'
    },
    type
  });
}
