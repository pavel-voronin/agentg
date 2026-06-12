import { describe, expect, it } from 'vitest';

import { normalizeMessageOwner } from '../../src/reconciler/owner.js';

describe('Telegram history reconciler owner model', () => {
  it('normalizes every public owner kind to one internal owner key', () => {
    expect(
      [
        normalizeMessageOwner({
          chatId: '1',
          kind: 'chat'
        }),
        normalizeMessageOwner({
          chatId: '1',
          kind: 'forumTopic',
          topicId: '2'
        }),
        normalizeMessageOwner({
          chatId: '1',
          kind: 'directMessagesTopic',
          topicId: '3'
        }),
        normalizeMessageOwner({
          kind: 'savedMessagesTopic',
          topicId: '4'
        }),
        normalizeMessageOwner({
          chatId: '1',
          kind: 'messageThread',
          messageId: '5'
        })
      ].map((owner) => ({
        chatId: owner.chatId,
        key: owner.key,
        kind: owner.kind
      }))
    ).toEqual([
      {
        chatId: '1',
        key: 'chat:1',
        kind: 'chat'
      },
      {
        chatId: '1',
        key: 'forum-topic:1:2',
        kind: 'forum_topic'
      },
      {
        chatId: '1',
        key: 'direct-messages-topic:1:3',
        kind: 'direct_messages_topic'
      },
      {
        chatId: undefined,
        key: 'saved-messages-topic:4',
        kind: 'saved_messages_topic'
      },
      {
        chatId: '1',
        key: 'message-thread:1:5',
        kind: 'message_thread'
      }
    ]);
  });
});
