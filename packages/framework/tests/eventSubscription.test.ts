import { describe, expect, it, vi } from 'vitest';

import {
  consumeEventMessages,
  type EventMessage,
  type EventMessageSource
} from '../src/events/subscription.js';

describe('event subscription consumption', () => {
  it('continues consuming after a handler error', async () => {
    const handled: string[] = [];
    const errors: string[] = [];
    const consoleError = vi.spyOn(console, 'error').mockImplementation((message) => {
      errors.push(String(message));
    });

    try {
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
      expect(errors.map((message) => JSON.parse(message) as { event: string })).toEqual([
        expect.objectContaining({
          event: 'event_bus.handler_failed'
        })
      ]);
    } finally {
      consoleError.mockRestore();
    }
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
    type
  });
}
