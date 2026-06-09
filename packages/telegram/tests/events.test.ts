import type { EventBus } from '@agentg/framework';
import { describe, expect, it, vi } from 'vitest';

import { createUpdateEvents } from '../src/ingestion/events.js';

describe('Telegram update events', () => {
  it('publishes update event names from publisher method names', async () => {
    const publish = vi.fn();
    const events = createUpdateEvents({
      publish
    } as unknown as EventBus);
    const message = {
      _: 'message',
      chat_id: 20,
      id: 10
    };

    await events.publishTelegramMessageCreated(message);
    await events.publishTelegramChatDiscovered('20');
    await events.publishTelegramChatDirectoryUpdated('20');

    expect(publish).toHaveBeenCalledWith('telegram.update.message.created', {
      args: [message]
    });
    expect(publish).toHaveBeenCalledWith('telegram.update.chat.discovered', {
      args: ['20']
    });
    expect(publish).toHaveBeenCalledWith('telegram.update.chat.directory.updated', {
      args: ['20']
    });
  });
});
