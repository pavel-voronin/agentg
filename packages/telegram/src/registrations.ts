export function createTelegramServiceManifest(config: { rpcUrl: string }) {
  return {
    events: [
      'telegram.chat.updated',
      'telegram.chat_folders.updated',
      'telegram.login.completed',
      'telegram.message.created',
      'telegram.message.deleted',
      'telegram.message.updated',
      'telegram.status',
      'telegram.tdlib.*',
      'telegram.user.updated'
    ],
    extensions: [],
    procedures: [
      { kind: 'query' as const, name: 'telegram.countMessagesInIntervals' },
      { kind: 'mutation' as const, name: 'telegram.fetchPage' },
      { kind: 'query' as const, name: 'telegram.getChat' },
      { kind: 'query' as const, name: 'telegram.getChatHistoryFacts' },
      { kind: 'query' as const, name: 'telegram.getMessage' },
      { kind: 'query' as const, name: 'telegram.listChatDirectory' },
      { kind: 'query' as const, name: 'telegram.listChats' },
      { kind: 'query' as const, name: 'telegram.listRecentMessages' },
      { kind: 'query' as const, name: 'telegram.searchMessages' }
    ],
    required: true,
    rpcUrl: config.rpcUrl,
    slug: 'telegram'
  };
}
