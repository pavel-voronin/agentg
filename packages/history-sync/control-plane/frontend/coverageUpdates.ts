export type CoverageUpdateInterval = {
  chatId: string;
  endAt: string;
  startAt: string;
};

export type CoverageUpdateBatch = {
  chatCount: number;
  intervalCount: number;
  latestInterval: CoverageUpdateInterval;
};

export function coverageUpdateBatchFromEvent(event: {
  data?: unknown;
}): CoverageUpdateBatch | null {
  const intervals = coverageUpdatesFromEvent(event);
  const latestInterval = intervals.at(-1);
  if (latestInterval === undefined) {
    return null;
  }

  return {
    chatCount: distinctStrings(intervals.map((interval) => interval.chatId)).length,
    intervalCount: intervals.length,
    latestInterval
  };
}

function coverageUpdatesFromEvent(event: { data?: unknown }): CoverageUpdateInterval[] {
  return asRecords(asRecord(event.data)?.intervals).flatMap((interval) => {
    const chatId = asString(asRecord(interval.chat)?.id) ?? asString(interval.chatId);
    const startAt = asString(interval.startAt);
    const endAt = asString(interval.endAt);
    if (chatId === undefined || startAt === undefined || endAt === undefined) {
      return [];
    }

    return [{ chatId, endAt, startAt }];
  });
}

function distinctStrings(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function asRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => asRecord(item) !== undefined)
    : [];
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
