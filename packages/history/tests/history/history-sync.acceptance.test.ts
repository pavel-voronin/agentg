import { describe, expect, it } from 'vitest';

import { completeBackfillJob } from '../../src/jobs.js';
import { TELEGRAM_HISTORY_PAST_BOUNDARY } from '../../src/constants.js';
import {
  editHistoryTargetDirectly,
  materializeTemplatesForChat,
  updateLinkedTargetsForTemplate
} from '../../src/materialization.js';
import { reconcileChat } from '../../src/reconciler.js';
import { expressionBoundary, historyRange } from '../../src/ranges.js';
import type { HistoryCoverageInterval, HistoryTarget, HistoryTemplate } from '../../src/types.js';

describe('history sync acceptance', () => {
  it('materializes a target for a newly discovered matching chat and reconciles it into a job', () => {
    const targets = materializeTemplatesForChat([privateRecentTemplate], privateChat);

    expect(reconcile(targets)).toEqual([jobInput('2026-03-29', '2026-04-28')]);
  });

  it('completes a job and then reconciles the target to no remaining jobs', () => {
    const targets = materializeTemplatesForChat([privateRecentTemplate], privateChat);
    const [job] = reconcile(targets);
    if (job === undefined) {
      throw new Error('Expected reconciler to create a job');
    }

    const completed = completeBackfillJob(
      {
        ...job,
        id: 'job-1',
        status: 'pending'
      },
      []
    );

    expect(reconcile(targets, completed.coverage)).toEqual([]);
  });

  it('updates a linked target after a template change and reconciles the new missing interval', () => {
    const targets = materializeTemplatesForChat([privateRecentTemplate], privateChat);
    const updatedTargets = updateLinkedTargetsForTemplate(privateFullTemplate, targets);

    expect(reconcile(updatedTargets, [coverage('2026-03-29', '2026-04-28')])).toEqual([
      jobInput('2013-08-14', '2026-03-29')
    ]);
  });

  it('keeps a standalone target unchanged after a template change', () => {
    const [linkedTarget] = materializeTemplatesForChat([privateRecentTemplate], privateChat);
    if (linkedTarget === undefined) {
      throw new Error('Expected template to materialize a target');
    }

    const standaloneTarget = editHistoryTargetDirectly(linkedTarget, {
      range: privateRecentTemplate.range
    });

    expect(updateLinkedTargetsForTemplate(privateFullTemplate, [standaloneTarget])).toEqual([
      standaloneTarget
    ]);
  });

  it('covers a rolling recent target with historical jobs up to the live-covered tail', () => {
    const targets = materializeTemplatesForChat([privateRecentTemplate], privateChat);

    expect(reconcile(targets, [coverage('2026-04-20', '2026-04-28')])).toEqual([
      jobInput('2026-03-29', '2026-04-20')
    ]);
  });
});

const now = date('2026-04-28');
const chatId = 'chat-a';
const privateChat = {
  id: chatId,
  title: 'Alice',
  type: 'private'
};

const privateRecentTemplate: HistoryTemplate = {
  id: 'private-recent',
  match: { chatType: 'private' },
  range: historyRange(expressionBoundary('now-30d'), expressionBoundary('now'))
};

const privateFullTemplate: HistoryTemplate = {
  ...privateRecentTemplate,
  range: historyRange(expressionBoundary('past'), expressionBoundary('now'))
};

function reconcile(
  targets: HistoryTarget[],
  coverageIntervals: HistoryCoverageInterval[] = []
): ReturnType<typeof reconcileChat> {
  return reconcileChat({
    chatId,
    coverage: coverageIntervals,
    literals: {
      past: TELEGRAM_HISTORY_PAST_BOUNDARY
    },
    now,
    targets
  });
}

function jobInput(startAt: string, endAt: string) {
  return {
    chatId,
    endAt: date(endAt),
    startAt: date(startAt)
  };
}

function coverage(startAt: string, endAt: string): HistoryCoverageInterval {
  return {
    chatId,
    endAt: date(endAt),
    startAt: date(startAt)
  };
}

function date(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}
