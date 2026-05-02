import { procedureEnvelopeSchema } from '@agentg/shared/rpc/envelope';

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
import { extension, observable, rpc, summariesRpcRouter } from './trpc.js';
import {
  getChatSummaryExtension,
  readChatSummary,
  readSummaryRun,
  requestChatSummary,
  type SummariesRuntime
} from '../summary-service.js';

export function createSummariesRouter(runtime: SummariesRuntime) {
  return summariesRpcRouter({
    summaries: summariesRpcRouter({
      chatSummary: extension
        .input(summariesChatSummaryExtensionInputSchema)
        .output(procedureEnvelopeSchema(summariesChatSummaryExtensionOutputSchema))
        .query(({ input }) =>
          getChatSummaryExtension(runtime, chatIdFromExtensionOutput(input.output))
        ),
      readChatSummary: rpc
        .input(summariesReadChatSummaryInputSchema)
        .output(procedureEnvelopeSchema(summariesReadChatSummaryOutputSchema))
        .query(({ input }) => readChatSummary(runtime, input.chatId)),
      readSummaryRun: rpc
        .input(summariesReadSummaryRunInputSchema)
        .output(procedureEnvelopeSchema(summariesReadSummaryRunOutputSchema))
        .query(({ input }) => readSummaryRun(runtime, input.runId)),
      requestSummary: observable
        .input(summariesRequestSummaryInputSchema)
        .output(procedureEnvelopeSchema(summariesRequestSummaryOutputSchema))
        .mutation(({ ctx, input }) => {
          ctx.progress({
            message: 'Creating chat summary',
            stage: 'summaries.requested'
          });
          return requestChatSummary(runtime, input);
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

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}
