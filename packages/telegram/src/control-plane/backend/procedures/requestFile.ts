import { mutation } from '@agentg/rpc/surface';
import { fileRequestInputSchema, fileRequestOutputSchema } from '../contracts.js';
import type { TelegramRpcRuntime } from '../../../rpc/runtime.js';
import { rpc } from '../../../rpc/trpc.js';
import type { FileRequestInput, FileRequestOutput } from '../contracts.js';
import type { TelegramProcedureContext } from '../../../procedure-runtime/context.js';

export const requestFile = mutation((runtime: TelegramRpcRuntime) =>
  rpc
    .input(fileRequestInputSchema)
    .output(fileRequestOutputSchema)
    .mutation(({ input }) => runRequestFile(runtime, input))
);

async function runRequestFile(
  { files }: TelegramProcedureContext,
  input: FileRequestInput
): Promise<FileRequestOutput> {
  return files.requestFile(input);
}
