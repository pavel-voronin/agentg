import { defineModule } from '@agentg/framework';
import { telegramClient } from '@agentg/telegram';

import { readConfig } from './config.js';
import { createDatabase } from './database/client.js';
import { createProcedures } from './procedures/index.js';
import { createController } from './sync/controller.js';

export const historySyncModule = defineModule('history-sync', {
  config: readConfig,
  setup({ background, config, events, resource }) {
    const database = resource('database', ({ startup }) => {
      const databaseResource = createDatabase(config.databaseUrl);

      startup(() => databaseResource.start());

      return databaseResource.db;
    });
    const telegram = telegramClient({ url: config.telegramRpcUrl });
    const controller = createController(database, telegram, events, {
      chatLoadBatchSize: config.chatLoadBatchSize,
      messageLimit: config.messageLimit,
      requestDelayMs: config.requestDelayMs,
      windowDays: config.windowDays
    });

    background('sync', () => {
      const subscriptions = [
        events.subscribe('telegram.update.chat.discovered', () => {
          controller.request('chat-discovered');
        })
      ];

      controller.request('startup');
      return async () => {
        for (const subscription of subscriptions) {
          subscription.unsubscribe();
        }
        controller.stop();
        await controller.wait();
      };
    });

    return createProcedures({
      controller,
      database,
      events,
      telegram
    });
  }
});
