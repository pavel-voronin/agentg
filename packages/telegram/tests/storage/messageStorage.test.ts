import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { message as Message } from 'tdlib-types';
import { describe, expect, it } from 'vitest';

import type { Database } from '../../src/database/client.js';
import { saveMessageStates, upsertMessagePatch } from '../../src/storage/messageStorage.js';
import { messageStateFromTdlibMessage } from '../../src/tdlib/messageState.js';

describe('Telegram message storage', () => {
  it('preserves file slot marker unless stored message content changes', async () => {
    const captured: { set?: Record<string, unknown> } = {};

    await saveMessageStates(storeDatabase(captured), [
      messageStateFromTdlibMessage(telegramMessage())
    ]);

    const slotMarker = captured.set?.fileSlotsRecordedAt;
    expect(slotMarker).toBeDefined();
    const query = new PgDialect().sqlToQuery(slotMarker as SQL);
    expect(query.sql).toContain(
      '"telegram_messages"."content" is distinct from excluded."content"'
    );
    expect(query.sql).toContain('then null else "telegram_messages"."file_slots_recorded_at" end');
  });

  it('does not overwrite unread poll vote state from full message upserts', async () => {
    const captured: { set?: Record<string, unknown> } = {};

    await saveMessageStates(storeDatabase(captured), [
      messageStateFromTdlibMessage(telegramMessage())
    ]);

    expect(captured.set).not.toHaveProperty('containsUnreadPollVotes');
  });

  it('clears file slot marker when message content changes', async () => {
    const captured: { set?: Record<string, unknown> } = {};

    await upsertMessagePatch(storeDatabase(captured), {
      chatId: '123',
      content: {
        _: 'messageText',
        text: {
          _: 'formattedText',
          entities: [],
          text: 'updated'
        }
      },
      id: '456'
    });

    const slotMarker = captured.set?.fileSlotsRecordedAt;
    expect(slotMarker).toBeDefined();
    const query = new PgDialect().sqlToQuery(slotMarker as SQL);
    expect(query.sql).toContain(
      '"telegram_messages"."content" is distinct from excluded."content"'
    );
    expect(query.sql).toContain('then null else "telegram_messages"."file_slots_recorded_at" end');
  });
});

function storeDatabase(captured: { set?: Record<string, unknown> }): Database {
  return {
    insert() {
      return {
        values() {
          return {
            onConflictDoUpdate(input: { set: Record<string, unknown> }) {
              captured.set = input.set;
              return {
                returning() {
                  return Promise.resolve([{ telegramMessageId: '456' }]);
                },
                then(resolve: (value: unknown) => unknown) {
                  return Promise.resolve(resolve([]));
                }
              };
            }
          };
        }
      };
    }
  } as unknown as Database;
}

function telegramMessage(): Message {
  return {
    _: 'message',
    author_signature: '',
    auto_delete_in: 0,
    can_be_saved: true,
    chat_id: 123,
    contains_unread_mention: false,
    content: {
      _: 'messageText',
      text: {
        _: 'formattedText',
        entities: [],
        text: 'hello'
      }
    },
    date: 1_781_232_000,
    edit_date: 0,
    id: 456,
    import_info: null,
    interaction_info: null,
    is_channel_post: false,
    is_from_offline: false,
    is_outgoing: false,
    is_paid_star_suggested_post: false,
    is_paid_ton_suggested_post: false,
    is_pinned: false,
    sender_id: {
      _: 'messageSenderUser',
      user_id: 1
    },
    sending_state: null,
    unread_reactions: [],
    via_bot_user_id: 0
  } as unknown as Message;
}
