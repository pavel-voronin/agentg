import { describe, expect, it } from 'vitest';

import { TELEGRAM_HISTORY_PAST_BOUNDARY } from '../../src/constants.js';
import { completedOneShotTargets, reconcileChat } from '../../src/reconciler.js';
import { absoluteBoundary, expressionBoundary, historyRange } from '../../src/ranges.js';
import type { BackfillJobInput, HistoryCoverageInterval, HistoryTarget } from '../../src/types.js';

describe('history reconciler', () => {
  it('creates one job when an absolute target has no coverage', () => {
    expect(reconcile({ targets: [target('2026-01-01', '2026-01-31')] })).toEqual([
      job('2026-01-01', '2026-01-31')
    ]);
  });

  it('creates no jobs when an absolute target is fully covered', () => {
    expect(
      reconcile({
        coverage: [coverage('2026-01-01', '2026-01-31')],
        targets: [target('2026-01-01', '2026-01-31')]
      })
    ).toEqual([]);
  });

  it('creates a prefix job when coverage starts after the target start', () => {
    expect(
      reconcile({
        coverage: [coverage('2026-01-10', '2026-01-31')],
        targets: [target('2026-01-01', '2026-01-31')]
      })
    ).toEqual([job('2026-01-01', '2026-01-10')]);
  });

  it('creates a suffix job when coverage ends before the target end', () => {
    expect(
      reconcile({
        coverage: [coverage('2026-01-01', '2026-01-10')],
        targets: [target('2026-01-01', '2026-01-31')]
      })
    ).toEqual([job('2026-01-10', '2026-01-31')]);
  });

  it('creates a middle-gap job when coverage has a hole inside the target', () => {
    expect(
      reconcile({
        coverage: [coverage('2026-01-01', '2026-01-10'), coverage('2026-01-20', '2026-01-31')],
        targets: [target('2026-01-01', '2026-01-31')]
      })
    ).toEqual([job('2026-01-10', '2026-01-20')]);
  });

  it('creates multiple jobs for multiple missing intervals', () => {
    expect(
      reconcile({
        coverage: [
          coverage('2026-01-01', '2026-01-05'),
          coverage('2026-01-10', '2026-01-12'),
          coverage('2026-01-20', '2026-01-31')
        ],
        targets: [target('2026-01-01', '2026-01-31')]
      })
    ).toEqual([job('2026-01-12', '2026-01-20'), job('2026-01-05', '2026-01-10')]);
  });

  it('uses the union of multiple targets for the same chat as desired coverage', () => {
    expect(
      reconcile({
        coverage: [coverage('2026-01-10', '2026-01-20')],
        targets: [target('2026-01-01', '2026-01-15'), target('2026-01-15', '2026-01-31')]
      })
    ).toEqual([job('2026-01-20', '2026-01-31'), job('2026-01-01', '2026-01-10')]);
  });

  it('subtracts all coverage intervals for the chat from desired coverage', () => {
    expect(
      reconcile({
        coverage: [
          coverage('2026-01-01', '2026-01-10'),
          coverage('2026-01-20', '2026-01-31'),
          coverage('2026-01-01', '2026-01-31', 'other-chat')
        ],
        targets: [target('2026-01-01', '2026-01-31')]
      })
    ).toEqual([job('2026-01-10', '2026-01-20')]);
  });

  it('projects an absolute target to the same desired interval every time', () => {
    const input = {
      coverage: [],
      targets: [target('2026-01-01', '2026-01-31')]
    };

    expect(reconcile(input)).toEqual(reconcile({ ...input, now: date('2027-01-01') }));
  });

  it('projects a relative target using the provided current time', () => {
    expect(
      reconcile({
        targets: [
          {
            chatId,
            id: 'target-1',
            range: historyRange(expressionBoundary('now-30d'), expressionBoundary('now'))
          }
        ]
      })
    ).toEqual([job('2026-03-29', '2026-04-28')]);
  });

  it('does not create jobs for the live-covered tail of a relative target', () => {
    expect(
      reconcile({
        coverage: [coverage('2026-04-20', '2026-04-28')],
        targets: [
          {
            chatId,
            id: 'target-1',
            range: historyRange(expressionBoundary('now-30d'), expressionBoundary('now'))
          }
        ]
      })
    ).toEqual([job('2026-03-29', '2026-04-20')]);
  });

  it('does not create jobs for a one-tick gap between coverage intervals', () => {
    expect(
      reconcile({
        coverage: [
          coverageAt('2026-01-01T00:00:00.000Z', '2026-01-10T00:00:00.000Z'),
          coverageAt('2026-01-10T00:00:01.000Z', '2026-01-31T00:00:00.000Z')
        ],
        targets: [target('2026-01-01', '2026-01-31')]
      })
    ).toEqual([]);
  });

  it('splits a large missing interval into executable job windows', () => {
    expect(
      reconcile({
        jobWindowMilliseconds: 10 * dayMilliseconds,
        targets: [target('2026-01-01', '2026-01-31')]
      })
    ).toEqual([
      job('2026-01-21', '2026-01-31'),
      job('2026-01-11', '2026-01-21'),
      job('2026-01-01', '2026-01-11')
    ]);
  });

  it('orders runnable jobs by missing intervals closest to the present first', () => {
    expect(
      reconcile({
        coverage: [coverage('2026-01-05', '2026-01-10'), coverage('2026-01-20', '2026-01-25')],
        targets: [target('2026-01-01', '2026-01-31')]
      })
    ).toEqual([
      job('2026-01-25', '2026-01-31'),
      job('2026-01-10', '2026-01-20'),
      job('2026-01-01', '2026-01-05')
    ]);
  });

  it('normalizes created jobs to Telegram-second boundaries', () => {
    expect(
      reconcile({
        targets: [
          {
            chatId,
            id: 'target-1',
            range: historyRange(
              absoluteBoundary('2026-01-01T00:00:00.250Z'),
              absoluteBoundary('2026-01-01T00:00:01.250Z')
            )
          }
        ]
      })
    ).toEqual([jobAt('2026-01-01T00:00:00.000Z', '2026-01-01T00:00:02.000Z')]);
  });

  it('marks fully covered standalone absolute targets as completed one-shot targets', () => {
    const absoluteTarget = target('2026-01-01', '2026-01-31');

    expect(
      completedTargets({
        coverage: [coverage('2026-01-01', '2026-01-31')],
        targets: [absoluteTarget]
      })
    ).toEqual([absoluteTarget]);
  });

  it('does not complete relative or template-owned targets automatically', () => {
    const relativeTarget: HistoryTarget = {
      chatId,
      id: 'relative',
      range: historyRange(expressionBoundary('now-30d'), expressionBoundary('now'))
    };
    const linkedAbsoluteTarget: HistoryTarget = {
      ...target('2026-01-01', '2026-01-31'),
      id: 'linked',
      templateId: 'template-1'
    };

    expect(
      completedTargets({
        coverage: [coverage('2026-01-01', '2026-01-31'), coverage('2026-03-29', '2026-04-28')],
        targets: [relativeTarget, linkedAbsoluteTarget]
      })
    ).toEqual([]);
  });
});

const chatId = 'chat-a';
const dayMilliseconds = 24 * 60 * 60 * 1000;

function reconcile(options: {
  coverage?: HistoryCoverageInterval[];
  jobWindowMilliseconds?: number;
  now?: Date;
  targets: HistoryTarget[];
}): BackfillJobInput[] {
  return reconcileChat({
    chatId,
    coverage: options.coverage ?? [],
    literals: {
      past: TELEGRAM_HISTORY_PAST_BOUNDARY
    },
    now: options.now ?? date('2026-04-28'),
    targets: options.targets,
    ...(options.jobWindowMilliseconds === undefined
      ? {}
      : { jobWindowMilliseconds: options.jobWindowMilliseconds })
  });
}

function completedTargets(options: {
  coverage?: HistoryCoverageInterval[];
  now?: Date;
  targets: HistoryTarget[];
}): HistoryTarget[] {
  return completedOneShotTargets({
    chatId,
    coverage: options.coverage ?? [],
    literals: {
      past: TELEGRAM_HISTORY_PAST_BOUNDARY
    },
    now: options.now ?? date('2026-04-28'),
    targets: options.targets
  });
}

function target(startAt: string, endAt: string): HistoryTarget {
  return {
    chatId,
    id: `${startAt}:${endAt}`,
    range: historyRange(absoluteBoundary(date(startAt)), absoluteBoundary(date(endAt)))
  };
}

function coverage(
  startAt: string,
  endAt: string,
  intervalChatId = chatId
): HistoryCoverageInterval {
  return {
    chatId: intervalChatId,
    endAt: date(endAt),
    startAt: date(startAt)
  };
}

function coverageAt(
  startAt: string,
  endAt: string,
  intervalChatId = chatId
): HistoryCoverageInterval {
  return {
    chatId: intervalChatId,
    endAt: new Date(endAt),
    startAt: new Date(startAt)
  };
}

function job(startAt: string, endAt: string): BackfillJobInput {
  return {
    chatId,
    endAt: date(endAt),
    startAt: date(startAt)
  };
}

function jobAt(startAt: string, endAt: string): BackfillJobInput {
  return {
    chatId,
    endAt: new Date(endAt),
    startAt: new Date(startAt)
  };
}

function date(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}
