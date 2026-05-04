import { describe, expect, it } from 'vitest';

import { createEventBus } from '../src/bus/eventBus.js';
import { createAppEvent, type AppEvent } from '../src/bus/events.js';

describe('createEventBus', () => {
  it('publishes events to matching subscribers', async () => {
    const eventBus = createEventBus();
    const received: AppEvent[] = [];

    eventBus.subscribe('telegram.message.created', (event) => {
      received.push(event);
    });

    const event = createAppEvent({
      data: {
        messageId: '42'
      },
      source: 'telegram',
      type: 'telegram.message.created'
    });

    await eventBus.publish(event);

    expect(received).toEqual([event]);
  });

  it('removes subscribers without affecting other event types', async () => {
    const eventBus = createEventBus();
    const received: string[] = [];
    const subscription = eventBus.subscribe('telegram.message.created', (event) => {
      received.push(event.id);
    });

    eventBus.subscribe('telegram.chat.updated', (event) => {
      received.push(event.id);
    });

    subscription.unsubscribe();

    await eventBus.publish(
      createAppEvent({
        data: {},
        source: 'telegram',
        type: 'telegram.message.created'
      })
    );
    await eventBus.publish(
      createAppEvent({
        data: {},
        source: 'telegram',
        type: 'telegram.chat.updated'
      })
    );

    expect(received).toHaveLength(1);
    expect(eventBus.listenerCount()).toBe(1);
  });

  it('rejects publishing after close', async () => {
    const eventBus = createEventBus();
    eventBus.close();

    await expect(
      eventBus.publish(
        createAppEvent({
          data: {},
          source: 'app',
          type: 'app.started'
        })
      )
    ).rejects.toThrow('Event bus is closed');
  });
});
