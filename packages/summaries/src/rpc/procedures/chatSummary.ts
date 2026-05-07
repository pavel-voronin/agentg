import { query } from '@agentg/rpc/surface';

import { summariesChatSummaryInputSchema, summariesChatSummaryOutputSchema } from '../contracts.js';
import { rpc } from '../trpc.js';
import type { SummariesRuntime } from '../../runtime.js';

export const chatSummary = query((runtime: SummariesRuntime) =>
  rpc
    .input(summariesChatSummaryInputSchema)
    .output(summariesChatSummaryOutputSchema)
    .query(async ({ input }) => {
      const result = await runtime.repository.readChatSummary(input.id);

      return {
        invalidation: result.invalidation,
        stale: result.invalidation !== null,
        summary: result.summary
      };
    })
);
