import type { TriggerRegistration } from '../registrations/types.js';

export function dueTimes(input: {
  lookbackSeconds: number;
  now: Date;
  registration: TriggerRegistration;
}): Date[] {
  const intervalMs = input.registration.schedule.everySeconds * 1000;
  const configuredStart =
    input.registration.schedule.startAt === undefined
      ? undefined
      : new Date(input.registration.schedule.startAt);
  const anchor = configuredStart ?? input.registration.anchorAt;
  if (Number.isNaN(anchor.getTime()) || anchor > input.now) {
    return [];
  }

  const windowStart = new Date(input.now.getTime() - input.lookbackSeconds * 1000);
  const firstCandidate =
    anchor < windowStart ? firstAtOrAfter(anchor, windowStart, intervalMs) : anchor;
  const output: Date[] = [];
  for (
    let timestamp = firstCandidate.getTime();
    timestamp <= input.now.getTime();
    timestamp += intervalMs
  ) {
    output.push(new Date(timestamp));
  }
  return output;
}

function firstAtOrAfter(anchor: Date, minimum: Date, intervalMs: number): Date {
  const delta = minimum.getTime() - anchor.getTime();
  const periods = Math.max(0, Math.ceil(delta / intervalMs));
  return new Date(anchor.getTime() + periods * intervalMs);
}
