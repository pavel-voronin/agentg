import { describe, expect, it } from 'vitest';

import { messageFromStorageRow } from '../src/repositories/messageAssembler.js';
import { messageTextExpression, toMessageStorageRow } from '../src/storage/messageRowStorage.js';

describe('Telegram message text extraction', () => {
  it('selects media captions as readable message text', () => {
    const query = messageTextExpression().toQuery(sqlQueryConfig as never);

    expect(query.sql).toContain(`"telegram_messages"."content"->'text'->>'text'`);
    expect(query.sql).toContain(`"telegram_messages"."content"->'caption'->>'text'`);
  });

  it('maps selected caption link entities onto read messages', () => {
    const message = messageFromStorageRow(
      toMessageStorageRow({
        contentType: 'messagePhoto',
        deletedAt: null,
        editDate: null,
        isDeleted: false,
        isOutgoing: false,
        messageDate: new Date('2026-05-28T00:00:00.000Z'),
        reactions: null,
        replyChatId: null,
        replyMessageId: null,
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
      })
    );

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
