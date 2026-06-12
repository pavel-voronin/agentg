import type { GetMessagesInput, MessageOwner } from './contract.js';

export function getMessagesRequestId(input: GetMessagesInput): string {
  const owner = ownerKey(input.owner);
  if (input.selector.kind === 'page') {
    return joinRequestIdFields([
      ['selector', 'page'],
      ['owner', owner],
      input.selector.beforeMessageId === undefined
        ? ['anchor', 'latest']
        : ['beforeMessageId', input.selector.beforeMessageId],
      ['count', String(input.selector.count)]
    ]);
  }

  return joinRequestIdFields([
    ['selector', 'range'],
    ['owner', owner],
    ['startAt', new Date(input.selector.startAt).toISOString()],
    ['endAt', new Date(input.selector.endAt).toISOString()]
  ]);
}

function ownerKey(owner: MessageOwner): string {
  switch (owner.kind) {
    case 'chat':
      return `chat:${owner.chatId}`;
    case 'forumTopic':
      return `forum-topic:${owner.chatId}:${owner.topicId}`;
    case 'directMessagesTopic':
      return `direct-messages-topic:${owner.chatId}:${owner.topicId}`;
    case 'savedMessagesTopic':
      return `saved-messages-topic:${owner.topicId}`;
    case 'messageThread':
      return `message-thread:${owner.chatId}:${owner.messageId}`;
  }
}

function joinRequestIdFields(fields: [string, string][]): string {
  return `telegram.getMessages;${fields
    .map(([key, value]) => `${key}=${escapeValue(value)}`)
    .join(';')}`;
}

function escapeValue(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll(';', '\\;').replaceAll('=', '\\=');
}
