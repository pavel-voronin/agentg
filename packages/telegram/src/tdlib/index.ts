import { createLogger, logError, type EventBus } from '@agentg/framework';
import type { Update } from 'tdlib-types';
import type { Client } from 'tdl';

import { configureTdlib, createClient, type ClientConfig } from './client.js';
import { createOperations, type Operations } from './operations.js';
import { createScheduler, type Scheduler } from './scheduler.js';

export type Tdlib = Operations & {
  getQueueStats: Scheduler['getQueueStats'];
  onUpdate(handler: (update: Update) => void | Promise<void>): () => void;
};

export type TdlibOptions = {
  config: ClientConfig;
  events: EventBus;
};

const logger = createLogger('telegram');

type TdlibRuntime = {
  start(): Promise<() => Promise<undefined>>;
  tdlib: Tdlib;
};

export function useTdlib(options: TdlibOptions): TdlibRuntime {
  let client: Client | undefined;
  let scheduler: Scheduler | undefined;
  let operations: Operations | undefined;
  const updateHandlers = new Set<(update: Update) => void | Promise<void>>();

  function readyOperations(): Operations {
    if (operations === undefined) {
      throw new Error('TDLib operations are not ready');
    }
    return operations;
  }

  function readyScheduler(): Scheduler {
    if (scheduler === undefined) {
      throw new Error('TDLib scheduler is not ready');
    }
    return scheduler;
  }

  async function start(): Promise<() => Promise<undefined>> {
    if (client !== undefined) {
      return stop;
    }

    let loginStarted = false;
    configureTdlib();
    try {
      client = await createClient(options.config);
      client.on('error', (error: unknown) => {
        logger.error(
          {
            event: 'telegram.error',
            ...logError(error)
          },
          'telegram tdlib error'
        );
      });
      client.on('update', handleUpdate);
      scheduler = createScheduler(client);
      operations = createOperations({
        client: scheduler,
        events: options.events
      });
      options.events.publish('telegram.login.started');
      loginStarted = true;
      await client.login();
      options.events.publish('telegram.login.completed');
    } catch (error) {
      if (loginStarted) {
        options.events.publish('telegram.login.failed', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
      await stop();
      throw error;
    }

    return stop;
  }

  async function stop(): Promise<undefined> {
    client?.off('update', handleUpdate);
    scheduler?.close();
    scheduler = undefined;
    operations = undefined;
    if (client !== undefined) {
      await client.close();
      client = undefined;
    }
    return undefined;
  }

  function handleUpdate(update: Update): void {
    for (const handler of updateHandlers) {
      void handler(update);
    }
  }

  const tdlib: Tdlib = {
    addFileToDownloads(input, invokeOptions) {
      return readyOperations().addFileToDownloads(input, invokeOptions);
    },
    deleteFile(input, invokeOptions) {
      return readyOperations().deleteFile(input, invokeOptions);
    },
    downloadFile(input, invokeOptions) {
      return readyOperations().downloadFile(input, invokeOptions);
    },
    finishFileGeneration(input, invokeOptions) {
      return readyOperations().finishFileGeneration(input, invokeOptions);
    },
    getChat(input, invokeOptions) {
      return readyOperations().getChat(input, invokeOptions);
    },
    getFile(input, invokeOptions) {
      return readyOperations().getFile(input, invokeOptions);
    },
    getMe(invokeOptions) {
      return readyOperations().getMe(invokeOptions);
    },
    getChatHistory(input, invokeOptions) {
      return readyOperations().getChatHistory(input, invokeOptions);
    },
    getChatMessageByDate(input, invokeOptions) {
      return readyOperations().getChatMessageByDate(input, invokeOptions);
    },
    getChats(input, invokeOptions) {
      return readyOperations().getChats(input, invokeOptions);
    },
    getQueueStats() {
      return readyScheduler().getQueueStats();
    },
    loadChats(input, invokeOptions) {
      return readyOperations().loadChats(input, invokeOptions);
    },
    onUpdate(handler) {
      updateHandlers.add(handler);
      return () => {
        updateHandlers.delete(handler);
      };
    },
    removeFileFromDownloads(input, invokeOptions) {
      return readyOperations().removeFileFromDownloads(input, invokeOptions);
    },
    setFileGenerationProgress(input, invokeOptions) {
      return readyOperations().setFileGenerationProgress(input, invokeOptions);
    }
  };

  return {
    start,
    tdlib
  };
}
