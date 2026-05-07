import { query } from '@agentg/rpc/surface';

import {
  summariesReadSummaryRunInputSchema,
  summariesReadSummaryRunOutputSchema
} from '../contracts.js';
import { rpc } from '../trpc.js';
import type { SummariesRuntime } from '../../runtime.js';

export const readSummaryRun = query((runtime: SummariesRuntime) =>
  rpc
    .input(summariesReadSummaryRunInputSchema)
    .output(summariesReadSummaryRunOutputSchema)
    .query(({ input }) => runtime.repository.readRun(input.runId))
);
