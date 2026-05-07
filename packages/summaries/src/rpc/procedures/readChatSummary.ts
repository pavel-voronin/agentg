import { query } from '@agentg/rpc/surface';

import {
  summariesReadChatSummaryInputSchema,
  summariesReadChatSummaryOutputSchema
} from '../contracts.js';
import { rpc } from '../trpc.js';
import type { SummariesRuntime } from '../../runtime.js';

export const readChatSummary = query((runtime: SummariesRuntime) =>
  rpc
    .input(summariesReadChatSummaryInputSchema)
    .output(summariesReadChatSummaryOutputSchema)
    .query(({ input }) => runtime.repository.readChatSummary(input.chatId))
);
