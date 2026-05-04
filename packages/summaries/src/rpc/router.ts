import {
  summariesChatSummaryExtensionInputSchema,
  summariesChatSummaryExtensionOutputSchema,
  summariesReadChatSummaryInputSchema,
  summariesReadChatSummaryOutputSchema,
  summariesReadSummaryRunInputSchema,
  summariesReadSummaryRunOutputSchema,
  summariesRequestSummaryInputSchema,
  summariesRequestSummaryOutputSchema
} from './contracts.js';
import { extension, rpc, summariesRpcRouter } from './trpc.js';
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
    summaries: summariesRpcRouter({
      chatSummary: extension
        .input(summariesChatSummaryExtensionInputSchema)
        .output(summariesChatSummaryExtensionOutputSchema)
        .query(({ input }) =>
          getChatSummaryExtension(runtime, chatIdFromExtensionOutput(input.output))
        ),
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
    })
  });
}

export type SummariesRouter = ReturnType<typeof createSummariesRouter>;

function chatIdFromExtensionOutput(output: unknown): string {
  const record = asRecord(output);
  const chat = asRecord(record?.chat);
  if (typeof chat?.id === 'string' && chat.id.length > 0) {
    return chat.id;
  }

  throw new Error('summaries.chatSummary extension requires output.chat.id');
}

function runtimeForCall(runtime: SummariesRuntime, ctx: SummariesRpcContext): SummariesRuntime {
  if (ctx.eventBus === undefined || ctx.eventBus === runtime.eventBus) {
    return runtime;
  }

  return {
    ...runtime,
    eventBus: ctx.eventBus
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}
