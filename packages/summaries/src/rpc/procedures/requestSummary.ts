import { mutation } from '@agentg/rpc/surface';

import {
  summariesRequestSummaryInputSchema,
  summariesRequestSummaryOutputSchema
} from '../contracts.js';
import { rpc, type SummariesRpcContext } from '../trpc.js';
import { createSummaryCompletedEvent, createSummaryRequestedEvent } from '../../events.js';
import type { SummariesRuntime } from '../../runtime.js';

export const requestSummary = mutation((runtime: SummariesRuntime) =>
  rpc
    .input(summariesRequestSummaryInputSchema)
    .output(summariesRequestSummaryOutputSchema)
    .mutation(async ({ ctx, input }) => {
      ctx.progress?.({
        message: 'Creating chat summary',
        stage: 'summaries.requested'
      });
      const activeRuntime = runtimeForCall(runtime, ctx);
      const now = activeRuntime.now?.() ?? new Date();
      const result = await activeRuntime.repository.requestSummary(input, now);

      activeRuntime.eventBus.publish(createSummaryRequestedEvent(result.run));
      activeRuntime.eventBus.publish(
        createSummaryCompletedEvent({
          result: result.summary,
          run: result.run
        })
      );

      return result;
    })
);

function runtimeForCall(runtime: SummariesRuntime, ctx: SummariesRpcContext): SummariesRuntime {
  if (ctx.eventBus === undefined || ctx.eventBus === runtime.eventBus) {
    return runtime;
  }

  return {
    ...runtime,
    eventBus: ctx.eventBus
  };
}
