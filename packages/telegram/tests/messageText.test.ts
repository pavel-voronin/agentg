import type { EventBus } from '@agentg/events/bus';
import type { IntegrationEvent } from '@agentg/events/envelope';
import { describe, expect, it } from 'vitest';

import { createTelegramUpdateEventPublishers } from '../src/events/updateEventPublishers.js';
import { messageTextExpression, toReadMessage } from '../src/read-model/message.js';
import type { TelegramWireMessage, TelegramWireMessageContentUpdate } from '../src/tdlib/wire.js';

describe('Telegram message text extraction', () => {
  it('selects media captions as readable message text', () => {
    const query = messageTextExpression().toQuery(sqlQueryConfig as never);

    expect(query.sql).toContain(`"telegram_messages"."content"->'text'->>'text'`);
    expect(query.sql).toContain(`"telegram_messages"."content"->'caption'->>'text'`);
  });

  it('maps selected caption link entities onto read messages', () => {
    const message = toReadMessage({
      contentType: 'messagePhoto',
      deletedAt: null,
      editDate: null,
      isDeleted: false,
      isOutgoing: false,
      messageDate: new Date('2026-05-28T00:00:00.000Z'),
      replyTo: null,
      senderId: '30',
      senderType: 'messageSenderUser',
      telegramChatId: '20',
      telegramMessageId: '10',
      text: 'Caption example.com',
      textEntities: [
        {
          _: 'textEntity',
          length: 11,
          offset: 8,
          type: {
            _: 'textEntityTypeUrl'
          }
        }
      ]
    });

    expect(message).toMatchObject({
      contentType: 'messagePhoto',
      text: 'Caption example.com',
      textEntities: [
        {
          kind: 'url',
          length: 11,
          offset: 8,
          url: 'https://example.com/'
        }
      ]
    });
  });

  it('publishes media captions for new message events', () => {
    const { events, publishers } = createPublisherHarness();

    publishers.publishTelegramMessageCreated(
      wireMessageWithCaption('messagePhoto', 'Caption example.com')
    );

    expect(events[0]).toMatchObject({
      data: {
        message: {
          contentType: 'messagePhoto',
          text: 'Caption example.com',
          textEntities: [
            {
              kind: 'url',
              length: 11,
              offset: 8,
              url: 'https://example.com/'
            }
          ]
        }
      },
      type: 'telegram.message.created'
    });
  });

  it('publishes media captions for message content updates', () => {
    const { events, publishers } = createPublisherHarness();

    publishers.publishTelegramMessageUpdated({
      _: 'updateMessageContent',
      chat_id: 20,
      message_id: 10,
      new_content: mediaContentWithCaption('messageVideo', 'Caption example.com')
    } as TelegramWireMessageContentUpdate);

    expect(events[0]).toMatchObject({
      data: {
        message: {
          contentType: 'messageVideo',
          text: 'Caption example.com',
          textEntities: [
            {
              kind: 'url',
              length: 11,
              offset: 8,
              url: 'https://example.com/'
            }
          ]
        }
      },
      type: 'telegram.message.updated'
    });
  });
});

const sqlQueryConfig = {
  casing: {
    getColumnCasing(column: { name: string }) {
      return column.name;
    }
  },
  escapeName(name: string) {
    return `"${name}"`;
  },
  escapeParam(index: number) {
    return `$${String(index + 1)}`;
  },
  escapeString(value: string) {
    return `'${value.replaceAll("'", "''")}'`;
  }
};

function createPublisherHarness(): {
  events: IntegrationEvent[];
  publishers: ReturnType<typeof createTelegramUpdateEventPublishers>;
} {
  const events: IntegrationEvent[] = [];
  const eventBus = {
    publish(event: IntegrationEvent) {
      events.push(event);
    }
  } as EventBus;

  return {
    events,
    publishers: createTelegramUpdateEventPublishers(eventBus, {} as never)
  };
}

function wireMessageWithCaption(contentType: string, text: string): TelegramWireMessage {
  return {
    _: 'message',
    chat_id: 20,
    content: mediaContentWithCaption(contentType, text),
    date: 1_770_000_000,
    id: 10,
    is_outgoing: false,
    sender_id: {
      _: 'messageSenderUser',
      user_id: 30
    }
  } as TelegramWireMessage;
}

function mediaContentWithCaption(contentType: string, text: string) {
  return {
    _: contentType,
    caption: {
      _: 'formattedText',
      entities: [
        {
          _: 'textEntity',
          length: 11,
          offset: 8,
          type: {
            _: 'textEntityTypeUrl'
          }
        }
      ],
      text
    }
  };
}
