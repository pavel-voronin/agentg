import { mutation } from '@agentg/rpc/surface';

import { telegramRequestFileInputSchema, telegramRequestFileOutputSchema } from '../contracts.js';
import type { TelegramRpcRuntime } from '../runtime.js';
import { rpc } from '../trpc.js';
import { requestTelegramFile } from '../../telegram-file-store.js';
import {
  publishTelegramFileOwnerUpdated,
  publishTelegramFileQueueUpdated
} from '../../telegram-file-worker.js';

export const requestFile = mutation((runtime: TelegramRpcRuntime) =>
  rpc
    .input(telegramRequestFileInputSchema)
    .output(telegramRequestFileOutputSchema)
    .mutation(async ({ input }) => {
      const result = await requestTelegramFile(runtime.database, input);
      if (result.decision.action === 'enqueue') {
        await publishTelegramFileOwnerUpdated(runtime.database, runtime.eventBus, {
          ownerId: input.owner.id,
          ownerModel: input.owner._model
        });
        await publishTelegramFileQueueUpdated(runtime.database, runtime.eventBus);
      }
      return result;
    })
);
