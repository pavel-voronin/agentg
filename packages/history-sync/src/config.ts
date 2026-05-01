import { loadNearestDotenv } from '@agentg/shared/dotenv';

loadNearestDotenv();

export type HistorySyncServiceConfig = {
  backfill: {
    chatLoadBatchSize: number;
    messageLimit: number;
    requestDelayMs: number;
    windowDays: number;
  };
  databaseUrl: string;
  nats: {
    url: string;
  };
};

export function loadHistorySyncServiceConfig(
  env: NodeJS.ProcessEnv = process.env
): HistorySyncServiceConfig {
  return {
    backfill: {
      chatLoadBatchSize:
        parseOptionalInteger(env.BACKFILL_CHAT_LOAD_BATCH_SIZE, 'BACKFILL_CHAT_LOAD_BATCH_SIZE') ??
        100,
      messageLimit:
        parseOptionalInteger(env.BACKFILL_MESSAGE_LIMIT, 'BACKFILL_MESSAGE_LIMIT') ?? 100,
      requestDelayMs:
        parseOptionalInteger(env.BACKFILL_REQUEST_DELAY_MS, 'BACKFILL_REQUEST_DELAY_MS') ?? 1000,
      windowDays: parseOptionalInteger(env.BACKFILL_WINDOW_DAYS, 'BACKFILL_WINDOW_DAYS') ?? 31
    },
    databaseUrl: env.DATABASE_URL ?? 'postgres://agentg:agentg@localhost:5432/agentg',
    nats: {
      url: env.NATS_URL ?? 'nats://localhost:4222'
    }
  };
}

function parseOptionalInteger(value: string | undefined, name: string): number | undefined {
  if (value === undefined || value.length === 0) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}
