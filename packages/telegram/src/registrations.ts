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
      'telegram.countMessagesInIntervals',
      'telegram.fetchPage',
      'telegram.getChat',
      'telegram.getChatHistoryFacts',
      'telegram.getMessage',
      'telegram.listChatDirectory',
      'telegram.listChats',
      'telegram.listRecentMessages',
      'telegram.searchMessages'
    ],
    required: true,
    rpcUrl: config.rpcUrl,
    slug: 'telegram'
  };
}
