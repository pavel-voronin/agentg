import {
  summariesChatSummaryInputSchema,
  summariesChatSummaryOutputSchema,
  summariesReadChatSummaryInputSchema,
  summariesReadChatSummaryOutputSchema,
  summariesReadSummaryRunInputSchema,
  summariesReadSummaryRunOutputSchema,
  summariesRequestSummaryInputSchema,
  summariesRequestSummaryOutputSchema
} from './contracts.js';
import { rpc, summariesRpcRouter } from './trpc.js';
import {
  getChatSummaryExtension,
  readChatSummary,
  readSummaryRun,
  requestChatSummary,
  type SummariesRuntime
} from '../summary-service.js';
import type { SummariesRpcContext } from './trpc.js';

export function createSummariesRouter(runtime: SummariesRuntime) {
  return summariesRpcRouter({
    chatSummary: rpc
      .input(summariesChatSummaryInputSchema)
      .output(summariesChatSummaryOutputSchema)
      .query(({ input }) => getChatSummaryExtension(runtime, input.id)),
    readChatSummary: rpc
      .input(summariesReadChatSummaryInputSchema)
      .output(summariesReadChatSummaryOutputSchema)
      .query(({ input }) => readChatSummary(runtime, input.chatId)),
    readSummaryRun: rpc
      .input(summariesReadSummaryRunInputSchema)
      .output(summariesReadSummaryRunOutputSchema)
      .query(({ input }) => readSummaryRun(runtime, input.runId)),
    requestSummary: rpc
      .input(summariesRequestSummaryInputSchema)
      .output(summariesRequestSummaryOutputSchema)
      .mutation(({ ctx, input }) => {
        ctx.progress?.({
          message: 'Creating chat summary',
          stage: 'summaries.requested'
        });
        return requestChatSummary(runtimeForCall(runtime, ctx), input);
      })
  });
}

export type SummariesRouter = ReturnType<typeof createSummariesRouter>;

function runtimeForCall(runtime: SummariesRuntime, ctx: SummariesRpcContext): SummariesRuntime {
  if (ctx.eventBus === undefined || ctx.eventBus === runtime.eventBus) {
    return runtime;
  }

  return {
    ...runtime,
    eventBus: ctx.eventBus
  };
}
