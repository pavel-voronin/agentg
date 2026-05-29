import { query } from '@agentg/framework/domain';
import { z } from 'zod';

import { useFiles } from '../../../files/subsystem.js';
import { nonNegativeIntegerSchema } from '../../../read-model/api.js';

export const fileQueueStatsSchema = z.object({
  downloadingCount: nonNegativeIntegerSchema,
  failedCount: nonNegativeIntegerSchema,
  knownCount: nonNegativeIntegerSchema,
  knownDownloadedBytes: nonNegativeIntegerSchema,
  knownRemainingBytes: nonNegativeIntegerSchema,
  knownTotalBytes: nonNegativeIntegerSchema,
  queuedCount: nonNegativeIntegerSchema,
  readyCount: nonNegativeIntegerSchema,
  remainingCount: nonNegativeIntegerSchema,
  totalCount: nonNegativeIntegerSchema,
  unknownRemainingCount: nonNegativeIntegerSchema
});

export const fileQueueStatsInputSchema = z.object({}).default({});

export const fileQueueStatsOutputSchema = z.object({
  stats: fileQueueStatsSchema
});

export type FileQueueStatsOutput = z.infer<typeof fileQueueStatsOutputSchema>;

export const fileQueueStats = query((_context, procedure) =>
  procedure
    .input(fileQueueStatsInputSchema)
    .output(fileQueueStatsOutputSchema)
    .query(() => runFileQueueStats())
);

async function runFileQueueStats(): Promise<FileQueueStatsOutput> {
  const files = useFiles();
  return {
    stats: await files.getQueueStats()
  };
}
