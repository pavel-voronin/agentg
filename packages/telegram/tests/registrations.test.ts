import { createIntegrationEvent } from '@agentg/events/envelope';
import { createValidatedEventBus } from '@agentg/events/validated-bus';
import { describe, expect, it } from 'vitest';

import {
  createTelegramServiceManifest,
  TELEGRAM_EVENT_TYPES,
  TELEGRAM_TDLIB_EVENT_TYPES
} from '../src/registrations.js';

describe('Telegram service manifest', () => {
  it('lists exact Telegram events without wildcard types', () => {
    const manifest = createTelegramServiceManifest({ rpcUrl: 'http://telegram.local' });

    expect(manifest.events).toEqual(TELEGRAM_EVENT_TYPES);
    expect(manifest.events).not.toContain('telegram.tdlib.*');
    expect(manifest.events.some((type) => type.includes('*'))).toBe(false);
    expect(manifest.events).toEqual([
      'telegram.chat.removed',
      'telegram.chat.updated',
      'telegram.chat_folders.updated',
      'telegram.login.completed',
      'telegram.login.failed',
      'telegram.login.started',
      'telegram.message.created',
      'telegram.message.deleted',
      'telegram.message.updated',
      'telegram.status',
      'telegram.tdlib.close.completed',
      'telegram.tdlib.close.failed',
      'telegram.tdlib.close.started',
      'telegram.tdlib.getChat.completed',
      'telegram.tdlib.getChat.failed',
      'telegram.tdlib.getChat.started',
      'telegram.tdlib.getChatHistory.completed',
      'telegram.tdlib.getChatHistory.failed',
      'telegram.tdlib.getChatHistory.started',
      'telegram.tdlib.getChatMessageByDate.completed',
      'telegram.tdlib.getChatMessageByDate.failed',
      'telegram.tdlib.getChatMessageByDate.started',
      'telegram.tdlib.getChats.completed',
      'telegram.tdlib.getChats.failed',
      'telegram.tdlib.getChats.started',
      'telegram.tdlib.getMe.completed',
      'telegram.tdlib.getMe.failed',
      'telegram.tdlib.getMe.started',
      'telegram.tdlib.loadChats.completed',
      'telegram.tdlib.loadChats.failed',
      'telegram.tdlib.loadChats.started',
      'telegram.user.updated'
    ]);
  });

  it('lists every lifecycle for every TDLib operation used by Telegram code', () => {
    expect(TELEGRAM_TDLIB_EVENT_TYPES).toEqual([
      'telegram.tdlib.close.completed',
      'telegram.tdlib.close.failed',
      'telegram.tdlib.close.started',
      'telegram.tdlib.getChat.completed',
      'telegram.tdlib.getChat.failed',
      'telegram.tdlib.getChat.started',
      'telegram.tdlib.getChatHistory.completed',
      'telegram.tdlib.getChatHistory.failed',
      'telegram.tdlib.getChatHistory.started',
      'telegram.tdlib.getChatMessageByDate.completed',
      'telegram.tdlib.getChatMessageByDate.failed',
      'telegram.tdlib.getChatMessageByDate.started',
      'telegram.tdlib.getChats.completed',
      'telegram.tdlib.getChats.failed',
      'telegram.tdlib.getChats.started',
      'telegram.tdlib.getMe.completed',
      'telegram.tdlib.getMe.failed',
      'telegram.tdlib.getMe.started',
      'telegram.tdlib.loadChats.completed',
      'telegram.tdlib.loadChats.failed',
      'telegram.tdlib.loadChats.started'
    ]);
  });
});

describe('validated event bus', () => {
  it('throws when a publisher emits an event type outside its manifest whitelist', () => {
    const published: string[] = [];
    const eventBus = createValidatedEventBus(
      {
        close: () => Promise.resolve(),
        publish(event) {
          published.push(event.type);
        },
        subscribe() {
          return {
            unsubscribe() {
              return;
            }
          };
        }
      },
      {
        allowedTypes: ['telegram.status'],
        publisher: 'telegram'
      }
    );

    eventBus.publish(
      createIntegrationEvent({
        data: {},
        type: 'telegram.status'
      })
    );

    expect(() =>
      eventBus.publish(
        createIntegrationEvent({
          data: {},
          type: 'telegram.unknown'
        })
      )
    ).toThrow('Unregistered integration event type for telegram: telegram.unknown');
    expect(published).toEqual(['telegram.status']);
  });
});
