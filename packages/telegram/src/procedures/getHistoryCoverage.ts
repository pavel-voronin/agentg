import { z } from 'zod';

import { listHistoryCoverage } from '../history/coverage.js';
import { historyCoverageSegmentSchema, nonEmptyStringSchema } from '../views/schemas.js';
import type { ProcedureResources } from './resources.js';

const inputSchema = z.object({
  chatId: nonEmptyStringSchema
});

const outputSchema = z.object({
  coverage: z.array(historyCoverageSegmentSchema)
});

type Input = z.infer<typeof inputSchema>;
type Output = z.infer<typeof outputSchema>;

export function getHistoryCoverageProcedure(resources: ProcedureResources) {
  return async (input: unknown): Promise<Output> => {
    const output = await runGetHistoryCoverage(inputSchema.parse(input), resources);
    return outputSchema.parse(output);
  };
}

async function runGetHistoryCoverage(input: Input, resources: ProcedureResources): Promise<Output> {
  const coverage = await listHistoryCoverage(resources.database, input.chatId);

  return {
    coverage: coverage.map((interval) => ({
      coveredAt: interval.coveredAt.toISOString(),
      endAt: interval.endAt.toISOString(),
      startAt: interval.startAt.toISOString()
    }))
  };
}
