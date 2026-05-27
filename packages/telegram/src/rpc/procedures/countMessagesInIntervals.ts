import { query } from '@agentg/rpc/surface';
import {
  telegramCountMessagesInIntervalsInputSchema,
  telegramCountMessagesInIntervalsOutputSchema
} from '../contracts.js';
import type { TelegramRpcRuntime } from '../runtime.js';
import { rpc } from '../trpc.js';
import { handleCountMessagesInIntervals } from '../../tdlib-procedure-handlers/countMessagesInIntervals.js';

export const countMessagesInIntervals = query((runtime: TelegramRpcRuntime) =>
  rpc
    .input(telegramCountMessagesInIntervalsInputSchema)
    .output(telegramCountMessagesInIntervalsOutputSchema)
    .query(({ input }) => handleCountMessagesInIntervals(runtime, input))
);
