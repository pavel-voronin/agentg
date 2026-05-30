import type { EventEnvelope } from './eventBus.js';

export type EventMessage = {
  data: Uint8Array;
};

export type EventMessageSource = AsyncIterable<EventMessage> & {
  getSubject(): string;
};

export async function consumeEventMessages(input: {
  closed(): boolean;
  decode(data: Uint8Array): string;
  handler(event: EventEnvelope): void | Promise<void>;
  source: EventMessageSource;
}): Promise<void> {
  try {
    for await (const message of input.source) {
      const event = parseEventEnvelope(input.decode(message.data));
      if (event === undefined) {
        continue;
      }

      try {
        await input.handler(event);
      } catch (error) {
        logSubscriptionError('event_bus.handler_failed', input.source.getSubject(), error);
      }
    }
  } catch (error) {
    if (!input.closed()) {
      logSubscriptionError('event_bus.subscription_failed', input.source.getSubject(), error);
    }
  }
}

function parseEventEnvelope(payload: string): EventEnvelope | undefined {
  try {
    const parsed: unknown = JSON.parse(payload);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('id' in parsed) ||
      typeof parsed.id !== 'string' ||
      !('type' in parsed) ||
      typeof parsed.type !== 'string' ||
      !('at' in parsed) ||
      typeof parsed.at !== 'string'
    ) {
      return undefined;
    }

    return {
      at: parsed.at,
      ...('data' in parsed ? { data: parsed.data } : {}),
      id: parsed.id,
      type: parsed.type
    };
  } catch {
    return undefined;
  }
}

function logSubscriptionError(event: string, subject: string, error: unknown): void {
  console.error(
    JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      event,
      subject
    })
  );
}
